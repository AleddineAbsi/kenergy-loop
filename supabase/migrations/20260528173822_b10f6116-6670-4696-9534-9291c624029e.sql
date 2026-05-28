-- Phase 5: room scans + smart kits + room-scans storage bucket

-- 1) room_scans
CREATE TABLE public.room_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_scans TO authenticated;
GRANT ALL ON public.room_scans TO service_role;

ALTER TABLE public.room_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_scans_select_own" ON public.room_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "room_scans_insert_own" ON public.room_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_scans_update_own" ON public.room_scans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_scans_delete_own" ON public.room_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_room_scans_updated_at BEFORE UPDATE ON public.room_scans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) smart_kits (public read by slug, write own)
CREATE TABLE public.smart_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_eur INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smart_kits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_kits TO authenticated;
GRANT ALL ON public.smart_kits TO service_role;

ALTER TABLE public.smart_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_kits_public_select" ON public.smart_kits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "smart_kits_insert_own" ON public.smart_kits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "smart_kits_update_own" ON public.smart_kits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "smart_kits_delete_own" ON public.smart_kits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_smart_kits_updated_at BEFORE UPDATE ON public.smart_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) room-scans storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('room-scans', 'room-scans', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "room_scans_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'room-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "room_scans_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'room-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "room_scans_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'room-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "room_scans_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'room-scans' AND auth.uid()::text = (storage.foldername(name))[1]);