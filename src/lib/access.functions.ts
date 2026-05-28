// Roles, entitlements, and demo-account seeding for Kenergy.
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

// Consume one diagnosis credit (called from generateDeepDiagnosis on new runs).
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

// Idempotent demo-account seeding. Uses the admin client.
const DEMO = {
  admin: { email: "admin@kenergy.demo", password: "KenergyAdmin!23", display_name: "Kenergy Admin" },
  user: { email: "user@kenergy.demo", password: "KenergyUser!23", display_name: "Demo User" },
};

export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function ensureUser(spec: { email: string; password: string; display_name: string }) {
    // List existing users (paginated, first page is enough for demo).
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users?.find((u) => u.email === spec.email);
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: spec.email,
        password: spec.password,
        email_confirm: true,
        user_metadata: { display_name: spec.display_name },
      });
      if (error) throw new Error(`create ${spec.email}: ${error.message}`);
      user = data.user!;
    }
    return user!;
  }

  const admin = await ensureUser(DEMO.admin);
  const user = await ensureUser(DEMO.user);

  // Grant admin + paid role to admin account.
  await supabaseAdmin
    .from("user_roles")
    .upsert(
      [
        { user_id: admin.id, role: "admin" as const },
        { user_id: admin.id, role: "paid" as const },
      ],
      { onConflict: "user_id,role" },
    );

  // Ensure admin has a long-lived deep_analysis entitlement (credits topped up).
  const { data: adminEnt } = await supabaseAdmin
    .from("entitlements")
    .select("id")
    .eq("user_id", admin.id)
    .eq("product", "deep_analysis")
    .maybeSingle();
  if (!adminEnt) {
    await supabaseAdmin.from("entitlements").insert({
      user_id: admin.id,
      product: "deep_analysis",
      source: "admin_grant",
      credits_remaining: 999,
    });
  }

  // Seed a sample survey for the demo user so the free experience isn't empty.
  await supabaseAdmin.from("survey_responses").upsert(
    {
      user_id: user.id,
      answers: {
        home: "Apartment",
        size: "55",
        people: "2",
        heating: "Central gas",
        goal: "Lower my bill",
      },
      seconds_taken: 58,
    },
    { onConflict: "user_id" },
  );

  return { ok: true, accounts: [DEMO.admin.email, DEMO.user.email] };
});
