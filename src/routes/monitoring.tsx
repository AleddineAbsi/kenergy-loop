import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info,
  Lock,
  Plus,
  Replace,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { ProductImage } from "@/components/product-image";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import {
  addReading,
  deleteReading,
  listReadings,
  type EnergyReading,
} from "@/lib/phase4";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Consumption dashboard — Kenergy Loop" },
      {
        name: "description",
        content:
          "Track your kWh trend, anomalies, deprecated appliances, and replacement kits — all in one live dashboard.",
      },
    ],
  }),
  component: MonitoringPage,
});

// ─── Simulated household for paid / admin demo ──────────────────────────────

type SimDevice = {
  id: string;
  name: string;
  category: string;
  draw_w: number;
  daily_kwh: number;
  efficiency: number;
  status: "healthy" | "warning" | "deprecated";
  note?: string;
  image_url?: string;
  brand?: string;
  replacement?: {
    product: string;
    brand_examples: string;
    price_eur: number;
    saves_kwh_per_year: number;
    image_url?: string;
    kit?: { name: string; price_eur: number; why: string; image_url?: string }[];
  };
};

const simHome: SimDevice[] = [
  {
    id: "hp",
    name: "Heat pump (Daikin Altherma 3)",
    category: "Heating",
    draw_w: 1850,
    daily_kwh: 28.4,
    efficiency: 91,
    status: "healthy",
  },
  {
    id: "fr",
    name: "Kitchen fridge (Liebherr 2014)",
    category: "Cold appliance",
    draw_w: 184,
    daily_kwh: 3.9,
    efficiency: 42,
    status: "deprecated",
    note: "Compressor cycling 3× more than rated, gasket likely worn. Drawing ~2× a modern A-rated equivalent.",
    replacement: {
      product: "A-rated 250 L fridge with inverter compressor",
      brand_examples: "Liebherr CNd 5253 · Bosch KGN39AICT · Siemens iQ500",
      price_eur: 749,
      saves_kwh_per_year: 320,
      kit: [
        { name: "Shelly Plug S Gen3 (energy meter)", price_eur: 19, why: "Verify the new fridge's real draw and flag future drift." },
        { name: "Aqara TH sensor", price_eur: 23, why: "Track interior temp & door-open events on this dashboard." },
      ],
    },
  },
  {
    id: "wm",
    name: "Washing machine (Bosch WAW)",
    category: "Laundry",
    draw_w: 0,
    daily_kwh: 1.1,
    efficiency: 78,
    status: "warning",
    note: "Standby draw climbing — bad eco-program selection.",
  },
  {
    id: "dw",
    name: "Dishwasher (Miele G5000)",
    category: "Kitchen",
    draw_w: 0,
    daily_kwh: 0.9,
    efficiency: 88,
    status: "healthy",
  },
  {
    id: "tv",
    name: "OLED TV (LG B7, 2017)",
    category: "Entertainment",
    draw_w: 0,
    daily_kwh: 1.4,
    efficiency: 55,
    status: "deprecated",
    note: "Older WebOS draws ~14 W in standby; modern equivalents stay below 0.5 W.",
    replacement: {
      product: "Modern OLED with sub-1W standby",
      brand_examples: "LG OLED B4 · Sony Bravia 8 · Panasonic Z85A",
      price_eur: 1190,
      saves_kwh_per_year: 110,
      kit: [
        { name: "Shelly Plus Plug S", price_eur: 18, why: "Cut the standby ghost-load with a schedule from this dashboard." },
      ],
    },
  },
  {
    id: "ev",
    name: "EV charger (go-eCharger 11kW)",
    category: "Mobility",
    draw_w: 7200,
    daily_kwh: 18.0,
    efficiency: 95,
    status: "healthy",
  },
  {
    id: "sr",
    name: "Home server rack",
    category: "Always-on",
    draw_w: 320,
    daily_kwh: 7.7,
    efficiency: 55,
    status: "deprecated",
    note: "Old NAS + 24/7 idle CPU well above modern equivalents.",
    replacement: {
      product: "Low-TDP mini-PC + 2-bay NAS",
      brand_examples: "Beelink SER8 · Synology DS224+",
      price_eur: 829,
      saves_kwh_per_year: 1450,
      kit: [
        { name: "Smart UPS w/ Modbus", price_eur: 220, why: "Live grid quality + draw on this dashboard." },
        { name: "Shelly EM 50A", price_eur: 65, why: "Sub-circuit clamp meter — Local API endpoint." },
      ],
    },
  },
];

