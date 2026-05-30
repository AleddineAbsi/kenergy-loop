// Roles and entitlements for Kenergy Loop.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "paid" | "free";

export type MyAccess = {
  roles: AppRole[];
  isAdmin: boolean;
  hasDeepAnalysis: boolean;
  hasMonitorSubscription: boolean;
  diagnosisCredits: number;
};

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccess> => {
    const { supabase, userId } = context;
    const [{ data: roles }, { data: ents }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("entitlements")
        .select("product, credits_remaining")
        .eq("user_id", userId)
        .eq("product", "deep_analysis"),
    ]);

    const r = (roles ?? []).map((x) => x.role as AppRole);
    const credits = (ents ?? []).reduce((n, e) => n + (e.credits_remaining ?? 0), 0);
    const isAdmin = r.includes("admin");
    const isPaid = r.includes("paid");
    const hasDeepAnalysis = isAdmin || isPaid || credits > 0;
    return {
      roles: r,
      isAdmin,
      hasDeepAnalysis,
      hasMonitorSubscription: isAdmin || isPaid,
      diagnosisCredits: isAdmin ? 999 : credits,
    };
  });

// Mock purchase: grants 1 deep_analysis credit.
export const grantDeepAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ source: z.enum(["purchase", "admin_grant"]).default("purchase") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("entitlements")
      .insert({ user_id: userId, product: "deep_analysis", source: data.source, credits_remaining: 1 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Consume one analysis credit (called from generateDeepDiagnosis on new runs).
export async function consumeDiagnosisCredit(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("entitlements")
    .select("id, credits_remaining")
    .eq("user_id", userId)
    .eq("product", "deep_analysis")
    .gt("credits_remaining", 0)
    .order("granted_at", { ascending: true })
    .limit(1);
  const row = rows?.[0];
  if (!row) return false;
  const { error } = await supabase
    .from("entitlements")
    .update({ credits_remaining: row.credits_remaining - 1 })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return true;
}

