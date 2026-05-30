import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, BadgeEuro, Gauge, Info, Sparkles, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { RoomAnalysis } from "@/lib/scan.functions";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/scan_/result")({
  head: () => ({
    meta: [
      { title: "Room scan result - Kenergy Loop" },
      { name: "description", content: "Your Kenergy Loop room scan result." },
    ],
  }),
  validateSearch: searchSchema,
  component: ScanResultPage,
});

type ScanRow = {
  id: string;
  image_path: string;
  analysis: RoomAnalysis | null;
  model: string | null;
  created_at: string;
};

function ScanResultPage() {
  const { id } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setProblem(null);

      try {
        let query = supabase
          .from("room_scans")
          .select("id, image_path, analysis, model, created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (id) query = query.eq("id", id).limit(1);

        const { data, error } = await query.maybeSingle();
        if (cancelled) return;

        if (error) {
          console.error("Could not load room scan result:", error);
          setProblem(error.message);
          setScan(null);
          return;
        }

        if (!data) {
          const message = id ? `No scan result found for id ${id}.` : "No scan result was found for this account.";
          console.error(message);
          setProblem(message);
          setScan(null);
          return;
        }

        const row = data as unknown as ScanRow;
        if (!row.analysis) {
          const message = `Scan ${row.id} exists, but the analysis payload is empty.`;
          console.error(message, row);
          setProblem(message);
        }

        setScan(row);

        const signed = await supabase.storage.from("room-scans").createSignedUrl(row.image_path, 300);
        if (cancelled) return;
        if (signed.error) {
          console.error("Could not load room scan preview:", signed.error);
          setProblem(`Result loaded, but the image preview failed: ${signed.error.message}`);
        }
        setImageUrl(signed.data?.signedUrl ?? null);
      } catch (err) {
        console.error("Unexpected scan result page error:", err);
        setProblem(err instanceof Error ? err.message : "Unexpected result page error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResult();
    return () => {
      cancelled = true;
    };
  }, [authLoading, id]);

  if (!user && !authLoading) {
    return (
      <Shell>
        <ResultFrame>
          <ProblemBlock title="Sign in required" text="Room scan results are private to your account." />
          <Link to="/login" className="mt-5 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Sign in
          </Link>
        </ResultFrame>
      </Shell>
    );
  }

  if (loading || authLoading) {
    return (
      <Shell>
        <ResultFrame>
          <ScanResultLoading />
        </ResultFrame>
      </Shell>
    );
  }

  const analysis = scan?.analysis;
  const appliances = analysis?.appliances ?? [];
  const totalKwh = appliances.reduce((sum, item) => sum + (item.est_kwh_per_year ?? 0), 0);
  const standbyWatts = appliances.reduce((sum, item) => sum + (item.est_standby_w ?? 0), 0);
  const percentile = Math.max(1, Math.min(99, Math.round(analysis?.germany_percentile ?? 50)));
  const socialMetric = getSocialMetric(percentile);
  const saving = estimateTopActionSaving(analysis?.est_room_kwh_per_year ?? totalKwh, standbyWatts);

  return (
    <Shell>
      <main className="mx-auto max-w-5xl flex-1 px-4 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                Visible energy footprint
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your room energy footprint</h1>
            </div>
            {scan?.model && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{scan.model}</span>}
          </div>

          {problem && <ProblemBlock title="There was a problem" text={problem} />}

          {!analysis && !problem && (
            <ProblemBlock
              title="There was a problem"
              text="The result page loaded, but no model output was available for this scan."
            />
          )}

          {analysis && (
            <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-1" style={{ background: "var(--gradient-hero)" }}>
                <div className="text-xs uppercase tracking-wide opacity-80">{analysis.room_type || "Room"}</div>
                <div className="mt-5 rounded-2xl bg-white/15 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold opacity-90">Your room uses more visible energy than</div>
                      <div className="mt-2 flex items-end gap-3">
                        <span className="text-7xl font-bold leading-none">{percentile}%</span>
                        <span className="pb-2 text-lg font-semibold opacity-85">of similar rooms</span>
                      </div>
                    </div>
                    <PercentileInfo percentile={percentile} />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                    <Trophy className="h-4 w-4" />
                    {socialMetric.title}
                  </div>
                </div>
                {imageUrl && <img src={imageUrl} alt="Scanned room" className="mt-5 h-56 w-full rounded-xl object-cover shadow-lg" />}
              </div>

              <div className="space-y-4">
                <ResultGrid
                  items={[
                    ["Grade", <GradeValue key="grade" grade={analysis.grade ?? "unknown"} />],
                    ["Building", analysis.building_type ?? "unknown"],
                    ["AC visible", analysis.has_ac ? "yes" : "no"],
                    ["Windows", String(analysis.windows ?? 0)],
                    ["Heating points", String(analysis.heating_points ?? 0)],
                    ["Room kWh/year", String(Math.round(analysis.est_room_kwh_per_year ?? 0))],
                  ]}
                />
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Gauge className="h-4 w-4" />
                    Top action
                  </div>
                  <p className="mt-1 text-sm font-medium">{analysis.top_action || "No action returned."}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Mini label="Energy saving" value={`~${saving.kwhMin}-${saving.kwhMax} kWh/year`} />
                    <Mini label="Cost saving" value={`~€${saving.euroMin}-€${saving.euroMax}/year`} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Conservative visible-photo range using about €0.40/kWh. Real savings need your usage habits.
                  </p>
                </div>
              </div>
            </section>
          )}

          {analysis?.appliances?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-bold tracking-tight">What Kenergy Loop noticed</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {analysis.appliances.map((item, index) => (
                  <article key={`${item.name}-${index}`} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
                    <div className="flex gap-4">
                      <MachineThumb category={item.category} name={item.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {item.detection_confidence ?? 0}% object confidence
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{item.category}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.brand ? `${item.brand}${item.model ? ` ${item.model}` : ""}` : "No reliable brand/model detected"}
                          {item.brand_confidence ? ` - ${item.brand_confidence}% brand confidence` : ""}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                          <Mini label="Standby" value={`${Math.round(item.est_standby_w ?? 0)} W`} />
                          <Mini label="Active" value={item.est_active_w == null ? "unknown" : `${Math.round(item.est_active_w)} W`} />
                          <Mini label="Usage" value={item.est_hours_per_day == null ? "unknown" : `${item.est_hours_per_day} h/day`} />
                          <Mini label="Yearly" value={item.est_kwh_per_year == null ? "unknown" : `${Math.round(item.est_kwh_per_year)} kWh`} />
                        </div>
                        {item.notes && <p className="mt-3 text-sm text-muted-foreground">{item.notes}</p>}
                        {item.consumption_source && (
                          <p className="mt-2 text-xs">
                            <span className="text-muted-foreground">Source: </span>
                            {item.consumption_source_url ? (
                              <a href={item.consumption_source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                                {item.consumption_source}
                              </a>
                            ) : (
                              <span className="font-medium">{item.consumption_source}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : analysis ? (
            <ProblemBlock title="No machines returned" text="The model output exists, but it did not include detected appliances." />
          ) : null}

          <div className="mt-8 rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center gap-2 font-semibold">
              <BadgeEuro className="h-5 w-5 text-primary" />
              Want sharper numbers and more advanced recommendations?
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Take the free 60-second survey and get your result immediately. Kenergy Loop will use your home size,
              heating type, household size, and budget instead of only a photo.
            </p>
            <Link to="/survey" className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              Get my free instant plan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/" className="inline-flex rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
              Home
            </Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}

function ResultFrame({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-24 text-center">{children}</main>;
}

function ScanResultLoading() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-primary/20 bg-card p-8 shadow-[var(--shadow-soft)]">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
        <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
        <Zap className="relative h-8 w-8 animate-pulse" />
      </div>
      <h2 className="mt-5 text-xl font-bold">Preparing your result</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Loading the detected machines, energy percentile, and savings estimate.
      </p>
      <div className="mt-5 grid gap-2">
        {["Appliance estimate", "Percentile check", "Top action"].map((item, index) => (
          <div key={item} className="overflow-hidden rounded-xl bg-muted p-2 text-left text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>{item}</span>
              <span className="text-primary">...</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${55 + index * 15}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-left text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-1">{text}</div>
      </div>
    </div>
  );
}

function ResultGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted p-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function GradeValue({ grade }: { grade: string }) {
  return (
    <span className="group relative inline-flex items-center gap-1.5">
      <span>{grade}</span>
      <button
        type="button"
        aria-label="Explain grade"
        className="grid h-5 w-5 place-items-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute left-0 top-7 z-10 hidden w-52 rounded-xl border border-border bg-popover p-3 text-xs font-normal text-popover-foreground shadow-[var(--shadow-soft)] group-hover:block group-focus-within:block">
        A is best and means the room looks low-consumption. G is worst and means the room looks energy-heavy.
        This grade is estimated from the photo, not from a meter reading.
      </span>
    </span>
  );
}

function PercentileInfo({ percentile }: { percentile: number }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Explain room energy percentile"
        className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-primary-foreground transition-colors hover:bg-white/25"
      >
        <Info className="h-4 w-4" />
      </button>
      <span className="pointer-events-none absolute right-0 top-9 z-10 hidden w-72 rounded-xl border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-[var(--shadow-soft)] group-hover:block group-focus-within:block">
        This means the room appears more energy-heavy than about {percentile}% of comparable rooms,
        and lighter than about {100 - percentile}%. The calculation compares visible estimated room kWh
        against broad household electricity benchmark bands. It is a photo-based estimate, not a meter reading.
      </span>
    </span>
  );
}

function MachineThumb({ category, name }: { category: string; name: string }) {
  const label = categoryLabel(category, name);
  const src = `https://mockimg.dev/160x120/f4f7f2/31533f.png?text=${encodeURIComponent(label)}`;

  return (
    <img
      src={src}
      alt=""
      className="hidden h-24 w-28 shrink-0 rounded-xl border border-border bg-muted object-cover sm:block"
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

function categoryLabel(category: string, name: string) {
  const fallback = name.length > 18 ? name.slice(0, 16) + "..." : name;
  const labels: Record<string, string> = {
    lighting: "Light",
    heating: "Heater",
    cooling: "AC",
    entertainment: "Media",
    kitchen: "Kitchen",
    standby: "Standby",
    office: "Device",
    laundry: "Laundry",
    other: fallback,
  };

  return labels[category] ?? fallback;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function getSocialMetric(percentile: number) {
  if (percentile <= 1) {
    return {
      title: "You are in the lowest 1% for visible room consumption",
      text: "That is good: this room appears to use less visible energy than about 99% of comparable German rooms.",
    };
  }

  if (percentile <= 10) {
    return {
      title: `You are in the lowest ${percentile}% for visible room consumption`,
      text: `That is good: this room appears to use less visible energy than about ${100 - percentile}% of comparable German rooms.`,
    };
  }

  if (percentile >= 90) {
    return {
      title: `You are in the highest ${100 - percentile + 1}% for visible room consumption`,
      text: `That means this room appears more energy-heavy than about ${percentile}% of comparable German rooms.`,
    };
  }

  return {
    title: `You are around the ${percentile}th percentile for visible room consumption`,
    text: `That means this room appears more energy-heavy than about ${percentile}% of comparable German rooms, and lighter than about ${100 - percentile}%.`,
  };
}

function estimateTopActionSaving(roomKwhPerYear: number, standbyWatts: number) {
  const standbyKwh = (standbyWatts * 24 * 365) / 1000;
  const standbySaving = standbyKwh * 0.35;
  const behaviorSaving = Math.max(0, roomKwhPerYear) * 0.08;
  const baseKwh = Math.max(18, Math.min(180, Math.round(Math.max(standbySaving, behaviorSaving))));
  const kwhMin = Math.max(12, Math.round(baseKwh * 0.85));
  const kwhMax = Math.max(kwhMin + 8, Math.round(baseKwh * 1.45));
  const euroMin = Math.max(1, Math.round(kwhMin * 0.4));
  const euroMax = Math.max(euroMin + 1, Math.round(kwhMax * 0.4));
  const advancedEuro = Math.max(45, Math.min(240, Math.round(euroMax * 4.5)));
  const extraEuro = Math.max(20, Math.round(advancedEuro - euroMax));

  return { kwhMin, kwhMax, euroMin, euroMax, advancedEuro, extraEuro };
}