const simulatedWeeks: Week[] = [
  { label: "W1", kwh: 428, cost_eur: 171.2 },
  { label: "W2", kwh: 444, cost_eur: 177.6 },
  { label: "W3", kwh: 461, cost_eur: 184.4 },
  { label: "W4", kwh: 452, cost_eur: 180.8 },
  { label: "W5", kwh: 438, cost_eur: 175.2 },
  { label: "W6", kwh: 421, cost_eur: 168.4 },
  { label: "W7", kwh: 403, cost_eur: 161.2 },
  { label: "This week", kwh: 389, cost_eur: 155.6 },
];

const simulatedReadings: EnergyReading[] = [
  {
    id: "sim-reading-2",
    reading_date: "2026-05-26",
    kwh: 389,
    cost_eur: 155.6,
    source: "manual",
    note: "Simulated latest weekly reading",
  },
  {
    id: "sim-reading-1",
    reading_date: "2026-05-19",
    kwh: 403,
    cost_eur: 161.2,
    source: "manual",
    note: "Simulated previous weekly reading",
  },
];

function MonitoringPage() {
  const { user, loading: authLoading } = useAuth();
  const { access, loading: accessLoading } = useAccess();

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <MonitoringPaywall
        cta={
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Sign in to continue
          </Link>
        }
      />
    );
  }

  if (!access.hasMonitorSubscription) {
    return (
      <MonitoringPaywall
        cta={
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" /> See Monitor plans
          </Link>
        }
      />
    );
  }

  return <FullDashboard />;
}

// ─── Paywall ────────────────────────────────────────────────────────────────

