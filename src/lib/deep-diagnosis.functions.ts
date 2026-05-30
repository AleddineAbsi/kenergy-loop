// Deep (paid) Energy Check: extends the regular saving plan with concrete
// product picks and an interoperable ecosystem kit. History is kept so old
// diagnoses can be viewed without re-running the check.
import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeDiagnosisCredit } from "./access.functions";

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

export type ProductTier = "budget" | "balanced" | "integrated";
export type ProductPick = {
  id: string;
  category: string;
  tier: ProductTier;
  name: string;
  brand_examples: string;
  price_eur: number;
  why: string;
  api_capability: string; // "Matter | Zigbee | Local API | Cloud webhook | None"
  dashboard_ready: boolean;
  product_url?: string;
  sponsored?: boolean;
};

export type EcosystemKit = {
  name: string;
  description: string;
  hub: string;
  items: ProductPick[];
  total_eur: number;
  interoperability: string;
};

export type DeepRecommendedAction = {
  id: string;
  title: string;
  category: "do_now" | "small_helper" | "monitor" | "add_info" | "needs_landlord" | "needs_technician" | "product";
  effort: "easy" | "medium" | "hard";
  savings_eur_per_year: number;
  confidence: number;
  why: string;
  how_it_works: string;
  how_to_proceed: string;
  requires_landlord: boolean;
  requires_technician: boolean;
  product?: ProductPick;
  sources?: Array<{ label: string; url?: string }>;
};

export type EcosystemPack = {
  id: string;
  name: string;
  solves_action_ids: string[];
  description: string;
  total_eur: number;
  yearly_savings_eur: number;
  items: ProductPick[];
  vendor_url?: string;
};

export type DeepDiagnosisPlan = {
  summary: string;
  yearly_savings_eur: number;
  yearly_kwh: number;
  energy_score: number;
  grade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  goal_alignment: string;
  product_picks: ProductPick[];
  ecosystem_kit: EcosystemKit | null;
  recommended_actions?: DeepRecommendedAction[];
  ecosystem_packs?: EcosystemPack[];
  next_steps: string[];
  data_quality: "low" | "medium" | "high";
  model?: string;
  generated_at?: string;
};

export type DeepDiagnosisRecord = {
  id: string;
  created_at: string;
  inputs_hash: string;
  notes: string | null;
  plan: DeepDiagnosisPlan;
};

