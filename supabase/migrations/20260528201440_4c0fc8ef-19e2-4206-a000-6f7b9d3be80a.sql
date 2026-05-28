
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'paid', 'free');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_own
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Entitlements (one-time purchases)
CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product text NOT NULL,
  source text NOT NULL DEFAULT 'purchase',
  credits_remaining integer NOT NULL DEFAULT 1,
  granted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entitlements_user_product_idx ON public.entitlements (user_id, product);

GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY entitlements_select_own
  ON public.entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _product text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements
    WHERE user_id = _user_id AND product = _product
  );
$$;

-- 3. Long-form uploads
CREATE TABLE public.long_form_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,        -- 'bill' | 'appliance' | 'other'
  storage_path text NOT NULL,
  label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.long_form_uploads TO authenticated;
GRANT ALL ON public.long_form_uploads TO service_role;

ALTER TABLE public.long_form_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY long_form_uploads_select_own ON public.long_form_uploads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY long_form_uploads_insert_own ON public.long_form_uploads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY long_form_uploads_update_own ON public.long_form_uploads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY long_form_uploads_delete_own ON public.long_form_uploads
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Deep diagnoses history
CREATE TABLE public.deep_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  inputs_hash text NOT NULL,
  notes text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deep_diagnoses_user_idx ON public.deep_diagnoses (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deep_diagnoses TO authenticated;
GRANT ALL ON public.deep_diagnoses TO service_role;

ALTER TABLE public.deep_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY deep_diagnoses_select_own ON public.deep_diagnoses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY deep_diagnoses_insert_own ON public.deep_diagnoses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY deep_diagnoses_delete_own ON public.deep_diagnoses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Storage bucket for bills + appliance photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('bill-uploads', 'bill-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bill_uploads_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bill-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bill_uploads_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bill-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bill_uploads_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bill-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bill_uploads_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bill-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Auto-assign 'free' role to every new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill 'free' role for any existing user without one.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'free'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.id IS NULL;
