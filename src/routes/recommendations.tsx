import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { generateActionPlan, type AIActionPlan, type AIEffort } from "@/lib/action-plan.functions";
import { createShareCard } from "@/lib/phase4";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Your AI action plan — Kenergy" },
      {
        name: "description",
        content:
          "AI-generated, personalized smart home energy actions ranked from easiest to most involved.",
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

function RecommendationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | ActionCategory>("all");

  const generate = useServerFn(generateActionPlan);

  const planQuery = useQuery<AIActionPlan>({
    queryKey: ["ai-action-plan", user?.id ?? "guest"],
    queryFn: () => generate({ data: {} }),
    enabled: Boolean(user) && !authLoading,
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
        planQuery.data?.summary?.slice(0, 140) ?? "Personalized AI energy plan from Kenergy.";
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
  const showGuest = !user && !authLoading;
  const noData = Boolean(user) && plan && plan.recommendations.length === 0;

  // Sort by friction: category order, then effort, then by € savings desc.
  const sortedRecs = hasPlan
    ? [...plan!.recommendations].sort((a, b) => {
        const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
        if (c !== 0) return c;
        const e = EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort];
        if (e !== 0) return e;
        return b.savings_eur_per_year - a.savings_eur_per_year;
      })
    : [];

  const list = sortedRecs.filter((r) => filter === "all" || r.category === filter);
  const yearlySavings = plan ? Math.round(plan.yearly_savings_eur) : 0;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> AI-generated plan
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Your AI action plan</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {hasPlan
                ? plan!.summary
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
            {hasPlan && (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-[var(--shadow-soft)]">
                Estimated yearly savings:{" "}
                <span className="font-semibold text-primary">€{yearlySavings.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {planQuery.isPending && user && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-soft)]">
            <Sparkles className="mx-auto h-6 w-6 animate-pulse text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">
              The AI is reading your profile and assembling your plan…
            </p>
          </div>
        )}

        {/* Error */}
        {planQuery.isError && (
          <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Couldn't generate your AI plan</div>
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

        {/* Guest */}
        {showGuest && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">Your AI plan is one minute away.</div>
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
              we'll generate your personalized AI plan.
            </p>
          </div>
        )}

        {/* Filters + list (only if we have a real plan) */}
        {hasPlan && (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
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

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-semibold text-primary">
                      {r.savings_eur_per_year > 0
                        ? `~€${Math.round(r.savings_eur_per_year)}/yr`
                        : "Savings need better data"}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                      title="How confident this suggestion is given your current profile info."
                    >
                      <HelpCircle className="h-3 w-3" /> Confidence {Math.round(r.confidence)}%
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

            {/* Friendly deeper-analysis CTA */}
            <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="max-w-xl">
                    <h3 className="text-base font-semibold">Want higher confidence on these numbers?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No pressure — the plan above already works. If you'd like sharper estimates, our
                      deeper analysis tool can read a recent bill, a room photo, or a few extra answers
                      and re-ground every recommendation in your real consumption.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/analysis-tool"
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    Learn how it works
                  </Link>
                  <Link
                    to="/long-form"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
                  >
                    Open deeper analysis →
                  </Link>
                </div>
              </div>
            </div>

            {/* Kit */}
            {plan!.smart_home_kit.length > 0 && (
              <section className="mt-12">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                      <Sparkles className="h-3 w-3" /> AI-curated kit
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">
                      Smart home kit tailored to your home
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Compatibility-checked across multiple brands. Indicative pricing.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                    Indicative total:{" "}
                    <span className="font-semibold">
                      ~€
                      {plan!.smart_home_kit
                        .reduce((s, i) => s + i.qty * i.price_each_eur, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="relative mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <ul className="grid gap-3 md:grid-cols-2 pointer-events-none select-none blur-[3px]">
                    {plan!.smart_home_kit.map((item) => {
                      const Icon = kitIcon(item.name);
                      return (
                        <li
                          key={item.name}
                          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                        >
                          <div className="w-20 shrink-0">
                            <ProductImage name={item.name} brand={item.brand_examples?.split(/[·,]/)[0]?.trim()} src={(item as { image_url?: string }).image_url} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {item.name}{" "}
                                <span className="font-normal text-muted-foreground">× {item.qty}</span>
                              </div>
                              <div className="shrink-0 text-sm font-semibold">
                                ~€{(item.qty * item.price_each_eur).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.brand_examples} · checked for compatibility
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{item.why}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/70 p-5 backdrop-blur-[2px]">
                    <div className="max-w-md text-center">
                      <div className="text-base font-semibold">Smart home kit is part of deeper analysis</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Unlock the paid deeper analysis to get the tailored kit, compatibility notes, assumptions, and advanced savings estimate.
                      </p>
                      <Link to="/checkout/deep-analysis" className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                        Open paid deeper analysis
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <p className="mt-10 text-center text-[11px] text-muted-foreground">
              Generated by {plan!.model ?? "Gemini"} · data quality: {plan!.data_quality}
              {plan!.cached ? " · cached" : ""} ·{" "}
              <Link to="/analysis-tool" className="hover:underline">
                improve accuracy with the deeper analysis tool
              </Link>
            </p>
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
