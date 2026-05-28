import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Plus, Replace, ShieldCheck, X, Zap } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/admin/monitoring")({
  head: () => ({
    meta: [
      { title: "Fleet monitoring — Kenergy" },
      { name: "description", content: "Simulated live monitoring of household machines with replacement suggestions." },
    ],
  }),
  component: AdminMonitoringPage,
});

type Machine = {
  id: string;
  name: string;
  category: string;
  draw_w: number;          // current draw watts
  daily_kwh: number;       // last 24h
  efficiency: number;      // 0-100, lower = worse
  status: "healthy" | "warning" | "degraded";
  note?: string;
};

const fleet: Machine[] = [
  { id: "hp", name: "Heat pump (Daikin Altherma 3)", category: "Heating", draw_w: 1850, daily_kwh: 28.4, efficiency: 91, status: "healthy" },
  { id: "fr", name: "Kitchen fridge (Liebherr 2014)", category: "Cold appliance", draw_w: 184, daily_kwh: 3.9, efficiency: 42, status: "degraded", note: "Compressor cycling 3× more than rated; gasket likely worn." },
  { id: "wm", name: "Washing machine (Bosch WAW)", category: "Laundry", draw_w: 0, daily_kwh: 1.1, efficiency: 78, status: "warning", note: "Standby draw climbing — bad eco-program selection." },
  { id: "dw", name: "Dishwasher (Miele G5000)", category: "Kitchen", draw_w: 0, daily_kwh: 0.9, efficiency: 88, status: "healthy" },
  { id: "ev", name: "EV charger (go-eCharger 11kW)", category: "Mobility", draw_w: 7200, daily_kwh: 18.0, efficiency: 95, status: "healthy" },
  { id: "sr", name: "Home server rack", category: "Always-on", draw_w: 320, daily_kwh: 7.7, efficiency: 55, status: "degraded", note: "Old NAS + 24/7 idle CPU usage well above modern equivalents." },
];

type Replacement = {
  product: string;
  brand_examples: string;
  price_eur: number;
  saves_kwh_per_year: number;
  payback_years: number;
  kit?: { name: string; price_eur: number; why: string }[];
};

const replacements: Record<string, Replacement> = {
  fr: {
    product: "A-rated 250 L fridge with inverter compressor",
    brand_examples: "Liebherr CNd 5253 / Bosch KGN39AICT / Siemens iQ500",
    price_eur: 749,
    saves_kwh_per_year: 320,
    payback_years: 7.8,
    kit: [
      { name: "Shelly Plug S Gen3 (energy meter)", price_eur: 19, why: "Verify the new fridge's real consumption and flag future drift." },
      { name: "Aqara TH sensor", price_eur: 23, why: "Track interior temperature & door-open events on the Kenergy dashboard." },
    ],
  },
  wm: {
    product: "Smart plug + scheduled eco cycle",
    brand_examples: "AVM FRITZ!DECT 210 / Shelly Plus Plug S",
    price_eur: 39,
    saves_kwh_per_year: 80,
    payback_years: 1.7,
    kit: [
      { name: "Shelly Plus Plug S", price_eur: 18, why: "Cuts the standby ghost-load completely between washes." },
    ],
  },
  sr: {
    product: "Modern low-TDP mini-PC + 2-bay NAS",
    brand_examples: "Beelink SER8 / Synology DS224+",
    price_eur: 829,
    saves_kwh_per_year: 1450,
    payback_years: 2.0,
    kit: [
      { name: "Smart UPS w/ Modbus", price_eur: 220, why: "Lets the Kenergy dashboard read live draw + grid quality." },
      { name: "Shelly EM 50A", price_eur: 65, why: "Sub-circuit clamp meter for the rack — exposes a Local API endpoint." },
      { name: "Home Assistant Green", price_eur: 99, why: "Open hub so every replacement device shows up in one dashboard." },
    ],
  },
};

