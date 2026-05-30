// Phase 3 — Real Energy-Saving Plan via Gemini.
//
// generateActionPlan() reads the signed-in user's quick survey + long-form
// answers, asks Gemini for a structured saving plan via
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

const SOURCE_LIBRARY = {
  thermostat: [
    { label: "ENERGY STAR smart thermostats", url: "https://www.energystar.gov/products/smart_thermostats" },
    { label: "Verbraucherzentrale thermostat guidance", url: "https://www.verbraucherzentrale.de/wissen/energie/heizen-und-warmwasser/heizkosten-sparen-thermostat-richtig-einstellen-und-wechseln-7940" },
  ],
  standby: [
    { label: "U.S. DOE standby power reduction", url: "https://www.energy.gov/energysaver/articles/3-easy-tips-reduce-your-standby-power-loads" },
    { label: "European Commission standby/off-mode rules", url: "https://energy-efficient-products.ec.europa.eu/faqs/product-faqs/standby-and-networked-standby-mode-faqs_en" },
  ],
  plugLoad: [
    { label: "U.S. DOE plug load management", url: "https://www.energy.gov/eere/buildings/zeb-technologies-plug-load-management" },
  ],
  appliance: [
    { label: "European Commission energy-efficient products", url: "https://energy-efficient-products.ec.europa.eu/index_en" },
  ],
  default: [
    { label: "U.S. DOE Energy Saver", url: "https://www.energy.gov/energysaver/energy-saver" },
  ],
} satisfies Record<string, AISource[]>;

function sourcesForRecommendation(rec: AIRecommendation): AISource[] {
  const text = `${rec.title} ${rec.description} ${rec.why} ${rec.how_it_works} ${rec.how_to_proceed}`.toLowerCase();
  if (/(thermostat|trv|radiator|heating|heat|temperature|valve)/.test(text)) return SOURCE_LIBRARY.thermostat;
  if (/(standby|idle|always-on|power strip|off mode|networked standby)/.test(text)) return SOURCE_LIBRARY.standby;
  if (/(smart plug|plug load|socket|monitoring plug|power meter)/.test(text)) return SOURCE_LIBRARY.plugLoad;
  if (/(fridge|freezer|dishwasher|washing|dryer|appliance|label|replacement)/.test(text)) return SOURCE_LIBRARY.appliance;
  return SOURCE_LIBRARY.default;
}

function sanitizeRecommendation(rec: AIRecommendation, index: number): AIRecommendation {
  const assumptionBased = /\bassumption:/i.test(`${rec.why} ${rec.how_it_works} ${rec.description}`);
  const cleanSources = (rec.sources ?? []).filter((source) => {
    const label = source.label?.toLowerCase() ?? "";
    const url = source.url?.toLowerCase() ?? "";
    return Boolean(source.url) && /^https?:\/\//.test(source.url ?? "") && !label.includes("kenergy") && !label.includes("internal") && !url.includes("localhost");
  });

  return {
    ...rec,
    confidence: assumptionBased
      ? Math.min(55, Math.max(25, Math.round(rec.confidence || 45)))
      : Math.max(0, Math.min(100, Math.round(rec.confidence || 60))),
    sources: cleanSources.length ? cleanSources.slice(0, 2) : sourcesForRecommendation(rec),
  };
}

function sanitizePlan(plan: AIActionPlan): AIActionPlan {
  return {
    ...plan,
    recommendations: (plan.recommendations ?? []).map(sanitizeRecommendation),
  };
}

const planTool = {
  type: "function" as const,
  function: {
    name: "return_action_plan",
    description:
      "Return a personalized smart-home energy saving plan for the user based on their survey and long-form answers.",
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
                  "External clickable sources only. Cite why the action works or the savings basis: public agency pages, studies, vendor specs, or official guidance. Do not cite Kenergy Loop, internal estimates, user answers, or generic knowledge base text.",
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
      "Complete the 60-second survey to unlock your personalized Energy-Saving Plan.",
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
          ...sanitizePlan(cached.plan as AIActionPlan),
          model: cached.model ?? undefined,
          generated_at: cached.updated_at as string,
          cached: true,
        };
      }
    }

    const ai = getAIConfig();

    const knowledgeText = [
      "TRVs/smart thermostats: 8-20% heating saving when schedules/room setpoints replace manual heating.",
      "Standby waste: smart plugs/strips identify always-on loads; small per device but meaningful together.",
      "Tariff scheduling: heat pumps, EV chargers, dishwasher/washer/dryer can shift load if dynamic tariff exists.",
      "Old fridges/freezers/TVs/servers/pumps can justify replacement when age/noise/heat/high draw is likely.",
      "Renters: prefer reversible actions first; fixed work needs landlord/professional approval.",
    ].join("\n");

const systemPrompt = `Kenergy Loop: European renter energy optimizer. Use EUR/kWh/CO2 assumptions: 0.28 EUR/kWh, 0.22 kg CO2/kWh.
Return only the tool call. Be concise.
Rules: produce every useful recommendation that is justified by the profile, normally 5-9 but more if genuinely helpful. You may add creative assumption-based recommendations for missing data, but every such recommendation must clearly start its why/how text with "Assumption:" and say exactly what it assumes. Never assume against provided data. Assumption-based recommendations must have low confidence, normally 25-55. Explain savings, next step, confidence, and source when available. Sources must be external clickable URLs that support why the action works or the savings basis; never cite Kenergy Loop, internal data, user answers, or the KB text as a source. Prefer reversible renter actions first; hardware work names landlord/electrician/heating technician as needed. Use realistic Matter/Zigbee/Wi-Fi brands for kits only when justified. Sparse data or assumptions => lower confidence/data_quality. Set data_quality=high only when long-form answers, bills, meter readings, or room scan data are present; quick survey alone should be low or medium.`;

    const userPrompt = `KB:${knowledgeText}
survey:${JSON.stringify(survey?.answers ?? {})}
longFormProgress:${longForm?.progress ?? 0}
longForm:${JSON.stringify(longForm?.answers ?? {})}`;


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
        max_tokens: 2500,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("Rate limit reached on the model service — please try again in a minute.");
      }
      if (res.status === 402) {
        throw new Error("model credits exhausted. Add credits in Settings → Workspace → Usage.");
      }
      console.error("Gemini API error:", res.status, text);
      throw new Error(`model gateway failed (${res.status})`);
    }

    const completion = await res.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned:", JSON.stringify(completion).slice(0, 500));
      throw new Error("The model did not return a structured plan");
    }

    let plan: AIActionPlan;
    try {
      plan = sanitizePlan(JSON.parse(toolCall.function.arguments));
    } catch (e) {
      console.error("Bad JSON from model tool call:", e);
      throw new Error("The model returned malformed plan JSON");
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
