// Phase 4 client helpers: energy readings, share cards, pricing intents.
// All scoped by RLS to auth.uid() — except share_cards which are public-read.
import { supabase } from "@/integrations/supabase/client";

// ---------- Energy readings ----------

export type EnergyReading = {
  id: string;
  reading_date: string; // YYYY-MM-DD
  kwh: number;
  cost_eur: number | null;
  source: string;
  note: string | null;
};

export async function listReadings(): Promise<EnergyReading[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("energy_readings")
    .select("id, reading_date, kwh, cost_eur, source, note")
    .eq("user_id", user.id)
    .order("reading_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EnergyReading[];
}

export async function addReading(input: {
  reading_date: string;
  kwh: number;
  cost_eur?: number | null;
  source?: string;
  note?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to log a reading.");
  const { error } = await supabase.from("energy_readings").insert({
    user_id: user.id,
    reading_date: input.reading_date,
    kwh: input.kwh,
    cost_eur: input.cost_eur ?? null,
    source: input.source ?? "manual",
    note: input.note ?? null,
  });
  if (error) throw error;
}

export async function deleteReading(id: string) {
  const { error } = await supabase.from("energy_readings").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Share cards (public read) ----------

export type ShareCard = {
  id: string;
  slug: string;
  display_name: string | null;
  savings_eur: number;
  kwh_saved: number;
  co2_saved_kg: number;
  headline: string | null;
  created_at: string;
};

function makeSlug() {
  // 8-char URL-safe slug; collision probability is negligible for our scale.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

export async function createShareCard(input: {
  savings_eur: number;
  kwh_saved: number;
  co2_saved_kg: number;
  headline?: string | null;
  display_name?: string | null;
}): Promise<ShareCard> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to create a share card.");
  const slug = makeSlug();
  const { data, error } = await supabase
    .from("share_cards")
    .insert({
      user_id: user.id,
      slug,
      display_name: input.display_name ?? null,
      savings_eur: Math.round(input.savings_eur),
      kwh_saved: Math.round(input.kwh_saved),
      co2_saved_kg: Math.round(input.co2_saved_kg),
      headline: input.headline ?? null,
    })
    .select("id, slug, display_name, savings_eur, kwh_saved, co2_saved_kg, headline, created_at")
    .single();
  if (error) throw error;
  return data as ShareCard;
}

export async function getShareCardBySlug(slug: string): Promise<ShareCard | null> {
  const { data, error } = await supabase
    .from("share_cards")
    .select("id, slug, display_name, savings_eur, kwh_saved, co2_saved_kg, headline, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as ShareCard) ?? null;
}

// ---------- Pricing intents ----------

export async function recordPricingIntent(tier: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to join the waitlist.");
  const { error } = await supabase.from("pricing_intents").insert({
    user_id: user.id,
    tier,
  });
  if (error) throw error;
}