function AdminMonitoringPage() {
  const { user, loading: authLoading } = useAuth();
  const { access, loading } = useAccess();
  const [openId, setOpenId] = useState<string | null>(null);

  const totalDailyKwh = useMemo(() => fleet.reduce((s, m) => s + m.daily_kwh, 0), []);
  const degradedCount = useMemo(() => fleet.filter((m) => m.status !== "healthy").length, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted-foreground">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Fleet monitoring is admin-only.</p>
          <Link to="/login" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!access.isAdmin) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This dashboard simulates a fleet of household machines for the admin demo account.
            Switch to <span className="font-mono">admin@kenergy.demo</span> to view it.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const opened = openId ? { machine: fleet.find((m) => m.id === openId)!, replacement: replacements[openId] } : null;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
          <ShieldCheck className="h-3 w-3" /> Admin · Simulated fleet
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Live fleet monitoring</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A demo of what a paying customer with the Kenergy dashboard sees: real-time draw per
          machine, drift detection on efficiency, and one-click replacement suggestions when a
          device starts wasting energy.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Live total draw" value={`${fleet.reduce((s, m) => s + m.draw_w, 0).toLocaleString()} W`} icon={<Zap className="h-4 w-4" />} />
          <Stat label="Last 24h consumption" value={`${totalDailyKwh.toFixed(1)} kWh`} icon={<Cpu className="h-4 w-4" />} />
          <Stat label="Machines needing attention" value={`${degradedCount} / ${fleet.length}`} tone={degradedCount ? "warn" : "ok"} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {fleet.map((m) => (
            <MachineCard key={m.id} m={m} onSuggest={() => setOpenId(m.id)} />
          ))}
        </div>
      </main>

      {opened && (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label="Close"
            onClick={() => setOpenId(null)}
            className="flex-1 bg-black/40 backdrop-blur-sm"
          />
          <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Replacement suggestion</div>
                <h2 className="mt-1 text-xl font-bold">{opened.machine.name}</h2>
              </div>
              <button onClick={() => setOpenId(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {opened.replacement ? (
              <>
                <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
                    <Replace className="h-3 w-3" /> Recommended swap
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{opened.replacement.product}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{opened.replacement.brand_examples}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-background p-2">
                      <div className="font-semibold">€{opened.replacement.price_eur}</div>
                      <div className="text-muted-foreground">device</div>
                    </div>
                    <div className="rounded-md bg-background p-2">
                      <div className="font-semibold">{opened.replacement.saves_kwh_per_year} kWh</div>
                      <div className="text-muted-foreground">saved/yr</div>
                    </div>
                    <div className="rounded-md bg-background p-2">
                      <div className="font-semibold">{opened.replacement.payback_years}y</div>
                      <div className="text-muted-foreground">payback</div>
                    </div>
                  </div>
                </div>

                {opened.replacement.kit && opened.replacement.kit.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold">Full replacement kit</h4>
                    <p className="text-xs text-muted-foreground">Devices that work together and stream data to the Kenergy dashboard.</p>
                    <ul className="mt-3 space-y-2">
                      {opened.replacement.kit.map((k) => (
                        <li key={k.name} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{k.name}</span>
                            <span className="text-xs text-muted-foreground">€{k.price_eur}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{k.why}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  <Plus className="h-4 w-4" /> Add kit to action plan
                </button>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">Demo action — wiring to the real plan comes next.</p>
              </>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">No replacement needed — this machine is running well.</p>
            )}
          </aside>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function MachineCard({ m, onSuggest }: { m: Machine; onSuggest: () => void }) {
  const toneBorder =
    m.status === "degraded" ? "border-destructive/40" : m.status === "warning" ? "border-amber-500/40" : "border-border";
  const StatusIcon =
    m.status === "healthy" ? CheckCircle2 : AlertTriangle;
  const statusColor =
    m.status === "healthy" ? "text-emerald-500" : m.status === "warning" ? "text-amber-500" : "text-destructive";

  return (
    <div className={`rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] ${toneBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.category}</div>
          <div className="mt-0.5 text-base font-semibold">{m.name}</div>
        </div>
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-muted p-2">
          <div className="font-semibold">{m.draw_w.toLocaleString()} W</div>
          <div className="text-muted-foreground">live</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="font-semibold">{m.daily_kwh} kWh</div>
          <div className="text-muted-foreground">24h</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="font-semibold">{m.efficiency}%</div>
          <div className="text-muted-foreground">efficiency</div>
        </div>
      </div>
      {m.note && <p className="mt-3 text-xs text-muted-foreground">{m.note}</p>}
      {m.status !== "healthy" && (
        <button
          onClick={onSuggest}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Replace className="h-3 w-3" /> Suggest replacement
        </button>
      )}
    </div>
  );
}
