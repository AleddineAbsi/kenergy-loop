// Phase 3 — Real AI action plan via Gemini.
//
// generateActionPlan() reads the signed-in user's quick survey + long-form
// answers, asks Gemini for a structured action plan via
// tool-calling, caches the result in `ai_action_plans` keyed by a hash of
// the inputs, and returns it. The cache is busted whenever survey or
// long-form answers change.
import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_MODEL = "gemini-2.5-flash";

function getAIConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  return {
    apiKey,
    model: process.env.KENERGY_AI_MODEL ?? GEMINI_MODEL,
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  };
}

export type AICategory = "do-now" | "small-helper" | "add-info" | "needs-landlord" | "monitor";
export type AIEffort = "easy" | "medium" | "hard";

export type AISource = { label: string; url?: string };

export type AIRecommendation = {
  id: string;
  title: string;
  description: string;
  savings_eur_per_year: number;
  confidence: number; // 0-100
  category: AICategory;
  effort: AIEffort;
  why: string;
  how_it_works: string;
  how_to_proceed: string;
  sources?: AISource[];
};

export type AIKitItem = {
  name: string;
  qty: number;
  brand_examples: string;
  price_each_eur: number;
  why: string;
};

export type AIActionPlan = {
  yearly_savings_eur: number;
  yearly_kwh: number;
  co2_kg: number;
  energy_score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  summary: string;
  recommendations: AIRecommendation[];
  smart_home_kit: AIKitItem[];
  data_quality: "low" | "medium" | "high";
  model?: string;
  generated_at?: string;
  cached?: boolean;
};

const planTool = {
  type: "function" as const,
  function: {
    name: "return_action_plan",
    description:
      "Return a personalized smart-home energy action plan for the user based on their survey and long-form answers.",
    parameters: {
      type: "object",
      properties: {
        yearly_savings_eur: { type: "number", description: "Estimated total yearly savings in EUR after the plan is applied." },
        yearly_kwh: { type: "number", description: "Estimated kWh saved per year." },
        co2_kg: { type: "number", description: "Estimated kg of CO2 avoided per year." },
        energy_score: { type: "number", description: "Score from 0 (worst) to 100 (best) reflecting current home efficiency." },
        grade: { type: "string", enum: ["A", "B", "C", "D", "E", "F", "G"] },
        summary: { type: "string", description: "One short paragraph (max 2 sentences) summarizing the home situation." },
        data_quality: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "How confident we are given how much profile data is filled in.",
        },
        recommendations: {
          type: "array",          description:
            "Only include recommendations that are genuinely useful for this user. Do NOT pad to fill categories — skip any category that has nothing meaningful to suggest. Order is irrelevant (the UI re-sorts).",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Short kebab-case id." },
              title: { type: "string", description: "Plain-language action title, ~6 words max." },
              description: {
                type: "string",
                description:
                  "1-2 sentences in plain language describing the action — what to do, accessible to a general audience.",
              },
              savings_eur_per_year: { type: "number" },
              confidence: {
                type: "number",
                description:
                  "0-100. Reflect ONLY how confident the suggestion is given the available user information. Low data → low confidence. Be honest.",
              },
              category: {
                type: "string",
                enum: ["do-now", "small-helper", "add-info", "needs-landlord", "monitor"],
              },
              effort: {
                type: "string",
                enum: ["easy", "medium", "hard"],
                description: "How much effort/friction to actually do this.",
              },
              why: { type: "string", description: "Why this applies to THIS user's profile (1 sentence)." },
              how_it_works: {
                type: "string",
                description:
                  "Friendly 2-3 sentence explanation of HOW it saves energy. Avoid jargon; explain any technical term briefly.",
              },
              how_to_proceed: {
                type: "string",
                description:
                  "Concrete next step. For hardware: name the device type, what it does, and WHO to contact (e.g. 'a certified electrician / Elektriker', 'your landlord', 'a heating engineer / Heizungsmonteur') and roughly how to find one. For DIY: 2-4 step instructions.",
              },
              sources: {
                type: "array",                description:
                  "When possible, cite the basis for the savings number: agency reports (BfEE, ADEME, dena, IEA, Eurostat), vendor specs, or a well-known study. Skip rather than invent.",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["label"],                },
              },
            },
            required: [
              "id",
              "title",
              "description",
              "savings_eur_per_year",
              "confidence",
              "category",
              "effort",
              "why",
              "how_it_works",
              "how_to_proceed",
            ],          },
        },
        smart_home_kit: {
          type: "array",          description: "Curated, compatibility-checked smart home kit sized to the user's home. Skip entirely if nothing is justified.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: "number" },
              brand_examples: { type: "string", description: "Two or three compatible brands separated by /." },
              price_each_eur: { type: "number" },
              why: { type: "string" },
            },
            required: ["name", "qty", "brand_examples", "price_each_eur", "why"],          },
        },
      },
      required: [
        "yearly_savings_eur",
        "yearly_kwh",
        "co2_kg",
        "energy_score",
        "grade",
        "summary",
        "data_quality",
        "recommendations",
        "smart_home_kit",
      ],    },
  },
};

function hashInputs(survey: unknown, longForm: unknown) {
  return createHash("sha256")
    .update(JSON.stringify({ survey: survey ?? {}, longForm: longForm ?? {} }))
    .digest("hex");
}

