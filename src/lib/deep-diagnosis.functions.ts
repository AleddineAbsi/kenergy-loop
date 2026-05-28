// Deep (paid) AI diagnosis: extends the regular action plan with concrete
// product picks and an interoperable ecosystem kit. History is kept so old
// diagnoses can be viewed without re-running the AI.
import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeDiagnosisCredit } from "./access.functions";

const MODEL = "google/gemini-3-flash-preview";

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
};

export type EcosystemKit = {
  name: string;
  description: string;
  hub: string;
  items: ProductPick[];
  total_eur: number;
  interoperability: string;
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
    description: "Return a paid in-depth energy diagnosis with concrete product picks and an interoperable ecosystem kit.",
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
        next_steps: { type: "array", items: { type: "string" }, maxItems: 6 },
        product_picks: {
          type: "array",
          maxItems: 12,
          description:
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
              dashboard_ready: { type: "boolean", description: "True if it exposes data we can later plot in the Kenergy dashboard." },
            },
            required: ["id", "category", "tier", "name", "brand_examples", "price_eur", "why", "api_capability", "dashboard_ready"],
            additionalProperties: false,
          },
        },
        ecosystem_kit: {
          type: "object",
          nullable: true,
          description: "Optional bundle of devices that talk to each other (e.g. all Matter, or all on one hub) so the user can later see them in one dashboard. Skip when not justified.",
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
                },
                required: ["id", "category", "tier", "name", "brand_examples", "price_eur", "why", "api_capability", "dashboard_ready"],
                additionalProperties: false,
              },
            },
          },
          required: ["name", "description", "hub", "interoperability", "total_eur", "items"],
          additionalProperties: false,
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
      ],
      additionalProperties: false,
    },
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
        throw new Error("No diagnosis credit available. Purchase a Deep Analysis to continue.");
      }
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are Kenergy Deep, an in-depth AI energy diagnostic for European homes (EUR, kWh, ~0.30 €/kWh, ~0.22 kg CO2/kWh).
You have access to: the quick survey, the long-form profile, a list of uploaded bills/appliance photos (filename labels only), and free-form user notes.
Produce ONLY genuinely useful, ranked product picks. NEVER pad categories. Always reply via the return_deep_diagnosis tool.

Rules:
- Tier each pick clearly: budget (cheapest viable), balanced (best €/€ saved), integrated (works in an open ecosystem we can later plot in the Kenergy dashboard).
- Ecosystem kit: ONLY include if devices truly interoperate (Matter, Home Assistant Green + Zigbee2MQTT, Hue Bridge, AVM FRITZ!Box, etc.). Otherwise return null.
- api_capability must reflect reality (Matter, Zigbee, Local API, Cloud webhook, None).
- dashboard_ready=true means the device exposes data we can poll/subscribe to later. Be honest.
- Align next_steps with the user's stated GOAL (cost vs CO2 vs comfort) and honor any preferences from the notes.
- data_quality reflects how much info you actually got — be honest.`;

    const userPrompt = `Survey:\n${JSON.stringify(survey?.answers ?? {}, null, 2)}\n\nLong-form profile (${longForm?.progress ?? 0}%):\n${JSON.stringify(longForm?.answers ?? {}, null, 2)}\n\nUploads:\n${JSON.stringify(uploads ?? [], null, 2)}\n\nUser notes:\n${notes || "(none)"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
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
      if (res.status === 429) throw new Error("AI rate limit — please retry in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      console.error("AI gateway error", res.status, text);
      throw new Error(`AI gateway failed (${res.status})`);
    }

    const completion = await res.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("AI did not return a structured diagnosis");

    let plan: DeepDiagnosisPlan;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI returned malformed JSON");
    }
    plan.model = MODEL;
    plan.generated_at = new Date().toISOString();

    const inputs_hash = hashInputs([survey?.answers, longForm?.answers, uploads, notes]);

    const { data: inserted, error } = await supabase
      .from("deep_diagnoses")
      .insert({
        user_id: userId,
        plan: plan as never,
        inputs_hash,
        notes: notes || null,
        model: MODEL,
      })
      .select("id, created_at, inputs_hash, notes, plan")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to save diagnosis");

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
