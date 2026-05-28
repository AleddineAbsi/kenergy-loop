import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { recordPricingIntent } from "@/lib/phase4";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Kenergy" },
      {
        name: "description",
        content:
          "Free recommendations forever. Pay only for monitoring history, alerts, and reports.",
      },
    ],
  }),
  component: PricingPage,
});

type Tier = {
  key: "free" | "monitor" | "household";
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight: boolean;
};

const tiers: Tier[] = [
  {
    key: "free",
    name: "Free",
    price: "€0",
    tagline: "Everything you need to start saving.",
    features: [
      "Unlimited room scans",
      "AI action plan & share card",
      "Personalized free actions",
      "60-second profile",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    key: "monitor",
    name: "Monitor",
    price: "€4",
    period: "/mo",
    tagline: "Track your savings over time.",
    features: [
      "Everything in Free",
      "Consumption history & trends",
      "Anomaly alerts",
      "Monthly PDF reports",
      "Bill OCR",
    ],
    cta: "Join Monitor waitlist",
    highlight: true,
  },
  {
    key: "household",
    name: "Household",
    price: "€9",
    period: "/mo",
    tagline: "For shared flats and families.",
    features: [
      "Everything in Monitor",
      "Up to 5 members",
      "Smart-plug integrations",
      "Priority support",
    ],
    cta: "Join Household waitlist",
    highlight: false,
  },
];

function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const intent = useMutation({
    mutationFn: (tier: string) => recordPricingIntent(tier),
    onSuccess: (_, tier) =>
      toast.success(`You're on the ${tier} waitlist. We'll email you when it opens.`),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCta(t: Tier) {
    if (t.key === "free") {
      navigate({ to: "/survey" });
      return;
    }
    if (!user) {
      toast.error("Sign in to join the waitlist.");
      navigate({ to: "/login" });
      return;
    }
    intent.mutate(t.name);
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Free forever for the AI plan
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Free advice. Paid monitoring.</h1>
          <p className="mt-3 text-muted-foreground">
            Recommendations stay free forever. Paid tiers — for history, alerts, and automation —
            are opening soon. Join the waitlist below.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.key}
              className={`flex flex-col rounded-3xl border p-6 shadow-[var(--shadow-soft)] ${
                t.highlight ? "border-primary bg-card ring-2 ring-primary/30" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t.name}</h2>
                {t.highlight && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{t.price}</span>
                {t.period && <span className="text-sm text-muted-foreground">{t.period}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCta(t)}
                disabled={intent.isPending}
                className={`mt-6 w-full rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  t.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:bg-muted"
                } disabled:opacity-50`}
              >
                {intent.isPending && intent.variables === t.name ? "Saving…" : t.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Already signed in?{" "}
          <Link to="/profile" className="text-primary hover:underline">
            See your profile
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