function fallbackPlan(): AIActionPlan {
  return {
    yearly_savings_eur: 0,
    yearly_kwh: 0,
    co2_kg: 0,
    energy_score: 50,
    grade: "D",
    summary:
      "Complete the 60-second survey to unlock your personalized AI action plan.",
    recommendations: [],
    smart_home_kit: [],
    data_quality: "low",
  };
}

export const generateActionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ force: z.boolean().optional() }).optional())
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const force = data?.force === true;

    // Load survey + long-form for this user (RLS-scoped client).
    const [{ data: survey }, { data: longForm }] = await Promise.all([
      supabase
        .from("survey_responses")
        .select("answers, seconds_taken")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("long_form_responses")
        .select("answers, progress")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (!survey?.answers && !longForm?.answers) {
      return { ...fallbackPlan(), cached: false, model: undefined } as AIActionPlan;
    }

    const inputs_hash = hashInputs(survey?.answers, longForm?.answers);

    if (!force) {
      const { data: cached } = await supabase
        .from("ai_action_plans")
        .select("plan, inputs_hash, model, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cached && cached.inputs_hash === inputs_hash && cached.plan) {
        return {
          ...(cached.plan as AIActionPlan),
          model: cached.model ?? undefined,
          generated_at: cached.updated_at as string,
          cached: true,
        };
      }
    }

    const ai = getAIConfig();

    const knowledgeText = [
      "- Smart thermostats and TRVs can reduce heating energy by roughly 8-20% when schedules and room-level setpoints replace manual heating.",
      "- Standby power is often small per device but meaningful across many always-on appliances; smart plugs and power strips help identify and cut waste.",
      "- Heat pumps, EV chargers, dishwashers, washing machines, and dryers benefit from tariff-aware scheduling when the household has a dynamic or day/night tariff.",
      "- Old fridges, freezers, TVs, servers, and pumps are common high-consumption replacement candidates when age, noise, heat, or high standby draw is visible.",
      "- Renters should prefer reversible measures first: schedules, TRVs where allowed, smart plugs, presence sensors, LED lighting, and monitoring before fixed electrical work.",
      "- For electrical work, sub-metering, or hardwired devices, recommend a certified electrician. For heating hydraulics and boiler changes, recommend a heating engineer and landlord approval when rented.",
    ].join("\n");

    const systemPrompt = `You are Kenergy, an AI energy optimizer for smart home appliances in European rentals (EUR, kWh, ~0.28 €/kWh, ~0.22 kg CO2 per kWh).
You build a personalized action plan from the user's quick survey and (optional) long-form profile.
Ground every recommendation in the Knowledge Base snippets below — prefer their numbers, brands, and savings ranges over generic guesses. If a topic is not covered, be conservative and lower confidence.

Rules:
- Be specific to the user's heating, household size, home size, standby habits, and stated goal.
- Quality > quantity. Only include a recommendation if it is genuinely useful for THIS user. NEVER pad to fill categories — it is perfectly fine to skip "do-now", "small-helper", "add-info", "needs-landlord", or "monitor" entirely if nothing meaningful applies.
- For each recommendation, write for a general (non-technical) audience: explain HOW it saves energy in plain words, and give concrete next steps. If hardware install is required, name the device, what it does, and which professional to contact (e.g. certified electrician / Elektriker, heating engineer / Heizungsmonteur, landlord), plus a rough way to find one.
- Confidence (0-100) MUST reflect how confident the suggestion is given the available user information. With sparse data, lower confidence; with rich data (long-form, bill, scan), raise it. Be honest — do not inflate.
- When possible, cite sources for savings ranges (BfEE, dena, ADEME, IEA, Eurostat, vendor specs, peer-reviewed studies). Skip rather than invent a source.
- The smart home kit must list real, compatible Matter/Zigbee/Wi-Fi brands (e.g. tado°, Shelly, Aqara, Philips Hue, TP-Link Tapo, AVM FRITZ!DECT, Home Assistant Green). No vendor lock-in. Skip the kit entirely if nothing is justified.
- Be conservative on savings if data is sparse — set data_quality accordingly.
- Always reply by calling the return_action_plan tool. Never reply with plain text.`;

    const userPrompt = `Knowledge Base:\n${knowledgeText}\n\nQuick survey answers:\n${JSON.stringify(
      survey?.answers ?? {},
      null,
      2,
    )}\n\nLong-form profile (may be partial, progress ${longForm?.progress ?? 0}%):\n${JSON.stringify(
      longForm?.answers ?? {},
      null,
      2,
    )}`;


    const res = await fetch(ai.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [planTool],
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("Rate limit reached on the AI service — please try again in a minute.");
      }
      if (res.status === 402) {
        throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      }
      console.error("Gemini API error:", res.status, text);
      throw new Error(`AI gateway failed (${res.status})`);
    }

    const completion = await res.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned:", JSON.stringify(completion).slice(0, 500));
      throw new Error("AI did not return a structured plan");
    }

    let plan: AIActionPlan;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Bad JSON from AI tool call:", e);
      throw new Error("AI returned malformed plan JSON");
    }

    // Upsert into cache.
    const { error: upsertError } = await supabase
      .from("ai_action_plans")
      .upsert(
        {
          user_id: userId,
          plan: plan as never,
          inputs_hash,
          model: ai.model,
        },
        { onConflict: "user_id" },
      );
    if (upsertError) {
      console.error("Cache upsert failed:", upsertError);
    }

    return { ...plan, model: ai.model, cached: false } satisfies AIActionPlan;
  });
