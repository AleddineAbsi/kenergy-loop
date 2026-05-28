// AI-powered estimate from the 60-second survey answers.
// Public server fn (no auth) — callable from the survey result screen for
// guests and signed-in users alike. Uses Lovable AI Gateway with tool
// calling for structured output. Returns can_estimate=false (with a kind
// message) when the user skipped too much for any meaningful estimate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "google/gemini-3-flash-preview";

export type SurveyEstimate = {
  can_estimate: boolean;
  message: string; // shown verbatim to the user
  current_kwh_per_year: number;
  potential_kwh_saved_per_year: number;
  current_eur_per_year: number;
  potential_eur_saved_per_year: number;
  co2_kg_saved_per_year: number;
  data_quality: "low" | "medium" | "high";
  top_recommendations: Array<{
    title: string;
    why: string;
    savings_eur_per_year: number;
  }>;
  model?: string;
};

const tool = {
  type: "function" as const,
  function: {
    name: "return_survey_estimate",
    description:
      "Return a personalized energy estimate from a 60-second survey. If too little information was provided, set can_estimate=false and explain kindly in `message`.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        can_estimate: { type: "boolean" },
        message: {
          type: "string",
          description:
            "Short, friendly message. If can_estimate=false, say what is missing and that you cannot give a meaningful number without it. If true, a one-line confidence note.",
        },
        current_kwh_per_year: { type: "number" },
        potential_kwh_saved_per_year: { type: "number" },
        current_eur_per_year: { type: "number" },
        potential_eur_saved_per_year: { type: "number" },
        co2_kg_saved_per_year: { type: "number" },
        data_quality: { type: "string", enum: ["low", "medium", "high"] },
        top_recommendations: {
          type: "array",
          minItems: 0,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              why: { type: "string" },
              savings_eur_per_year: { type: "number" },
            },
            required: ["title", "why", "savings_eur_per_year"],
          },
        },
      },
      required: [
        "can_estimate",
        "message",
        "current_kwh_per_year",
        "potential_kwh_saved_per_year",
        "current_eur_per_year",
        "potential_eur_saved_per_year",
        "co2_kg_saved_per_year",
        "data_quality",
        "top_recommendations",
      ],
    },
  },
};

function emptyEstimate(): SurveyEstimate {
  return {
    can_estimate: false,
    message:
      "I can't calculate anything meaningful without at least a few answers — try adding your city, home size or monthly bill.",
    current_kwh_per_year: 0,
    potential_kwh_saved_per_year: 0,
    current_eur_per_year: 0,
    potential_eur_saved_per_year: 0,
    co2_kg_saved_per_year: 0,
    data_quality: "low",
    top_recommendations: [],
  };
}

export const estimateSurvey = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      answers: z.record(z.string(), z.string()).default({}),
    }),
  )
  .handler(async ({ data }): Promise<SurveyEstimate> => {
    const answered = Object.entries(data.answers ?? {}).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0,
    );

    // Hard short-circuit: nothing answered at all.
    if (answered.length === 0) {
      return { ...emptyEstimate(), model: undefined };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Kenergy, an AI energy optimizer for European rentals.
Estimate the user's CURRENT yearly electricity + heating use and the POTENTIAL savings achievable with a smart-home kit.
Assumptions: ~0.28 €/kWh blended, ~0.22 kg CO2 per kWh.

Rules:
- If the user skipped most questions (fewer than ~3 meaningful answers, or nothing about home size, heating, or spend), set can_estimate=false and explain kindly in \`message\` what's missing. Set all numbers to 0.
- If you can estimate, be conservative when data is sparse — lower data_quality and lower potential savings accordingly.
- potential_kwh_saved_per_year and potential_eur_saved_per_year must be a subset of the current usage (typically 8–22%).
- Always reply by calling the return_survey_estimate tool.`;

    const userPrompt = `Survey answers (only what was provided):\n${JSON.stringify(
      Object.fromEntries(answered),
      null,
      2,
    )}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_survey_estimate" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Rate limit reached — try again in a minute.");
      }
      if (res.status === 402) {
        throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      }
      const txt = await res.text().catch(() => "");
      console.error("estimateSurvey gateway error:", res.status, txt);
      throw new Error(`AI gateway failed (${res.status})`);
    }

    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      console.error("estimateSurvey: no tool call", JSON.stringify(json).slice(0, 500));
      throw new Error("AI did not return a structured estimate");
    }

    let parsed: SurveyEstimate;
    try {
      parsed = JSON.parse(args);
    } catch (e) {
      console.error("estimateSurvey: bad JSON", e);
      throw new Error("AI returned malformed JSON");
    }

    return { ...parsed, model: MODEL };
  });
