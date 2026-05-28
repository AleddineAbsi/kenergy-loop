-- Phase 4: monitoring readings, public share cards, pricing intents

CREATE TABLE public.energy_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reading_date DATE NOT NULL,
  kwh NUMERIC(10,2) NOT NULL,
  cost_eur NUMERIC(10,2),
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_energy_readings_user_date ON public.energy_readings (user_id, reading_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.energy_readings TO authenticated;
GRANT ALL ON public.energy_readings TO service_role;

ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY readings_select_own ON public.energy_readings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY readings_insert_own ON public.energy_readings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY readings_update_own ON public.energy_readings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY readings_delete_own ON public.energy_readings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_energy_readings_updated_at BEFORE UPDATE ON public.energy_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public share cards (readable by anyone with the slug)
CREATE TABLE public.share_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT,
  savings_eur INTEGER NOT NULL DEFAULT 0,
  kwh_saved INTEGER NOT NULL DEFAULT 0,
  co2_saved_kg INTEGER NOT NULL DEFAULT 0,
  headline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_cards_user ON public.share_cards (user_id);

GRANT SELECT ON public.share_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_cards TO authenticated;
GRANT ALL ON public.share_cards TO service_role;

ALTER TABLE public.share_cards ENABLE ROW LEVEL SECURITY;
-- Public read so /s/:slug works for unauthenticated visitors
CREATE POLICY share_cards_public_select ON public.share_cards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY share_cards_insert_own ON public.share_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY share_cards_update_own ON public.share_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY share_cards_delete_own ON public.share_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_share_cards_updated_at BEFORE UPDATE ON public.share_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pricing intents (waitlist for paid tiers)
CREATE TABLE public.pricing_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_intents_user ON public.pricing_intents (user_id);

GRANT SELECT, INSERT, DELETE ON public.pricing_intents TO authenticated;
GRANT ALL ON public.pricing_intents TO service_role;

ALTER TABLE public.pricing_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_intents_select_own ON public.pricing_intents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pricing_intents_insert_own ON public.pricing_intents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pricing_intents_delete_own ON public.pricing_intents FOR DELETE TO authenticated USING (auth.uid() = user_id);