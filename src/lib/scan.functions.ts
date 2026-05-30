import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type DetectedAppliance = {
  name: string;
  category:
    | "lighting"
    | "heating"
    | "cooling"
    | "entertainment"
    | "kitchen"
    | "standby"
    | "office"
    | "laundry"
    | "other";
  detection_confidence: number;
  brand?: string;
  model?: string;
  brand_confidence?: number;
  est_standby_w: number;
  est_active_w?: number;
  est_hours_per_day?: number;
  est_kwh_per_year?: number;
  consumption_basis: "visible_label" | "known_product" | "generic_average" | "rough_assumption";
  consumption_source?: string;
  consumption_source_url?: string;
  notes?: string;
};

export type RoomAnalysis = {
  room_type: string;
  building_type: string;
  building_confidence: number;
  has_ac: boolean;
  ac_confidence: number;
  heating_points: number;
  windows: number;
  est_score: number;
  grade: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  top_action: string;
  notes: string;
  est_room_kwh_per_year: number;
  est_household_kwh_per_year: number;
  usage_pattern: string;
  germany_percentile: number;
  germany_band: string;
  germany_context: string;
  appliances: DetectedAppliance[];
  assumptions: string[];
  missing_information: string[];
  sources: { label: string; url?: string }[];
};

function configuredModels() {
  const fromEnv = process.env.KENERGY_AI_MODEL
    ? process.env.KENERGY_AI_MODEL.split(",").map((model) => model.trim()).filter(Boolean)
    : [DEFAULT_MODEL];

  return [...fromEnv, ...FALLBACK_MODELS].filter((model, index, models) => models.indexOf(model) === index);
}

