// Phase 5 — Monthly report generation.
//
// buildMonthlyReport() assembles the last 30 days of readings + the latest
// AI plan + the user's profile into a structured DTO the /report page
// renders. emailMonthlyReport() ships the report via Resend (through the
// Lovable connector gateway). If RESEND_API_KEY is not configured, the
// server fn returns a friendly { ok: false, reason } object so the UI can
// nudge the user.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadingPoint = {
  date: string;
  kwh: number;
  cost_eur: number | null;
};

export type ReportAction = {
  title: string;
  savings_eur_per_year: number;
};

export type MonthlyReport = {
  user_email: string | null;
  display_name: string | null;
  period_start: string;
  period_end: string;
  total_kwh: number;
  total_cost_eur: number;
  prev_total_kwh: number;
  delta_pct: number; // vs previous 30 days
  co2_kg: number;
  readings: ReadingPoint[];
  yearly_savings_eur: number;
  energy_score: number;
  grade: string;
  top_actions: ReportAction[];
  has_plan: boolean;
  generated_at: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const buildMonthlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 30);

    const [{ data: readings }, { data: prevReadings }, { data: plan }, { data: profile }] =
      await Promise.all([
        supabase
          .from("energy_readings")
          .select("reading_date, kwh, cost_eur")
          .eq("user_id", userId)
          .gte("reading_date", isoDate(start))
          .lte("reading_date", isoDate(now))
          .order("reading_date", { ascending: true }),
        supabase
          .from("energy_readings")
          .select("kwh")
          .eq("user_id", userId)
          .gte("reading_date", isoDate(prevStart))
          .lt("reading_date", isoDate(start)),
        supabase
          .from("ai_action_plans")
          .select("plan")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle(),
      ]);

    const points: ReadingPoint[] = (readings ?? []).map((r) => ({
      date: r.reading_date as string,
      kwh: Number(r.kwh),
      cost_eur: r.cost_eur == null ? null : Number(r.cost_eur),
    }));
    const total_kwh = points.reduce((s, p) => s + p.kwh, 0);
    const total_cost = points.reduce((s, p) => s + (p.cost_eur ?? 0), 0);
    const prev_total = (prevReadings ?? []).reduce(
      (s, r) => s + Number((r as { kwh: number }).kwh),
      0,
    );
    const delta_pct =
      prev_total > 0 ? Math.round(((total_kwh - prev_total) / prev_total) * 100) : 0;

    const rawPlan = (plan?.plan ?? null) as null | {
      yearly_savings_eur?: number;
      energy_score?: number;
      grade?: string;
      recommendations?: Array<{ title: string; savings_eur_per_year: number }>;
    };

    const top_actions: ReportAction[] = (rawPlan?.recommendations ?? [])
      .slice()
      .sort((a, b) => b.savings_eur_per_year - a.savings_eur_per_year)
      .slice(0, 5)
      .map((r) => ({
        title: r.title,
        savings_eur_per_year: Math.round(r.savings_eur_per_year),
      }));

    return {
      user_email: (claims as { email?: string })?.email ?? null,
      display_name: (profile?.display_name as string | null) ?? null,
      period_start: isoDate(start),
      period_end: isoDate(now),
      total_kwh: Math.round(total_kwh),
      total_cost_eur: Math.round(total_cost),
      prev_total_kwh: Math.round(prev_total),
      delta_pct,
      co2_kg: Math.round(total_kwh * 0.22),
      readings: points,
      yearly_savings_eur: Math.round(rawPlan?.yearly_savings_eur ?? 0),
      energy_score: Math.round(rawPlan?.energy_score ?? 0),
      grade: rawPlan?.grade ?? "—",
      top_actions,
      has_plan: Boolean(rawPlan),
      generated_at: now.toISOString(),
    } satisfies MonthlyReport;
  });