const diagnosisTool = {
  type: "function" as const,
  function: {
    name: "return_deep_diagnosis",
    description: "Return a paid in-depth Energy Report with concrete product picks and an interoperable ecosystem kit.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        yearly_savings_eur: { type: "number" },
        yearly_kwh: { type: "number" },
        energy_score: { type: "number" },
        grade: { type: "string", enum: ["A", "B", "C", "D", "E", "F", "G"] },
        goal_alignment: { type: "string", description: "How the plan matches the user's stated goal (cost/CO2/comfort)." },
        data_quality: { type: "string", enum: ["low", "medium", "high"] },
        next_steps: { type: "array", items: { type: "string" } },
        recommended_actions: {
          type: "array",
          description:
            "Ranked saving plan sorted from least friction to most friction. Include DIY actions, product actions, at least one landlord approval action, and at least one technician action for the demo.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              category: {
                type: "string",
                enum: ["do_now", "small_helper", "monitor", "add_info", "needs_landlord", "needs_technician", "product"],
              },
              effort: { type: "string", enum: ["easy", "medium", "hard"] },
              savings_eur_per_year: { type: "number" },
              confidence: { type: "number", description: "0-100. Assumption-heavy landlord/product/technician demo actions should be lower confidence." },
              why: { type: "string" },
              how_it_works: { type: "string" },
              how_to_proceed: { type: "string" },
              requires_landlord: { type: "boolean" },
              requires_technician: { type: "boolean" },
              product: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  category: { type: "string" },
                  tier: { type: "string", enum: ["budget", "balanced", "integrated"] },
                  name: { type: "string" },
                  brand_examples: { type: "string" },
                  price_eur: { type: "number" },
                  why: { type: "string" },
                  api_capability: { type: "string" },
                  dashboard_ready: { type: "boolean" },
                  product_url: { type: "string" },
                  sponsored: { type: "boolean" },
                },
              },
              sources: {
                type: "array",
                description: "Only sources needed for this specific action. Use external public sources, not internal Kenergy Loop context.",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["label"],
                },
              },
            },
            required: [
              "id",
              "title",
              "category",
              "effort",
              "savings_eur_per_year",
              "confidence",
              "why",
              "how_it_works",
              "how_to_proceed",
              "requires_landlord",
              "requires_technician",
            ],
          },
        },
        product_picks: {
          type: "array",          description:
            "Concrete product picks. Group across tiers: budget (cheapest viable), balanced (best value), integrated (works inside an open ecosystem like Matter / Home Assistant). Only include picks that are genuinely useful for THIS user.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              category: { type: "string", description: "e.g. thermostat, smart plug, EV charger, monitor." },
              tier: { type: "string", enum: ["budget", "balanced", "integrated"] },
              name: { type: "string" },
              brand_examples: { type: "string" },
              price_eur: { type: "number" },
              why: { type: "string" },
              api_capability: { type: "string", description: "Matter | Zigbee | Local API | Cloud webhook | None." },
              dashboard_ready: { type: "boolean", description: "True if it exposes data we can later plot in the Kenergy Loop dashboard." },
              product_url: { type: "string", description: "Vendor, manufacturer, or search URL for the product." },
              sponsored: { type: "boolean", description: "True when this is a demo sponsored product suggestion." },
            },
            required: ["id", "category", "tier", "name", "brand_examples", "price_eur", "why", "api_capability", "dashboard_ready"],          },
        },
        ecosystem_kit: {
          type: "object",          description: "Optional bundle of devices that talk to each other (e.g. all Matter, or all on one hub) so the user can later see them in one dashboard. Skip when not justified.",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            hub: { type: "string", description: "Coordinating hub or protocol (Matter, Home Assistant Green, Hue Bridge, etc.)." },
            interoperability: { type: "string", description: "One sentence on how the devices communicate." },
            total_eur: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  category: { type: "string" },
                  tier: { type: "string", enum: ["budget", "balanced", "integrated"] },
                  name: { type: "string" },
                  brand_examples: { type: "string" },
                  price_eur: { type: "number" },
                  why: { type: "string" },
                  api_capability: { type: "string" },
                  dashboard_ready: { type: "boolean" },
                  product_url: { type: "string" },
                  sponsored: { type: "boolean" },
                },
                required: ["id", "category", "tier", "name", "brand_examples", "price_eur", "why", "api_capability", "dashboard_ready"],              },
            },
          },
          required: ["name", "description", "hub", "interoperability", "total_eur", "items"],        },
        ecosystem_packs: {
          type: "array",
          description:
            "Bundles that solve multiple recommended_actions together. Each pack should reference the action ids it solves and include vendor links when possible.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              solves_action_ids: { type: "array", items: { type: "string" } },
              description: { type: "string" },
              total_eur: { type: "number" },
              yearly_savings_eur: { type: "number" },
              vendor_url: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    category: { type: "string" },
                    tier: { type: "string", enum: ["budget", "balanced", "integrated"] },
                    name: { type: "string" },
                    brand_examples: { type: "string" },
                    price_eur: { type: "number" },
                    why: { type: "string" },
                    api_capability: { type: "string" },
                    dashboard_ready: { type: "boolean" },
                    product_url: { type: "string" },
                    sponsored: { type: "boolean" },
                  },
                },
              },
            },
            required: ["id", "name", "solves_action_ids", "description", "total_eur", "yearly_savings_eur", "items"],
          },
        },
      },
      required: [
        "summary",
        "yearly_savings_eur",
        "yearly_kwh",
        "energy_score",
        "grade",
        "goal_alignment",
        "data_quality",
        "next_steps",
        "product_picks",
      ],    },
  },
};