async function signedImageToInlineData(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load signed room image (${res.status}).`);

  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > 14 * 1024 * 1024) {
    throw new Error("Image is too large for inline Gemini analysis. Use a smaller photo under 10 MB.");
  }

  return { mimeType, data: bytes.toString("base64") };
}

function fallbackRoomAnalysis(reason: string): RoomAnalysis {
  return {
    room_type: "Room scan",
    building_type: "Unknown from photo",
    building_confidence: 20,
    has_ac: false,
    ac_confidence: 25,
    heating_points: 0,
    windows: 1,
    est_score: 58,
    grade: "C",
    top_action: "Retry the scan or add usage hours to improve the estimate.",
    notes: `Gemini could not complete the room analysis (${reason}). This fallback keeps the demo flow working, but it is not a real vision result or meter reading.`,
    est_room_kwh_per_year: 120,
    est_household_kwh_per_year: 1900,
    usage_pattern: "Conservative fallback based on a typical renter room with moderate appliance use.",
    germany_percentile: 50,
    germany_band: "Middle range - typical for comparable German households",
    germany_context: "This benchmark is intentionally conservative because the image analysis was unavailable.",
    appliances: [
      {
        name: "Unverified room appliance load",
        category: "other",
        detection_confidence: 30,
        est_standby_w: 8,
        est_active_w: 80,
        est_hours_per_day: 3,
        est_kwh_per_year: 95,
        consumption_basis: "rough_assumption",
        notes: "Fallback estimate only. Run the room scan again for object-level detection.",
      },
      {
        name: "Room lighting",
        category: "lighting",
        detection_confidence: 30,
        est_standby_w: 0,
        est_active_w: 12,
        est_hours_per_day: 4,
        est_kwh_per_year: 18,
        consumption_basis: "generic_average",
        notes: "Assumes efficient LED lighting until the photo is analyzed.",
      },
    ],
    assumptions: ["No reliable object detection was available.", "Consumption numbers use generic renter-room ranges."],
    missing_information: ["usage hours", "electricity bill", "room size", "clearer photo"],
    sources: [
      { label: "Stromspiegel household electricity benchmark" },
      { label: "Umweltbundesamt electricity-saving guidance" },
    ],
  };
}

function clampAnalysis(input: Partial<RoomAnalysis>): RoomAnalysis {
  const fallback = fallbackRoomAnalysis("incomplete Gemini response");
  const appliances = Array.isArray(input.appliances) ? input.appliances : [];

  return {
    ...fallback,
    ...input,
    room_type: input.room_type || fallback.room_type,
    building_type: input.building_type || fallback.building_type,
    building_confidence: Math.max(0, Math.min(100, Math.round(input.building_confidence ?? fallback.building_confidence))),
    ac_confidence: Math.max(0, Math.min(100, Math.round(input.ac_confidence ?? fallback.ac_confidence))),
    est_score: Math.max(0, Math.min(100, Math.round(input.est_score ?? fallback.est_score))),
    germany_percentile: Math.max(1, Math.min(99, Math.round(input.germany_percentile ?? fallback.germany_percentile))),
    heating_points: Math.max(0, Math.round(input.heating_points ?? fallback.heating_points)),
    windows: Math.max(0, Math.round(input.windows ?? fallback.windows)),
    appliances: appliances.map((item) => ({
      name: item.name || "Unknown visible object",
      category: item.category || "other",
      detection_confidence: Math.max(0, Math.min(100, Math.round(item.detection_confidence ?? 0))),
      brand: item.brand,
      model: item.model,
      brand_confidence: item.brand_confidence == null ? undefined : Math.max(0, Math.min(100, Math.round(item.brand_confidence))),
      est_standby_w: Math.max(0, Math.round(item.est_standby_w ?? 0)),
      est_active_w: item.est_active_w == null ? undefined : Math.max(0, Math.round(item.est_active_w)),
      est_hours_per_day: item.est_hours_per_day == null ? undefined : Math.max(0, Number(item.est_hours_per_day.toFixed?.(1) ?? item.est_hours_per_day)),
      est_kwh_per_year: item.est_kwh_per_year == null ? undefined : Math.max(0, Math.round(item.est_kwh_per_year)),
      consumption_basis: item.consumption_basis || "generic_average",
      consumption_source: item.consumption_source,
      consumption_source_url: item.consumption_source_url,
      notes: item.notes,
    })),
    assumptions: Array.isArray(input.assumptions) ? input.assumptions : fallback.assumptions,
    missing_information: Array.isArray(input.missing_information) ? input.missing_information : fallback.missing_information,
    sources: Array.isArray(input.sources) ? input.sources : fallback.sources,
  };
}

function parseGeminiText(json: unknown): string | null {
  const parts = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts;
  return parts?.map((part) => part.text ?? "").join("").trim() || null;
}

function stripJsonFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

const prompt = `Analyze this renter room photo for Kenergy Loop.

Return one JSON object only. Do not wrap it in markdown.

Goal:
- Detect visible appliances, machines, screens, lights, heating/cooling devices, windows, radiators, chargers, standby loads, and obvious energy clues.
- Estimate rough annual kWh for each detected machine from visible evidence.
- Infer room type, building type, window/heating situation, and whether AC is visible.
- Produce a visible energy score from 0 to 100 where higher means more energy-heavy.
- Compare conservatively against German household electricity context.

Rules:
- A photo is not a meter reading. Say that in notes.
- Every detected object needs detection_confidence from 0 to 100.
- If the exact brand/model is readable or visually unmistakable, fill brand/model and brand_confidence.
- Only add a product-specific consumption_source or URL if brand_confidence is at least 80 and you know a real authoritative source. Do not invent URLs.
- If brand/model is uncertain, leave brand/model blank and use generic averages.
- Prefer useful estimates over false precision. Use realistic ranges collapsed into one conservative number.
- Include assumptions and missing_information so the user knows how to improve accuracy.

JSON shape:
{
  "room_type": "bedroom | living room | kitchen | office | dorm | unknown",
  "building_type": "short visible inference",
  "building_confidence": 0,
  "has_ac": false,
  "ac_confidence": 0,
  "heating_points": 0,
  "windows": 0,
  "est_score": 0,
  "grade": "A",
  "top_action": "single most useful action",
  "notes": "honest caveat and concise explanation",
  "est_room_kwh_per_year": 0,
  "est_household_kwh_per_year": 0,
  "usage_pattern": "visible pattern inference",
  "germany_percentile": 50,
  "germany_band": "plain English benchmark",
  "germany_context": "why this percentile is only an estimate",
  "appliances": [
    {
      "name": "object name",
      "category": "lighting | heating | cooling | entertainment | kitchen | standby | office | laundry | other",
      "detection_confidence": 0,
      "brand": "optional",
      "model": "optional",
      "brand_confidence": 0,
      "est_standby_w": 0,
      "est_active_w": 0,
      "est_hours_per_day": 0,
      "est_kwh_per_year": 0,
      "consumption_basis": "visible_label | known_product | generic_average | rough_assumption",
      "consumption_source": "optional real source name",
      "consumption_source_url": "optional real URL",
      "notes": "why this estimate applies"
    }
  ],
  "assumptions": [],
  "missing_information": [],
  "sources": [{"label": "source label", "url": "optional real URL"}]
}`;

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
      throw new Error("Could not access the uploaded image. Check that the room-scans storage bucket exists.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let analysis: RoomAnalysis = fallbackRoomAnalysis("analysis did not start");
    let modelForRow = "fallback-local";

    if (!apiKey) {
      analysis = fallbackRoomAnalysis("GEMINI_API_KEY is not configured");
    } else {
      const inline = await signedImageToInlineData(signed.signedUrl);
      let lastError = "";

      for (const model of configuredModels()) {
        const res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inline_data: {
                      mime_type: inline.mimeType,
                      data: inline.data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        });

        const bodyText = await res.text();
        if (!res.ok) {
          lastError = `${res.status}: ${bodyText.slice(0, 800)}`;
          console.error("Gemini native scan failed:", model, lastError);
          if (![429, 500, 502, 503, 504].includes(res.status)) break;
          continue;
        }

        try {
          const body = JSON.parse(bodyText);
          const text = parseGeminiText(body);
          if (!text) throw new Error("No JSON text returned");
          analysis = clampAnalysis(JSON.parse(stripJsonFence(text)) as Partial<RoomAnalysis>);
          modelForRow = model;
          lastError = "";
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Could not parse Gemini JSON";
          console.error("Gemini scan parse failed:", model, lastError, bodyText.slice(0, 800));
          continue;
        }
      }

      if (!lastError) {
        // analysis was set by the successful branch above.
      } else {
        analysis = fallbackRoomAnalysis(lastError);
        modelForRow = "fallback-local";
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("room_scans")
      .insert({
        user_id: userId,
        image_path: data.image_path,
        analysis: analysis as never,
        model: modelForRow,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("room_scans insert failed:", insErr);
      throw new Error("Could not save scan. Check the room_scans table and RLS policies.");
    }

    return { id: inserted.id as string, analysis, model: modelForRow };
  });
