import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowRight, Share2, Lightbulb, Flame, Tv, Plug, Snowflake, UtensilsCrossed, HelpCircle, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { RoomAnalysis } from "@/lib/scan.functions";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/scan/result")({
  head: () => ({
    meta: [
      { title: "Your room scan — Kenergy" },
      { name: "description", content: "AI-detected appliances, heating points and the single best action for your room." },
    ],
  }),
  validateSearch: searchSchema,
  component: ResultPage,
});

type ScanRow = {
  id: string;
  image_path: string;
  analysis: RoomAnalysis;
  model: string | null;
  created_at: string;
};

const categoryIcon = {
  lighting: Lightbulb,
  heating: Flame,
  cooling: Snowflake,
  entertainment: Tv,
  kitchen: UtensilsCrossed,
  standby: Plug,
  other: HelpCircle,
} as const;

function ResultPage() {
  const { id } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("room_scans")
        .select("id, image_path, analysis, model, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (id) query = query.eq("id", id).limit(1);
      const { data } = await query.maybeSingle();
      if (cancelled) return;
      if (data) {
        setScan(data as unknown as ScanRow);
        const sig = await supabase.storage
          .from("room-scans")
          .createSignedUrl((data as ScanRow).image_path, 300);
        if (!cancelled) setSignedUrl(sig.data?.signedUrl ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading]);

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Sign in to see your scan</h1>
          <p className="mt-2 text-muted-foreground">Your room scans are private to you.</p>
          <Link to="/login" className="mt-6 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Sign in
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your scan…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">No scan yet</h1>
          <p className="mt-2 text-muted-foreground">Upload a room photo to see your AI analysis here.</p>
          <Link to="/scan" className="mt-6 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Scan a room
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const a = scan.analysis ?? ({} as RoomAnalysis);
  const appliances = Array.isArray(a.appliances) ? a.appliances : [];
  const sources = Array.isArray(a.sources) ? a.sources : [];
  const totalStandby = appliances.reduce((s, x) => s + (x?.est_standby_w || 0), 0);
  const pct = Math.max(1, Math.min(99, Math.round(a.germany_percentile ?? 50)));
  const greenerThan = 100 - pct;

  // Chart data
  const kwhBars = useMemo(
    () =>
      appliances
        .map((x) => ({ name: x?.name ?? "?", kwh: Math.round(x?.est_kwh_per_year ?? 0) }))
        .filter((x) => x.kwh > 0)
        .sort((a, b) => b.kwh - a.kwh)
        .slice(0, 8),
    [appliances],
  );

  const categoryColors: Record<string, string> = {
    lighting: "hsl(48 95% 60%)",
    heating: "hsl(15 85% 60%)",
    cooling: "hsl(200 80% 60%)",
    entertainment: "hsl(280 70% 65%)",
    kitchen: "hsl(140 60% 55%)",
    standby: "hsl(0 0% 60%)",
    other: "hsl(220 15% 55%)",
  };

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of appliances) {
      const cat = (x?.category ?? "other") as string;
      map.set(cat, (map.get(cat) ?? 0) + (x?.est_kwh_per_year ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((d) => d.value > 0);
  }, [appliances]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
          <div className="rounded-3xl p-7 text-primary-foreground shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-hero)" }}>
            <div className="text-xs uppercase tracking-wide opacity-80">{a.room_type || "Your room"}</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-6xl font-bold">{Math.round(a.est_score)}</span>
              <span className="text-2xl font-semibold opacity-90">· {a.grade}</span>
            </div>
            <p className="mt-3 text-sm opacity-90">{a.notes}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 p-3">
                <div className="opacity-80">Heating points</div>
                <div className="text-lg font-semibold">{a.heating_points}</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="opacity-80">Standby (est.)</div>
                <div className="text-lg font-semibold">{Math.round(totalStandby)} W</div>
              </div>
              {typeof a.est_room_kwh_per_year === "number" && (
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="opacity-80">Room / year</div>
                  <div className="text-lg font-semibold">{Math.round(a.est_room_kwh_per_year)} kWh</div>
                </div>
              )}
              {typeof a.est_household_kwh_per_year === "number" && (
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="opacity-80">Home / year (est.)</div>
                  <div className="text-lg font-semibold">{Math.round(a.est_household_kwh_per_year)} kWh</div>
                </div>
              )}
            </div>
            {signedUrl && (
              <img src={signedUrl} alt="Scanned room" className="mt-5 max-h-44 w-full rounded-xl object-cover" />
            )}
          </div>

          <div>
            {a.germany_band && (
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wide text-primary">Vs. Germany</div>
                  <div className="text-xs text-muted-foreground">Stromspiegel benchmark</div>
                </div>
                <p className="mt-1 text-base font-semibold">{a.germany_band}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${greenerThan}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Greener than ~{greenerThan}% of comparable German households.
                </p>
                {a.germany_context && <p className="mt-2 text-sm">{a.germany_context}</p>}
                {a.usage_pattern && (
                  <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Pattern:</span> {a.usage_pattern}</p>
                )}
                {sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {sources.map((s, i) =>
                      s.url ? (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10">
                          {s.label} ↗
                        </a>
                      ) : (
                        <span key={i} className="rounded-full bg-muted px-2 py-0.5">{s.label}</span>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-primary">Top action</div>
              <p className="mt-1 text-sm font-medium">{a.top_action}</p>
            </div>

            {(kwhBars.length > 0 || byCategory.length > 0) && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {kwhBars.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      kWh / year per appliance
                    </div>
                    <div className="mt-3 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kwhBars} layout="vertical" margin={{ left: 0, right: 8 }}>
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={88}
                            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number) => [`${v} kWh/yr`, "Consumption"]}
                          />
                          <Bar dataKey="kwh" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {byCategory.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Where your energy goes
                    </div>
                    <div className="mt-3 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={36} outerRadius={66} paddingAngle={2}>
                            {byCategory.map((entry) => (
                              <Cell key={entry.name} fill={categoryColors[entry.name] ?? "var(--primary)"} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number, n: string) => [`${v} kWh/yr`, n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      {byCategory.map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: categoryColors[c.name] ?? "var(--primary)" }} />
                          {c.name} · {c.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <h2 className="mt-6 text-xl font-bold tracking-tight">What we detected</h2>
            {(a.building_type || typeof a.has_ac === "boolean") && (
              <p className="mt-1 text-xs text-muted-foreground">
                {a.building_type ? `Building: ${a.building_type}` : ""}
                {a.building_type && typeof a.has_ac === "boolean" ? " · " : ""}
                {typeof a.has_ac === "boolean" ? (a.has_ac ? "AC detected" : "No AC visible") : ""}
              </p>
            )}
            <ul className="mt-3 space-y-2.5">
              {appliances.map((app, i) => {
                const Icon = categoryIcon[app?.category as keyof typeof categoryIcon] ?? HelpCircle;
                const conf = Math.round(app?.detection_confidence ?? 0);
                const brandLine = app?.brand
                  ? `${app.brand}${app.model ? ` ${app.model}` : ""}${
                      app.brand_confidence ? ` (${Math.round(app.brand_confidence)}%)` : ""
                    }`
                  : null;
                return (
                  <li key={i} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{app?.name ?? "Unknown"}</span>
                          {conf > 0 && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                conf >= 80
                                  ? "bg-primary/15 text-primary"
                                  : conf >= 60
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {conf}% sure
                            </span>
                          )}
                          {brandLine && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                              {brandLine}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {app?.category ?? "other"} · ~{Math.round(app?.est_standby_w ?? 0)} W standby
                          {typeof app?.est_active_w === "number" ? ` · ~${Math.round(app.est_active_w)} W active` : ""}
                          {typeof app?.est_kwh_per_year === "number" ? ` · ~${Math.round(app.est_kwh_per_year)} kWh/yr` : ""}
                        </div>
                        {app?.notes && <div className="mt-1 text-xs text-muted-foreground">{app.notes}</div>}
                        {app?.consumption_source && (
                          <div className="mt-1 text-[11px]">
                            <span className="text-muted-foreground">Source: </span>
                            {app.consumption_source_url ? (
                              <a
                                href={app.consumption_source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {app.consumption_source} ↗
                              </a>
                            ) : (
                              <span>{app.consumption_source}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {appliances.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No appliances clearly visible. Try a wider shot.
                </li>
              )}
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/recommendations"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
              >
                See full AI action plan <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                <Share2 className="h-4 w-4" /> Scan another room
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Powered by {scan.model ?? "Lovable AI"} · your photo stays private.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