function reportHtml(r: MonthlyReport) {
  const rows = r.top_actions
    .map(
      (a) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escape(a.title)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">~€${a.savings_eur_per_year}/yr</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:auto;padding:24px">
  <h1 style="margin:0 0 4px">Your Kenergy monthly report</h1>
  <p style="color:#666;margin:0 0 16px">${r.period_start} → ${r.period_end}</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:140px;border:1px solid #eee;border-radius:12px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">kWh used</div><div style="font-size:24px;font-weight:700">${r.total_kwh}</div></div>
    <div style="flex:1;min-width:140px;border:1px solid #eee;border-radius:12px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">vs last 30d</div><div style="font-size:24px;font-weight:700;color:${r.delta_pct > 0 ? "#c0392b" : "#16a34a"}">${r.delta_pct > 0 ? "+" : ""}${r.delta_pct}%</div></div>
    <div style="flex:1;min-width:140px;border:1px solid #eee;border-radius:12px;padding:12px"><div style="font-size:11px;color:#666;text-transform:uppercase">CO₂ (kg)</div><div style="font-size:24px;font-weight:700">${r.co2_kg}</div></div>
  </div>
  <h2 style="margin-top:24px">Top 5 actions to save more</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows || `<tr><td style="padding:8px 0;color:#666">Complete your plan to see actions.</td></tr>`}</table>
  <p style="margin-top:24px;color:#666;font-size:12px">Estimated yearly savings if applied: <b>€${r.yearly_savings_eur}</b> · Score ${r.energy_score} (${escape(r.grade)})</p>
  <p style="color:#999;font-size:11px">Generated by Kenergy.</p>
</body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const emailMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string })?.email;
    if (!email) return { ok: false as const, reason: "no-email" };

    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return { ok: false as const, reason: "missing-secret" as const };
    }

    // Rebuild the report inline (server-fns can't call each other directly).
    const { data: { user: _u } } = { data: { user: { id: userId } } };
    void _u;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 30);

    const [{ data: readings }, { data: prevReadings }, { data: plan }, { data: profile }] =
      await Promise.all([
        supabase.from("energy_readings").select("reading_date, kwh, cost_eur").eq("user_id", userId).gte("reading_date", isoDate(start)).lte("reading_date", isoDate(now)).order("reading_date", { ascending: true }),
        supabase.from("energy_readings").select("kwh").eq("user_id", userId).gte("reading_date", isoDate(prevStart)).lt("reading_date", isoDate(start)),
        supabase.from("ai_action_plans").select("plan").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      ]);

    const points: ReadingPoint[] = (readings ?? []).map((r) => ({
      date: r.reading_date as string,
      kwh: Number(r.kwh),
      cost_eur: r.cost_eur == null ? null : Number(r.cost_eur),
    }));
    const total_kwh = points.reduce((s, p) => s + p.kwh, 0);
    const prev_total = (prevReadings ?? []).reduce((s, r) => s + Number((r as { kwh: number }).kwh), 0);
    const rawPlan = (plan?.plan ?? null) as null | {
      yearly_savings_eur?: number;
      energy_score?: number;
      grade?: string;
      recommendations?: Array<{ title: string; savings_eur_per_year: number }>;
    };
    const report: MonthlyReport = {
      user_email: email,
      display_name: (profile?.display_name as string | null) ?? null,
      period_start: isoDate(start),
      period_end: isoDate(now),
      total_kwh: Math.round(total_kwh),
      total_cost_eur: Math.round(points.reduce((s, p) => s + (p.cost_eur ?? 0), 0)),
      prev_total_kwh: Math.round(prev_total),
      delta_pct: prev_total > 0 ? Math.round(((total_kwh - prev_total) / prev_total) * 100) : 0,
      co2_kg: Math.round(total_kwh * 0.22),
      readings: points,
      yearly_savings_eur: Math.round(rawPlan?.yearly_savings_eur ?? 0),
      energy_score: Math.round(rawPlan?.energy_score ?? 0),
      grade: rawPlan?.grade ?? "—",
      top_actions: (rawPlan?.recommendations ?? [])
        .slice()
        .sort((a, b) => b.savings_eur_per_year - a.savings_eur_per_year)
        .slice(0, 5)
        .map((r) => ({ title: r.title, savings_eur_per_year: Math.round(r.savings_eur_per_year) })),
      has_plan: Boolean(rawPlan),
      generated_at: now.toISOString(),
    };

    const html = reportHtml(report);

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "Kenergy <onboarding@resend.dev>",
        to: [email],
        subject: `Your Kenergy monthly report — ${report.total_kwh} kWh`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Resend error:", res.status, text);
      return { ok: false as const, reason: "send-failed" as const, status: res.status };
    }

    return { ok: true as const, sent_to: email };
  });
