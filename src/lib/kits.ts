// Client helpers for smart_kits (save + read).
import { supabase } from "@/integrations/supabase/client";

export type KitItem = {
  name: string;
  qty: number;
  brand_examples: string;
  price_each_eur: number;
  why: string;
};

export type SmartKit = {
  id: string;
  slug: string;
  headline: string | null;
  items: KitItem[];
  subtotal_eur: number;
  created_at: string;
};

function makeSlug() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

export async function saveKit(input: {
  items: KitItem[];
  headline?: string | null;
}): Promise<SmartKit> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save a kit.");
  const subtotal = Math.round(
    input.items.reduce((s, i) => s + i.qty * i.price_each_eur, 0),
  );
  const slug = makeSlug();
  const { data, error } = await supabase
    .from("smart_kits")
    .insert({
      user_id: user.id,
      slug,
      headline: input.headline ?? null,
      items: input.items as never,
      subtotal_eur: subtotal,
    })
    .select("id, slug, headline, items, subtotal_eur, created_at")
    .single();
  if (error) throw error;
  return data as unknown as SmartKit;
}

export async function getKitBySlug(slug: string): Promise<SmartKit | null> {
  const { data, error } = await supabase
    .from("smart_kits")
    .select("id, slug, headline, items, subtotal_eur, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SmartKit) ?? null;
}
