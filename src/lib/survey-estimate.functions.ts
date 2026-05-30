// Model-backed estimate from the 60-second survey answers.
// Public server fn (no auth) — callable from the survey result screen for
// guests and signed-in users alike. Uses Gemini with tool
// calling for structured output. Returns can_estimate=false (with a kind
// message) when the user skipped too much for any meaningful estimate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function getAIConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  return {
    apiKey,
    model: process.env.KENERGY_AI_MODEL ?? "gemini-2.5-flash",
  };
}

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

const estimateSchema = z.object({
  can_estimate: z.boolean(),
  message: z.string().default("Estimate generated from your quick survey."),
  current_kwh_per_year: z.coerce.number().default(0),
  potential_kwh_saved_per_year: z.coerce.number().default(0),
  current_eur_per_year: z.coerce.number().default(0),
  potential_eur_saved_per_year: z.coerce.number().default(0),
  co2_kg_saved_per_year: z.coerce.number().default(0),
  data_quality: z.enum(["low", "medium", "high"]).default("medium"),
  top_recommendations: z
    .array(
      z.object({
        title: z.string(),
        why: z.string(),
        savings_eur_per_year: z.coerce.number().default(0),
      }),
    )
    .default([]),
});

const tool = {
  type: "function" as const,
  function: {
    name: "return_survey_estimate",
    description:
      "Return a personalized energy estimate from a 60-second survey. If too little information was provided, set can_estimate=false and explain kindly in `message`.",
    parameters: {
      type: "object",      properties: {
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
          type: "array",          items: {
            type: "object",            properties: {
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
      "Answer at least 5 quick questions first — especially size, heating type, and your biggest issue — and I can give you a meaningful estimate.",
    current_kwh_per_year: 0,
    potential_kwh_saved_per_year: 0,
    current_eur_per_year: 0,
    potential_eur_saved_per_year: 0,
    co2_kg_saved_per_year: 0,
    data_quality: "low",
    top_recommendations: [],
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function readEstimateFromCompletion(json: any): SurveyEstimate | null {
  const message = json?.choices?.[0]?.message;
  const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
  const parsedTool = parseMaybeJson(toolArgs);
  if (parsedTool) {
    const result = estimateSchema.safeParse(parsedTool);
    if (result.success) return result.data;
  }

  const parsedContent = parseMaybeJson(message?.content);
  if (parsedContent) {
    const result = estimateSchema.safeParse(parsedContent);
    if (result.success) return result.data;
  }

  return null;
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

    // Hard short-circuit: the quick estimate needs most of the 6 answers.
    if (answered.length < 5) {
      return { ...emptyEstimate(), model: undefined };
    }

    const ai = getAIConfig();

    const systemPrompt = `Kenergy Loop quick estimate for European renters. Assumptions: 0.28 EUR/kWh, 0.22 kg CO2/kWh.
Rules: survey has 12 questions; fewer than 5 answers => can_estimate=false and numbers 0. With 5+ answers estimate conservatively. Treat provided answers as facts. For missing data you may assume benchmark values, but any assumption-based recommendation must say "Assumption:" in why and explain the assumed condition. Never assume against provided info. Return several useful recommendations when justified; do not cap at 3. No bill required. Savings must be subset of current use, usually 8-22%. Prefer the return_survey_estimate tool. If tool calling is unavailable, return only a raw JSON object matching the tool schema.`;

    const userPrompt = `Survey answers (only what was provided):\n${JSON.stringify(
      Object.fromEntries(answered),
      null,
      2,
    )}`;

    async function requestEstimate(strict: boolean) {
      const res = await fetch(GEMINI_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            {
              role: "system",
              content: strict
                ? `${systemPrompt}\nSTRICT RETRY: return only one valid JSON object or one return_survey_estimate tool call. No markdown, no prose.`
                : systemPrompt,
            },
            { role: "user", content: userPrompt },
          ],
          tools: [tool],
          tool_choice: "auto",
          temperature: strict ? 0 : 0.2,
          max_tokens: 1600,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Rate limit reached — try again in a minute.");
        }
        if (res.status === 402) {
          throw new Error("model credits exhausted. Add credits in Settings → Workspace → Usage.");
        }
        const txt = await res.text().catch(() => "");
        console.error("estimateSurvey gateway error:", res.status, txt);
        throw new Error(`model gateway failed (${res.status})`);
      }

      return res.json();
    }

    const first = await requestEstimate(false);
    const parsed = readEstimateFromCompletion(first);
    if (parsed) return { ...parsed, model: ai.model };

    console.warn("estimateSurvey: first response was not structured, retrying", JSON.stringify(first).slice(0, 500));
    const second = await requestEstimate(true);
    const retried = readEstimateFromCompletion(second);
    if (retried) return { ...retried, model: ai.model };

    console.error("estimateSurvey: no structured estimate after retry", JSON.stringify(second).slice(0, 800));
    throw new Error("The model did not return a structured estimate");
  });