function MonitoringPaywall({ cta }: { cta: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="mb-2 text-xs uppercase tracking-wide text-primary">Monitor · subscription</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Live consumption dashboard</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Continuous tracking of every connected appliance, weekly anomaly alerts, deprecated-appliance
            detection, and one-click replacement kits compatible with your existing setup. Cancel anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {cta}
            <Link to="/long-form" className="rounded-md border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">
              Or try a one-time Deep Analysis
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Zap className="h-4 w-4" />, t: "Live per-appliance draw", d: "Live watts and 24h kWh for every detected device in your home." },
            { icon: <TrendingDown className="h-4 w-4" />, t: "Weekly trend & alerts", d: "We flag sudden spikes (>20%) and quietly celebrate drops (>10%)." },
            { icon: <AlertTriangle className="h-4 w-4" />, t: "Deprecated detection", d: "Aging fridges, OLED TVs with high standby, idle servers — surfaced automatically." },
            { icon: <Replace className="h-4 w-4" />, t: "Replacement kits", d: "Concrete products + a compatible smart-home kit that streams data right back here." },
            { icon: <Cpu className="h-4 w-4" />, t: "Bill ingest", d: "Drop a utility bill — we extract kWh + € and keep the timeline accurate." },
            { icon: <CheckCircle2 className="h-4 w-4" />, t: "Yearly savings tracking", d: "See exactly what each accepted recommendation actually saved you." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-primary">{f.icon}<span className="text-sm font-semibold">{f.t}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Sample dashboard preview</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Example data</span>
          </div>
          <div className="relative">
            <div className="pointer-events-none select-none blur-[1.5px]">
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewStat label="Live draw" value="9.6 kW" />
                <PreviewStat label="24h" value="61.4 kWh" />
                <PreviewStat label="Deprecated" value="3 / 7" tone="warn" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {simHome.slice(0, 4).map((d) => (
                  <SimDeviceMini key={d.id} d={d} />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <div className="rounded-full border border-border bg-background/90 px-4 py-2 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)]">
                <Lock className="mr-1.5 inline h-3 w-3" /> Subscribe to see your real home
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function MonitorHeroStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        tone === "warn"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border/70 bg-background/75"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-black ${tone === "warn" ? "text-amber-700" : "text-primary"}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function SimDeviceMini({ d }: { d: SimDevice }) {
  const color = d.status === "healthy" ? "text-emerald-500" : d.status === "warning" ? "text-amber-500" : "text-destructive";
  return (
    <div className="rounded-md border border-border bg-card p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.category}</div>
          <div className="text-sm font-semibold">{d.name}</div>
        </div>
        <StatusHelp status={d.status} message={statusExplanation(d)} className={color} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="rounded bg-muted p-1"><div className="font-semibold">{d.draw_w}W</div><div className="text-muted-foreground">live</div></div>
        <div className="rounded bg-muted p-1"><div className="font-semibold">{d.daily_kwh}kWh</div><div className="text-muted-foreground">24h</div></div>
        <div className="rounded bg-muted p-1"><div className="font-semibold">{d.efficiency}%</div><div className="text-muted-foreground">eff</div></div>
      </div>
    </div>
  );
}

// ─── Full dashboard (admin + paid) ──────────────────────────────────────────

function FullDashboard() {
  const { user } = useAuth();
  const { access } = useAccess();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showSim, setShowSim] = useState(true);

  const readingsQuery = useQuery<EnergyReading[]>({
    queryKey: ["energy-readings", user?.id ?? "guest"],
    queryFn: listReadings,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });

  const remove = useMutation({
    mutationFn: deleteReading,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["energy-readings", user?.id ?? "guest"] });
      toast.success("Reading deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const realReadings = readingsQuery.data ?? [];
  const readings = realReadings.length > 0 ? realReadings : simulatedReadings;
  const weeks = useMemo(() => {
    const realWeeks = buildWeekly(realReadings);
    return realWeeks.length > 0 ? realWeeks : simulatedWeeks;
  }, [realReadings]);
  const usingSimulatedDashboard = realReadings.length === 0;

  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const weekDeltaPct = last && prev && prev.kwh > 0 ? Math.round(((last.kwh - prev.kwh) / prev.kwh) * 100) : null;
  const monthlyEur = last?.cost_eur != null ? Math.round(last.cost_eur * 4.33) : null;
  const totalKwhSaved = weeks.length >= 2 ? Math.max(0, Math.round((weeks[0].kwh - last!.kwh) * weeks.length)) : 0;
  const co2Saved = Math.round(totalKwhSaved * 0.4);
  const alerts = buildAlerts(weeks, usingSimulatedDashboard);

  const simLiveW = simHome.reduce((s, d) => s + d.draw_w, 0);
  const simDailyKwh = simHome.reduce((s, d) => s + d.daily_kwh, 0);
  const deprecated = simHome.filter((d) => d.status === "deprecated");

  // ── Chart data ────────────────────────────────────────────────────────────
  const hourly24 = useMemo(() => buildHourly24(simHome), []);
  const perDeviceKwh = useMemo(
    () =>
      [...simHome]
        .map((d) => ({ name: d.name.split(" (")[0], kwh: d.daily_kwh, status: d.status }))
        .sort((a, b) => b.kwh - a.kwh),
    [],
  );
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of simHome) m.set(d.category, (m.get(d.category) ?? 0) + d.daily_kwh);
    return Array.from(m.entries()).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));
  }, []);
  const categoryPalette = [
    "var(--primary)",
    "oklch(0.7 0.15 60)",
    "oklch(0.65 0.18 30)",
    "oklch(0.6 0.15 280)",
    "oklch(0.7 0.15 200)",
    "oklch(0.6 0.1 140)",
    "oklch(0.55 0.05 250)",
  ];
  const statusColor = (s: SimDevice["status"]) =>
    s === "healthy" ? "var(--primary)" : s === "warning" ? "oklch(0.75 0.15 75)" : "oklch(0.6 0.2 25)";

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Zap className="h-3.5 w-3.5" />
                {access.isAdmin ? "Admin · simulated connected home" : "Your connected home"}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Live energy monitor</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                See what is using power right now, which appliance needs attention, and whether your weekly
                consumption is moving in the right direction.
              </p>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Plus className="h-4 w-4" /> Log reading
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MonitorHeroStat label="Live total draw" value={`${simLiveW.toLocaleString()} W`} hint="Right now across detected devices" />
            <MonitorHeroStat label="This week" value={last ? `${Math.round(last.kwh)} kWh` : "—"} hint={weekDeltaPct == null ? "Needs 2 readings to compare" : `${weekDeltaPct >= 0 ? "+" : ""}${weekDeltaPct}% vs last week`} />
            <MonitorHeroStat label="Monthly estimate" value={monthlyEur != null ? `€${monthlyEur}` : "—"} hint="Latest week × 4.33" />
            <MonitorHeroStat label="Needs replacement" value={`${deprecated.length} / ${simHome.length}`} hint="Red devices have a suggested swap" tone={deprecated.length ? "warn" : undefined} />
          </div>
        </section>

        {/* Simulated home block */}
        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-200 hover:border-primary/25 hover:shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight">Live appliance fleet</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {access.isAdmin
                  ? "Simulated household used for the admin demo. Mix of healthy, warning, and deprecated devices."
                  : "Devices currently detected in your home."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">Green: normal</span>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700">Amber: check settings</span>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">Red: replacement suggested</span>
              </div>
            </div>
            <button
              onClick={() => setShowSim((v) => !v)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-muted"
            >
              {showSim ? "Hide" : "Show"}
            </button>
          </div>

          {showSim && (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <PreviewStat label="Live total draw" value={`${simLiveW.toLocaleString()} W`} />
                <PreviewStat label="Last 24h" value={`${simDailyKwh.toFixed(1)} kWh`} />
                <PreviewStat label="Need replacement" value={`${deprecated.length} / ${simHome.length}`} tone={deprecated.length ? "warn" : undefined} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {simHome.map((d) => (
                  <SimDeviceCard key={d.id} d={d} />
                ))}
              </div>
            </>
          )}
        </section>

        {open && (
          <AddReadingForm
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["energy-readings", user?.id ?? "guest"] });
            }}
          />
        )}

        <div className="hidden">
          <Stat label="CO₂ saved" value={`${co2Saved} kg`} hint={co2Saved > 0 ? "Since first reading" : "Track more to estimate"} />
        </div>

        {/* ── Live charts ──────────────────────────────────────────── */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-black tracking-tight">What changed this week</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Two charts only: appliance load explains where energy goes, weekly trend explains whether the home is improving.
            </p>
          </div>
        </section>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h3 className="text-lg font-semibold">Live draw (last 24h)</h3>
            <p className="text-xs text-muted-foreground">Whole-home power use, sampled hourly.</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourly24} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="drawGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} W`, "Draw"]}
                  />
                  <Area type="monotone" dataKey="watts" stroke="var(--primary)" fill="url(#drawGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
            <h3 className="text-lg font-semibold">Daily kWh per appliance</h3>
            <p className="text-xs text-muted-foreground">Each bar is one device's estimated kWh over the last 24h. Longer bar = bigger energy cost.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Normal range
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.15_75)]" /> Check settings
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.6_0.2_25)]" /> Replace candidate
              </span>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDeviceKwh} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis
                    type="number"
                    unit=" kWh"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} kWh / 24h`, "Use"]}
                  />
                  <Bar dataKey="kwh" radius={[0, 4, 4, 0]}>
                    {perDeviceKwh.map((d, i) => (
                      <Cell key={i} fill={statusColor(d.status)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] lg:col-span-1">
            <h3 className="text-lg font-semibold">Where energy goes</h3>
            <p className="text-xs text-muted-foreground">Share of total daily kWh by category.</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={categoryPalette[i % categoryPalette.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => [`${v} kWh`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {byCategory.map((c, i) => (
                <span key={c.name} className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: categoryPalette[i % categoryPalette.length] }} />
                  {c.name} · {c.value}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg lg:col-span-1">
            <h3 className="text-lg font-semibold">Weekly trend</h3>
            <p className="text-xs text-muted-foreground">Lower line over time means the plan is working.</p>
            {weeks.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">No readings yet. Log your first one to see your trend appear here.</p>
            ) : (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${Math.round(v)} kWh`, "Week"]}
                    />
                    <Line type="monotone" dataKey="kwh" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>


        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
            <h3 className="text-lg font-semibold">Alerts</h3>
            {alerts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No alerts yet. We'll flag any sudden jump in consumption.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <StatusHelp
                      status={a.level === "warn" ? "warning" : "healthy"}
                      message={a.explanation}
                      className={a.level === "warn" ? "text-amber-500" : "text-primary"}
                    />
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
            <h3 className="text-lg font-semibold">Recent readings</h3>
            {readings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Your last 10 readings will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {[...readings].reverse().slice(0, 2).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div>
                      <div className="font-medium">
                        {Math.round(r.kwh)} kWh
                        {r.cost_eur != null && <span className="ml-2 text-muted-foreground">· €{Number(r.cost_eur).toFixed(2)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.reading_date} · {r.source}</div>
                    </div>
                    {!String(r.id).startsWith("sim-") && (
                      <button onClick={() => remove.mutate(r.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete reading">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SimDeviceCard({ d }: { d: SimDevice }) {
  const [openKit, setOpenKit] = useState(false);
  const tone =
    d.status === "deprecated" ? "border-destructive/40" : d.status === "warning" ? "border-amber-500/40" : "border-border";
  const color = d.status === "healthy" ? "text-emerald-500" : d.status === "warning" ? "text-amber-500" : "text-destructive";

  return (
    <div className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{d.category}</div>
          <div className="mt-0.5 text-base font-semibold">{d.name}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {d.status === "healthy" ? "Operating normally" : d.status === "warning" ? "Needs settings check" : "Replacement candidate"}
          </div>
        </div>
        <StatusHelp status={d.status} message={statusExplanation(d)} className={color} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-muted p-2"><div className="font-semibold">{d.draw_w.toLocaleString()} W</div><div className="text-muted-foreground">live draw</div></div>
        <div className="rounded-xl bg-muted p-2"><div className="font-semibold">{d.daily_kwh} kWh</div><div className="text-muted-foreground">24h use</div></div>
        <div className="rounded-xl bg-muted p-2"><div className="font-semibold">{d.efficiency}%</div><div className="text-muted-foreground">efficiency</div></div>
      </div>
      {d.note && <p className="mt-3 text-xs text-muted-foreground">{d.note}</p>}

      {d.status === "deprecated" && d.replacement && (
        <>
          <button
            onClick={() => setOpenKit((v) => !v)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Replace className="h-3 w-3" /> {openKit ? "Hide replacement kit" : "View replacement kit"}
          </button>
          {openKit && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">Suggested swap</div>
                <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-bold text-primary">
                  ~€{Math.round(d.replacement.saves_kwh_per_year * 0.4)}/yr
                </span>
              </div>
              <div className="mt-3 rounded-2xl border border-border bg-background/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex gap-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                    <ProductImage
                      name={d.replacement.product}
                      brand={d.replacement.brand_examples.split(" · ")[0]}
                      src={d.replacement.image_url}
                      aspect="aspect-square"
                      className="h-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{d.replacement.product}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{d.replacement.brand_examples}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
                      <div className="rounded-xl bg-muted p-2">
                        <div className="font-black">€{d.replacement.price_eur}</div>
                        <div className="text-muted-foreground">estimated price</div>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">
                        <div className="font-black">{d.replacement.saves_kwh_per_year} kWh</div>
                        <div className="text-primary/75">saved / year</div>
                      </div>
                    </div>
                  </div>
                </div>
                <a
                  href={`https://www.amazon.de/s?k=${encodeURIComponent(d.replacement.product)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  View product options
                </a>
              </div>
              {d.replacement.kit && d.replacement.kit.length > 0 && (
                <>
                  <div className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compatible kit</div>
                  <ul className="mt-2 grid gap-2">
                    {d.replacement.kit.map((k) => (
                      <li key={k.name} className="flex gap-2 rounded-xl border border-border bg-background/85 p-2 text-[11px] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30">
                        <div className="h-12 w-12 shrink-0">
                          <ProductImage name={k.name} src={k.image_url} aspect="aspect-square" className="h-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{k.name}</span>
                            <span>€{k.price_eur}</span>
                          </div>
                          <div className="text-muted-foreground">{k.why}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusHelp({
  status,
  message,
  className,
}: {
  status: SimDevice["status"] | "healthy" | "warning";
  message: string;
  className?: string;
}) {
  const Icon = status === "healthy" ? CheckCircle2 : AlertTriangle;

  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" aria-label="Explain status" className={`rounded-full ${className ?? ""}`}>
        <Icon className="h-4 w-4" />
      </button>
      <span className="pointer-events-none absolute right-0 top-6 z-20 hidden w-64 rounded-xl border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-[var(--shadow-soft)] group-hover:block group-focus-within:block">
        {message}
      </span>
    </span>
  );
}

function statusExplanation(d: SimDevice) {
  if (d.status === "healthy") {
    return `${d.name} is inside the expected range for this simulated week. No immediate action needed.`;
  }

  if (d.status === "warning") {
    return d.note ?? `${d.name} is using more energy than expected. Check settings, standby mode, or usage schedule.`;
  }

  return d.note ?? `${d.name} looks inefficient compared with a modern replacement. Review the suggested swap and verify with a meter reading.`;
}

function AddReadingForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [kwh, setKwh] = useState("");
  const [cost, setCost] = useState("");
  const [source, setSource] = useState<"manual" | "bill">("manual");

  const save = useMutation({
    mutationFn: () =>
      addReading({
        reading_date: date,
        kwh: Number(kwh),
        cost_eur: cost ? Number(cost) : null,
        source,
      }),
    onSuccess: () => {
      toast.success("Reading saved.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!kwh || isNaN(Number(kwh)) || Number(kwh) <= 0) {
          toast.error("Enter a positive kWh value.");
          return;
        }
        save.mutate();
      }}
      className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:grid-cols-5"
    >
      <label className="text-sm md:col-span-1">
        <span className="mb-1 block text-muted-foreground">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="text-sm md:col-span-1">
        <span className="mb-1 block text-muted-foreground">kWh (this week)</span>
        <input type="number" inputMode="decimal" step="0.1" min="0" value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="e.g. 48" className="w-full rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="text-sm md:col-span-1">
        <span className="mb-1 block text-muted-foreground">Cost (€, optional)</span>
        <input type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 12.50" className="w-full rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="text-sm md:col-span-1">
        <span className="mb-1 block text-muted-foreground">Source</span>
        <select value={source} onChange={(e) => setSource(e.target.value as "manual" | "bill")} className="w-full rounded-md border border-border bg-background px-3 py-2">
          <option value="manual">Meter reading</option>
          <option value="bill">From bill</option>
        </select>
      </label>
      <div className="flex items-end gap-2 md:col-span-1">
        <button type="submit" disabled={save.isPending} className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Stat({ label, value, hint, trendDown }: { label: string; value: string; hint: string; trendDown?: boolean }) {
  const Icon = trendDown ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

// ---------- helpers ----------

type Week = { label: string; kwh: number; cost_eur: number | null };

function buildWeekly(readings: EnergyReading[]): Week[] {
  if (readings.length === 0) return [];
  const buckets = new Map<string, { kwh: number; cost: number; n: number; date: Date }>();
  for (const r of readings) {
    const d = new Date(r.reading_date + "T00:00:00");
    const key = isoWeekKey(d);
    const cur = buckets.get(key) ?? { kwh: 0, cost: 0, n: 0, date: d };
    cur.kwh += Number(r.kwh);
    if (r.cost_eur != null) cur.cost += Number(r.cost_eur);
    cur.n += 1;
    if (d < cur.date) cur.date = d;
    buckets.set(key, cur);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-8)
    .map((b, i) => ({
      label: `W${i + 1}`,
      kwh: b.kwh,
      cost_eur: b.n > 0 && b.cost > 0 ? b.cost / b.n : null,
    }));
}

function isoWeekKey(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function buildAlerts(weeks: Week[], simulated = false) {
  const out: { id: string; level: "warn" | "info"; text: string; explanation: string }[] = [];
  if (weeks.length < 2) return out;
  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  if (prev.kwh > 0) {
    const pct = ((last.kwh - prev.kwh) / prev.kwh) * 100;
    if (pct >= 20) {
      out.push({
        id: "spike",
        level: "warn",
        text: `Consumption jumped ${Math.round(pct)}% vs last week.`,
        explanation: "This alert fires when the latest weekly kWh is at least 20% higher than the previous week. Check heating settings, always-on devices, or unusual appliance use.",
      });
    } else if (pct <= -10) {
      out.push({
        id: "drop",
        level: "info",
        text: `Nice - you used ${Math.round(-pct)}% less than last week.`,
        explanation: "This positive alert appears when weekly kWh drops by at least 10%. In this demo, the drop is coherent with the lower simulated readings and reduced appliance load.",
      });
    }
  }
  if (simulated) {
    out.push({
      id: "fridge",
      level: "warn",
      text: "Kitchen fridge is still the biggest inefficient load.",
      explanation: "The simulated fridge uses 3.9 kWh/day, far above a modern efficient fridge. That is why it is marked red and has a replacement suggestion.",
    });
  }
  return out;
}

function buildHourly24(devices: SimDevice[]) {
  const base = devices.reduce((s, d) => s + d.draw_w, 0);
  const out: { hour: string; watts: number }[] = [];
  for (let h = 0; h < 24; h++) {
    // Plausible domestic curve: low overnight, morning peak, midday dip, evening peak.
    const factor =
      h < 5 ? 0.55 :
      h < 8 ? 0.85 :
      h < 11 ? 1.05 :
      h < 17 ? 0.8 :
      h < 22 ? 1.25 :
      0.7;
    const jitter = 0.92 + ((h * 7) % 13) / 100;
    out.push({ hour: `${String(h).padStart(2, "0")}h`, watts: Math.round(base * factor * jitter) });
  }
  return out;
}
