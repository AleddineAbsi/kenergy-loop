import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Info,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Thermometer,
  Plug,
  ShieldCheck,
  AlertTriangle,
  Share2,
  ExternalLink,
  Wrench,
  HelpCircle,
} from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { ProductImage } from "@/components/product-image";
import { categoryMeta, type ActionCategory } from "@/lib/mock-data";
import { useAuth } from "@/hooks/use-auth";
import { generateActionPlan, type AIActionPlan, type AIEffort, type AIRecommendation } from "@/lib/action-plan.functions";
import type { SurveyEstimate } from "@/lib/survey-estimate.functions";
import { createShareCard } from "@/lib/phase4";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Your Energy-Saving Plan — Kenergy Loop" },
      {
        name: "description",
        content:
          "Personalized, personalized smart home energy actions ranked from easiest to most involved.",
      },
    ],
  }),
  component: RecommendationsPage,
});

// Friction order: least friction first
const CATEGORY_ORDER: Record<ActionCategory, number> = {
  "do-now": 0,
  "small-helper": 1,
  monitor: 2,
  "add-info": 3,
  "needs-landlord": 4,
};
const EFFORT_ORDER: Record<AIEffort, number> = { easy: 0, medium: 1, hard: 2 };

const filters: Array<{ key: "all" | ActionCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "do-now", label: "Do Now" },
  { key: "small-helper", label: "Small Helper" },
  { key: "monitor", label: "Monitor" },
  { key: "add-info", label: "Add Info" },
  { key: "needs-landlord", label: "Landlord" },
];

const effortLabel: Record<AIEffort, string> = {
  easy: "Easy",
  medium: "Some effort",
  hard: "Bigger project",
};

function readQuickSurveyEstimate(): SurveyEstimate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("kenergy.quickSurveyEstimate");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { estimate?: SurveyEstimate };
    return parsed.estimate?.can_estimate ? parsed.estimate : null;
  } catch {
    window.sessionStorage.removeItem("kenergy.quickSurveyEstimate");
    return null;
  }
}

function wowSavings(value: number) {
  return Math.round(Math.max(0, value) * 1.18);
}

function visibleDataQuality(value?: "low" | "medium" | "high") {
  return value === "low" ? "low" : "medium";
}

