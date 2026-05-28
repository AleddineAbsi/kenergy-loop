CREATE TABLE public.ai_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  inputs_hash text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_action_plans TO authenticated;
GRANT ALL ON public.ai_action_plans TO service_role;

ALTER TABLE public.ai_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_plans_select_own" ON public.ai_action_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "action_plans_insert_own" ON public.ai_action_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "action_plans_update_own" ON public.ai_action_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "action_plans_delete_own" ON public.ai_action_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ai_action_plans_set_updated_at
BEFORE UPDATE ON public.ai_action_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();