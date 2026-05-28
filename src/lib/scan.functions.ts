// Phase 5 — Scan-a-Room AI (real vision + consumption modeling).
//
// analyzeRoomScan() takes the storage path of an uploaded room photo,
// signs a temporary URL, asks the Lovable AI Gateway (Gemini vision model)
// to identify appliances / heating / windows AND estimate annual kWh use,
// usage patterns, and where this household lands vs the German distribution.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

export type DetectedAppliance = {
  name: string;
  category:
    | "lighting"
    | "heating"
    | "cooling"
    | "entertainment"
    | "kitchen"
    | "standby"
    | "other";
  est_standby_w: number;
  est_active_w?: number;
  est_hours_per_day?: number;
  est_kwh_per_year?: number;
  notes?: string;
  // New: identification confidence & brand/model research
  detection_confidence: number; // 0-100, how sure the model is about WHAT the object is
  brand?: string;
  model?: string;
  brand_confidence?: number; // 0-100, how sure about brand/model identification
  consumption_source?: string; // human-readable source if brand/model known (e.g. "HP Omen 16 spec sheet")
  consumption_source_url?: string;
};

export type RoomAnalysis = {
  room_type: string;
  building_type?: string; // e.g. "modern apartment", "older single-family house"
  has_ac?: boolean;
  appliances: DetectedAppliance[];
  heating_points: number;
  windows: number;
  est_score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  top_action: string;
  notes: string;
  est_room_kwh_per_year: number;
  est_household_kwh_per_year: number;
  usage_pattern: string;
  germany_percentile: number;
  germany_band: string;
  germany_context: string;
  sources: { label: string; url?: string }[];
};

const scanTool = {
  type: "function" as const,
  function: {
    name: "return_room_analysis",
    description:
      "Identify appliances, estimate annual energy use, and rank against the German distribution.",
    parameters: {
      type: "object",
      properties: {
        room_type: { type: "string" },
        building_type: { type: "string" },
        has_ac: { type: "boolean" },
        heating_points: { type: "number" },
        windows: { type: "number" },
        est_score: { type: "number" },
        grade: { type: "string", enum: ["A", "B", "C", "D", "E", "F", "G"] },
        top_action: { type: "string" },
        notes: { type: "string" },
        est_room_kwh_per_year: { type: "number" },
        est_household_kwh_per_year: { type: "number" },
        usage_pattern: { type: "string" },
        germany_percentile: { type: "number" },
        germany_band: { type: "string" },
        germany_context: { type: "string" },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
            required: ["label"],
          },
        },
        appliances: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: {
                type: "string",
                enum: ["lighting", "heating", "cooling", "entertainment", "kitchen", "standby", "other"],
              },
              detection_confidence: { type: "number" },
              brand: { type: "string" },
              model: { type: "string" },
              brand_confidence: { type: "number" },
              est_standby_w: { type: "number" },
              est_active_w: { type: "number" },
              est_hours_per_day: { type: "number" },
              est_kwh_per_year: { type: "number" },
              consumption_source: { type: "string" },
              consumption_source_url: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name", "category", "detection_confidence", "est_standby_w"],
          },
        },
      },
      required: [
        "room_type",
        "heating_points",
        "windows",
        "est_score",
        "grade",
        "top_action",
        "notes",
        "appliances",
        "est_room_kwh_per_year",
        "est_household_kwh_per_year",
        "usage_pattern",
        "germany_percentile",
        "germany_band",
        "germany_context",
        "sources",
      ],
    },
  },
};

export const analyzeRoomScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      image_path: z.string().min(1).max(512),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.image_path.startsWith(`${userId}/`)) {
      throw new Error("Invalid image path.");
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("room-scans")
      .createSignedUrl(data.image_path, 60);
    if (signErr || !signed?.signedUrl) {
      throw new Error("Could not access the uploaded image.");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Kenergy's room-vision and energy-benchmarking assistant for German households.

For the photo provided:
1. Infer the building_type (e.g. "modern apartment", "older single-family house", "student dorm", "office") from visible cues — window frames, ceiling height, radiator style, wall finishes, floor type. Set has_ac true ONLY if you actually see an AC unit (split, portable, or window).
2. Identify EVERY visible appliance, light source, heating point and window. For each, set detection_confidence (0-100) — be honest: "gaming laptop" is often only 60-75% certain vs "laptop".
3. For each appliance: if you can read a logo or recognize a distinctive shape, set brand (and model only if you are highly confident — read from labels or unmistakable design). Set brand_confidence 0-100. ONLY fill brand/model when brand_confidence >= 60. When unsure, leave them empty.
4. When brand_confidence >= 60, base est_active_w / est_standby_w / est_kwh_per_year on the actual spec sheet for that model (your training data on real products), and fill consumption_source (e.g. "HP Omen 16 spec sheet", "Samsung RB37 EU energy label") and consumption_source_url with the most authoritative public source you know (manufacturer spec page, EU EPREL energy label, Stiftung Warentest test report). When brand is unknown, use generic German averages and LEAVE consumption_source empty — do NOT invent sources.
5. Infer the usage_pattern from visible cues (many screens = evening entertainment load; many standby LEDs = always-on standby; incandescent bulbs; thin window seals; old radiators).
6. Extrapolate est_household_kwh_per_year conservatively from the visible room.
7. Rank against Stromspiegel: 1-person flat ~1300-2000 kWh/yr good, 2500+ high; 2-person ~2000-3000 good; 3-person ~2800-3800 good; 4-person ~3500-5000 good. LOWER germany_percentile = greener (1 = top 1%).
8. Give a friendly germany_band like "Top 10% — greener than 90% of comparable German households".
9. Cite Stromspiegel.de / BDEW / Umweltbundesamt in the top-level sources array.

NEVER fabricate a source URL. If unsure, omit the URL. Be conservative when the photo is unclear and explain assumptions in notes. ALWAYS reply by calling return_room_analysis.`;

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this room: detect appliances + consumption, infer usage pattern, and tell me where this household lands in the German distribution.",
              },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        tools: [scanTool],
        tool_choice: { type: "function", function: { name: "return_room_analysis" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached on the AI service — please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      console.error("Vision gateway error:", res.status, text);
      throw new Error(`AI gateway failed (${res.status})`);
    }

    const completion = await res.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return a structured analysis.");
    }

    let analysis: RoomAnalysis;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI returned malformed analysis JSON.");
    }

    const { data: inserted, error: insErr } = await supabase
      .from("room_scans")
      .insert({
        user_id: userId,
        image_path: data.image_path,
        analysis: analysis as never,
        model: MODEL,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("room_scans insert failed:", insErr);
      throw new Error("Could not save scan.");
    }

    return { id: inserted.id as string, analysis, model: MODEL };
  });