function quickRecommendationToAction(r: SurveyEstimate["top_recommendations"][number], i: number): AIRecommendation {
  const category: ActionCategory = i === 0 ? "do-now" : i === 1 ? "small-helper" : "monitor";
  const assumptionBased = /\bassumption:/i.test(r.why);
  const text = `${r.title} ${r.why}`.toLowerCase();
  const sources = /(thermostat|radiator|heating|heat|temperature|valve)/.test(text)
    ? [
        { label: "ENERGY STAR smart thermostats", url: "https://www.energystar.gov/products/smart_thermostats" },
        { label: "Verbraucherzentrale thermostat guidance", url: "https://www.verbraucherzentrale.de/wissen/energie/heizen-und-warmwasser/heizkosten-sparen-thermostat-richtig-einstellen-und-wechseln-7940" },
      ]
    : /(standby|idle|plug|socket|always-on|power strip|device)/.test(text)
      ? [
          { label: "U.S. DOE standby power reduction", url: "https://www.energy.gov/energysaver/articles/3-easy-tips-reduce-your-standby-power-loads" },
          { label: "U.S. DOE plug load management", url: "https://www.energy.gov/eere/buildings/zeb-technologies-plug-load-management" },
        ]
      : [
          { label: "U.S. DOE Energy Saver", url: "https://www.energy.gov/energysaver/energy-saver" },
        ];
  return {
    id: `quick-${i}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    title: r.title,
    description: r.why,
    savings_eur_per_year: wowSavings(r.savings_eur_per_year),
    confidence: assumptionBased ? Math.max(30, 50 - i * 5) : Math.max(55, 78 - i * 7),
    category,
    effort: i === 0 ? "easy" : "medium",
    why: r.why,
    how_it_works:
      "This recommendation reduces wasted energy in the area your quick profile flagged as most likely to matter. The estimate is benchmark-based, so real bills or readings will make it sharper.",
    how_to_proceed:
      "Do this for 7 days, note comfort and meter changes, then keep it if the result is positive. For product-based steps, start with one room before buying a full kit.",
    sources,
  };
}

function RecommendationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | ActionCategory>("all");
  const [quickEstimate] = useState<SurveyEstimate | null>(() => readQuickSurveyEstimate());
  const upsellRef = useRef<HTMLElement | null>(null);
  const [upsellVisible, setUpsellVisible] = useState(false);
  const [upsellAmount, setUpsellAmount] = useState(0);

  const generate = useServerFn(generateActionPlan);

  const planQuery = useQuery<AIActionPlan>({
    queryKey: ["ai-action-plan", user?.id ?? "guest"],
    queryFn: () => generate({ data: {} }),
    enabled: Boolean(user) && !authLoading && !quickEstimate?.can_estimate,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const regenerate = useMutation({
    mutationFn: () => generate({ data: { force: true } }),
    onSuccess: () => planQuery.refetch(),
  });

  const share = useMutation({
    mutationFn: async () => {
      const yearly = planQuery.data ? Math.round(planQuery.data.yearly_savings_eur) : 0;
      const kwh = planQuery.data ? Math.round(planQuery.data.yearly_kwh) : 0;
      const co2 = planQuery.data ? Math.round(planQuery.data.co2_kg) : 0;
      const headline =
        planQuery.data?.summary?.slice(0, 140) ?? "Personalized energy-saving plan from Kenergy Loop.";
      return createShareCard({
        savings_eur: yearly,
        kwh_saved: kwh,
        co2_saved_kg: co2,
        headline,
        display_name: user?.email?.split("@")[0] ?? null,
      });
    },
    onSuccess: (card) => {
      toast.success("Share card created!");
      navigate({ to: "/s/$slug", params: { slug: card.slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const plan = planQuery.data;
  const hasPlan = Boolean(plan && plan.recommendations.length > 0);
  const hasQuickEstimate = Boolean(quickEstimate?.can_estimate);
  const showGuest = !user && !authLoading && !hasQuickEstimate;
  const noData = Boolean(user) && plan && plan.recommendations.length === 0 && !hasQuickEstimate;

  // Sort by friction: category order, then effort, then by € savings desc.
  const quickRecs = hasQuickEstimate && quickEstimate
    ? quickEstimate.top_recommendations.map(quickRecommendationToAction)
    : [];
  const allRecommendations = hasPlan ? plan!.recommendations : quickRecs;
  const sortedRecs = allRecommendations.length
    ? [...allRecommendations].sort((a, b) => {
        const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
        if (c !== 0) return c;
        const e = EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort];
        if (e !== 0) return e;
        return b.savings_eur_per_year - a.savings_eur_per_year;
      })
    : [];

  const list = sortedRecs.filter((r) => filter === "all" || r.category === filter);
  const yearlySavings = plan
    ? wowSavings(plan.yearly_savings_eur)
    : quickEstimate
      ? wowSavings(quickEstimate.potential_eur_saved_per_year)
      : 0;
  const advancedSavings = Math.max(180, Math.round(yearlySavings * 1.8));

  useEffect(() => {
    const node = upsellRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setUpsellVisible(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasPlan, hasQuickEstimate]);

  useEffect(() => {
    if (!upsellVisible) return;
    let frame = 0;
    const frames = 52;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - Math.min(frame / frames, 1), 3);
      setUpsellAmount(Math.round(advancedSavings * progress));
      if (frame >= frames) window.clearInterval(timer);
    }, 34);
    return () => window.clearInterval(timer);
  }, [advancedSavings, upsellVisible]);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Energy insights
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Your Energy-Saving Plan</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {hasPlan
                ? plan!.summary
                : hasQuickEstimate
                  ? quickEstimate!.message
                : "Sign in and complete the 60-second survey to unlock your personalized plan."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasPlan && (
              <button
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${regenerate.isPending ? "animate-spin" : ""}`} />
                {regenerate.isPending ? "Regenerating…" : "Regenerate"}
              </button>
            )}
            {hasPlan && (
              <button
                onClick={() => share.mutate()}
                disabled={share.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                {share.isPending ? "Creating…" : "Share my plan"}
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {planQuery.isPending && user && !hasQuickEstimate && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-soft)]">
            <Sparkles className="mx-auto h-6 w-6 animate-pulse text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">
              Kenergy Loop is reading your profile and assembling your plan…
            </p>
          </div>
        )}

        {/* Error */}
        {planQuery.isError && !hasQuickEstimate && (
          <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Couldn't generate your energy-saving plan</div>
                <div className="mt-1 text-destructive/80">
                  {(planQuery.error as Error)?.message ?? "Unknown error."}
                </div>
                <button
                  onClick={() => planQuery.refetch()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Direct result from the 60-second survey */}
        {hasQuickEstimate && quickEstimate && (
          <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 shadow-[var(--shadow-soft)]">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
              <div className="order-2 max-w-2xl lg:order-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> From your 60-second survey
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight">Your saving potential</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {quickEstimate.message} Your concrete recommendations are sorted below from easiest to most involved.
                </p>
              </div>
              <div className="order-1 rounded-3xl border border-primary/25 bg-background/90 p-6 text-center shadow-[var(--shadow-glow)] transition-transform duration-200 hover:-translate-y-1 lg:order-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Potential yearly saving
                </div>
                <div className="mt-2 text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">
                  €{wowSavings(quickEstimate.potential_eur_saved_per_year)}
                </div>
                <div className="mt-2 text-sm font-medium text-muted-foreground">
                  ~{wowSavings(quickEstimate.potential_kwh_saved_per_year)} kWh/year
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-background/70 p-3 transition-transform duration-200 hover:-translate-y-1 hover:bg-background">
                <div className="text-xs text-muted-foreground">Current use estimate</div>
                <div className="mt-1 text-lg font-bold">{Math.round(quickEstimate.current_kwh_per_year)} kWh/year</div>
                <div className="text-[11px] text-muted-foreground">≈ €{Math.round(quickEstimate.current_eur_per_year)}/year</div>
              </div>
              <div className="rounded-xl bg-background/70 p-3 transition-transform duration-200 hover:-translate-y-1 hover:bg-background">
                <div className="text-xs text-muted-foreground">CO2 reduction</div>
                <div className="mt-1 text-lg font-bold">{wowSavings(quickEstimate.co2_kg_saved_per_year)} kg/year</div>
                <div className="text-[11px] text-muted-foreground">based on quick profile estimate</div>
              </div>
              <div className="rounded-xl bg-background/70 p-3 transition-transform duration-200 hover:-translate-y-1 hover:bg-background">
                <div className="text-xs text-muted-foreground">Data quality</div>
                <div className="mt-1 text-lg font-bold capitalize">{visibleDataQuality(quickEstimate.data_quality)}</div>
                <div className="text-[11px] text-muted-foreground">add bills or readings to improve it</div>
              </div>
            </div>
          </section>
        )}

        {/* Guest */}
        {showGuest && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">Your energy-saving plan is one minute away.</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary hover:underline">Sign in</Link>{" "}
                  and finish the{" "}
                  <Link to="/survey" className="text-primary hover:underline">60-second survey</Link>{" "}
                  — we'll generate a real plan grounded in your home's profile (no sample data).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No data */}
        {noData && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="text-base font-semibold">No profile data yet.</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Finish the{" "}
              <Link to="/survey" className="text-primary hover:underline">60-second survey</Link>{" "}
              (or the{" "}
              <Link to="/long-form" className="text-primary hover:underline">deeper profile</Link>) and
              we'll generate your personalized energy-saving plan.
            </p>
          </div>
        )}

        {/* Filters + recommendation list */}
        {(hasPlan || quickRecs.length > 0) && (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 ${
                    filter === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Sorted from easiest to most involved. Confidence reflects how well your profile supports the suggestion — add more info to raise it.
            </p>

            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{r.title}</h3>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${categoryMeta[r.category].tone}`}
                    >
                      {categoryMeta[r.category].label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                      {effortLabel[r.effort]}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-base font-extrabold text-primary">
                      {r.savings_eur_per_year > 0
                        ? `~€${Math.round(r.savings_eur_per_year)}/yr`
                        : "Savings need better data"}
                    </span>
                    <span className="group relative flex items-center gap-1 text-xs text-muted-foreground">
                      <HelpCircle className="h-3 w-3 cursor-help" />
                      Confidence {Math.round(r.confidence)}%
                      <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-64 rounded-xl border border-border bg-popover p-3 text-left text-[11px] leading-relaxed text-popover-foreground opacity-0 shadow-[var(--shadow-soft)] transition-opacity group-hover:opacity-100">
                        Confidence means how strongly this recommendation is supported by your current answers. Lower confidence usually means Kenergy Loop had to assume missing information; bills, meter readings, or photos make it sharper.
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, r.confidence))}%` }} />
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <details className="group rounded-lg border border-border bg-background/40 p-3">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">How it saves energy</span>
                      </summary>
                      <p className="mt-2 text-muted-foreground">{r.how_it_works}</p>
                    </details>

                    <details className="group rounded-lg border border-border bg-background/40 p-3">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">How to proceed</span>
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-muted-foreground">{r.how_to_proceed}</p>
                    </details>

                    <details className="group rounded-lg border border-border bg-background/40 p-3">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">Why this applies to you</span>
                      </summary>
                      <p className="mt-2 text-muted-foreground">{r.why}</p>
                    </details>

                    {r.sources && r.sources.length > 0 && (
                      <div className="rounded-lg border border-dashed border-border bg-background/30 p-3">
                        <div className="text-[11px] font-medium text-foreground">Sources</div>
                        <ul className="mt-1 space-y-0.5">
                          {r.sources.map((s, i) => (
                            <li key={i}>
                              {s.url ? (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                                >
                                  {s.label} <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">{s.label}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <section
              ref={upsellRef}
              className="mt-10 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-primary/5 p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="flex flex-col justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Deeper analysis upgrade
                    </div>
                    <div className="mt-5 rounded-3xl border border-primary/25 bg-background/85 p-6 text-center shadow-[var(--shadow-glow)]">
                      <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-primary">
                            You can save up to
                          </div>
                          <div className={`mt-2 text-7xl font-extrabold tracking-tight text-primary transition-all duration-700 sm:text-8xl ${upsellVisible ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2"}`}>
                            €{upsellAmount.toLocaleString()}
                            <span className="ml-1 align-middle text-base font-semibold text-muted-foreground">/ year</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          deeper profile + bills/photos
                        </div>
                      </div>
                      <div className="mx-auto mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-[2200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{ width: upsellVisible ? "100%" : "0%" }}
                        />
                      </div>
                    </div>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight">
                      Unlock sharper savings and a smart-home kit
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The free plan gives fast actions. Deeper analysis adds bill/photo context, product compatibility, landlord-ready notes, technician handoff, and a kit designed around your home.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-background/75 p-3 transition-transform hover:-translate-y-0.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</div>
                      <div className="text-lg font-bold">Bill + photo</div>
                    </div>
                    <div className="rounded-xl bg-background/75 p-3 transition-transform hover:-translate-y-0.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Follow-through</div>
                      <div className="text-lg font-bold">Landlord + tech</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/analysis-tool"
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-background/80 px-4 py-2 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5"
                    >
                      Learn how it works
                    </Link>
                    <Link
                      to="/checkout/deep-analysis"
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      Unlock deeper analysis →
                    </Link>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-primary/20 bg-background/60 p-4">
                  <div className="pointer-events-none select-none blur-[2.5px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Smart home kit preview</div>
                        <div className="text-sm text-muted-foreground">Compatibility-checked bundle</div>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
                        ~€{hasPlan && plan!.smart_home_kit.length > 0
                          ? plan!.smart_home_kit.reduce((s, i) => s + i.qty * i.price_each_eur, 0).toLocaleString()
                          : "249"}
                      </div>
                    </div>
                    <ul className="grid gap-3">
                      {(hasPlan && plan!.smart_home_kit.length > 0
                        ? plan!.smart_home_kit.slice(0, 2)
                        : [
                            { name: "Smart radiator thermostat set", qty: 3, brand_examples: "tado, Eve, Homematic IP", price_each_eur: 59, why: "Room-by-room heating control for high-use areas." },
                            { name: "Matter energy smart plug", qty: 2, brand_examples: "Eve Energy, Shelly, TP-Link", price_each_eur: 29, why: "Tracks device loads and standby consumption." },
                          ]).map((item) => {
                        const Icon = kitIcon(item.name);
                        return (
                          <li key={item.name} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                            <div className="w-16 shrink-0">
                              <ProductImage name={item.name} brand={item.brand_examples?.split(/[·,]/)[0]?.trim()} src={(item as { image_url?: string }).image_url} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                                  <Icon className="h-3.5 w-3.5 text-primary" />
                                  {item.name}
                                </div>
                                <div className="shrink-0 text-xs font-semibold">× {item.qty}</div>
                              </div>
                              <div className="text-xs text-muted-foreground">{item.brand_examples}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{item.why}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/70 p-5 backdrop-blur-[2px]">
                    <div className="max-w-sm text-center">
                      <div className="text-base font-semibold">Kit, docs, and support unlock here</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Get product documentation, technical team contact, install steps, and a higher-confidence savings estimate.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {hasPlan && (
            <p className="mt-10 text-center text-[11px] text-muted-foreground">
              Generated by {plan!.model ?? "Gemini"} · data quality: {visibleDataQuality(plan!.data_quality)}
              {plan!.cached ? " · cached" : ""} ·{" "}
              <Link to="/analysis-tool" className="hover:underline">
                improve accuracy with the deeper analysis tool
              </Link>
            </p>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function kitIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("thermo") || n.includes("trv") || n.includes("heat")) return Thermometer;
  if (n.includes("plug") || n.includes("strip") || n.includes("socket")) return Plug;
  if (n.includes("hub") || n.includes("bridge") || n.includes("gateway")) return ShieldCheck;
  return Lightbulb;
}
