// Client-side helpers to upsert survey + long-form responses for the
// signed-in user. RLS scopes everything to auth.uid().
import { supabase } from "@/integrations/supabase/client";

export async function saveSurveyResponse(answers: Record<string, string>, secondsTaken: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false as const };
  const { data: existing } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("survey_responses")
      .update({ answers, seconds_taken: secondsTaken })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("survey_responses")
      .insert({ user_id: user.id, answers, seconds_taken: secondsTaken });
    if (error) throw error;
  }
  return { saved: true as const };
}

export async function loadSurveyResponse() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("survey_responses")
    .select("answers, seconds_taken, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}

export async function saveLongFormResponse(
  answers: Record<string, any>,
  progress: number,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false as const };
  const { data: existing } = await supabase
    .from("long_form_responses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("long_form_responses")
      .update({ answers, progress })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("long_form_responses")
      .insert({ user_id: user.id, answers, progress });
    if (error) throw error;
  }
  return { saved: true as const };
}

export async function loadLongFormResponse() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("long_form_responses")
    .select("answers, progress, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}