function hashInputs(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export const generateDeepDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ notes: z.string().max(2000).optional() }).optional())
  .handler(async ({ data, context }): Promise<DeepDiagnosisRecord> => {
    const { supabase, userId } = context;
    const notes = data?.notes ?? "";

    const [{ data: survey }, { data: longForm }, { data: uploads }] = await Promise.all([
      supabase.from("survey_responses").select("answers").eq("user_id", userId).maybeSingle(),
      supabase.from("long_form_responses").select("answers, progress").eq("user_id", userId).maybeSingle(),
      supabase.from("long_form_uploads").select("kind, label, notes").eq("user_id", userId),
    ]);

    // Check + consume a credit (admin/paid bypass via has_role; we still
    // require an entitlement row for free users — RLS prevents inserts so
    // this fails cleanly).
    const ok = await consumeDiagnosisCredit(supabase, userId);
    if (!ok) {
      // Check role fallback for admin/paid which may not have credits row.
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isPrivileged = (roles ?? []).some((r) => r.role === "admin" || r.role === "paid");
      if (!isPrivileged) {
        throw new Error("No analysis credit available. Purchase a Deep Analysis to continue.");
      }
    }

    const ai = getAIConfig();

    const systemPrompt = `You are Kenergy Loop Deep, an in-depth energy consultant for European homes (EUR, kWh, ~0.30 EUR/kWh, ~0.22 kg CO2/kWh).
Always reply through the return_deep_diagnosis tool.

Create a ranked recommended_actions list as the main output, using the same structure as the quick survey but richer:
- Sort from least friction to most friction: do_now, small_helper, monitor, add_info, needs_landlord, needs_technician. Product-buy actions can sit in small_helper or product.
- Return 8-12 actions when possible.
- For pitch/demo visibility, include at least one landlord approval action, one technician action, and two concrete product-buy actions even if confidence is low.
- Include at least one add_info action with the exact missing information to ask for (bill amount, meter reading, appliance nameplate, tariff, room size, landlord contact, etc.).
- Never contradict user-provided facts. If you infer something, start the why/how_to_proceed with "Assumption:" and keep confidence low (35-58).
- Put concrete product suggestions directly inside the relevant action.product. Use product_url when you know a manufacturer/vendor/search URL. Mark one tasteful sponsored=true demo suggestion if useful.
- Sources must be external public links only, and only the sources necessary for that specific action. Do not cite internal Kenergy Loop/user data as a source.
- Build ecosystem_packs from action ids: a pack should solve multiple actions together, list items, total price, yearly_savings_eur, and a vendor/search link.
- api_capability must reflect reality (Matter, Zigbee, Local API, Cloud webhook, None).
- dashboard_ready=true means the device exposes data we can later plot in the Kenergy Loop dashboard.
- data_quality reflects how much info you actually got. Be honest.`;

    const userPrompt = JSON.stringify({
      survey: survey?.answers ?? {},
      long_form_progress: longForm?.progress ?? 0,
      long_form: longForm?.answers ?? {},
      uploads: uploads ?? [],
      notes: notes || "(none)",
    });

    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [diagnosisTool],
        tool_choice: { type: "function", function: { name: "return_deep_diagnosis" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Model rate limit — please retry in a minute.");
      if (res.status === 402) throw new Error("model credits exhausted. Add credits in Settings → Workspace → Usage.");
      console.error("model gateway error", res.status, text);
      throw new Error(`model gateway failed (${res.status})`);
    }

    const completion = await res.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("The model did not return a structured Energy Report");

    let plan: DeepDiagnosisPlan;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("The model returned malformed JSON");
    }
    plan.model = ai.model;
    plan.generated_at = new Date().toISOString();

    const inputs_hash = hashInputs([survey?.answers, longForm?.answers, uploads, notes]);

    const { data: inserted, error } = await supabase
      .from("deep_diagnoses")
      .insert({
        user_id: userId,
        plan: plan as never,
        inputs_hash,
        notes: notes || null,
        model: ai.model,
      })
      .select("id, created_at, inputs_hash, notes, plan")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to save Energy Report");

    return {
      id: inserted.id,
      created_at: inserted.created_at as string,
      inputs_hash: inserted.inputs_hash,
      notes: inserted.notes,
      plan: inserted.plan as DeepDiagnosisPlan,
    };
  });

export const listMyDiagnoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeepDiagnosisRecord[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("deep_diagnoses")
      .select("id, created_at, inputs_hash, notes, plan")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at as string,
      inputs_hash: r.inputs_hash,
      notes: r.notes,
      plan: r.plan as DeepDiagnosisPlan,
    }));
  });
