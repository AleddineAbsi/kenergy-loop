import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { grantDeepAnalysis } from "@/lib/access.functions";

export const Route = createFileRoute("/checkout/deep-analysis")({
  head: () => ({
    meta: [
      { title: "Unlock Deep Analysis — Kenergy Loop" },
      { name: "description", content: "One-time Deep Analysis: full questionnaire, bill uploads, product picks, and ecosystem kit." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { access, refetch } = useAccess();
  const grant = useServerFn(grantDeepAnalysis);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulatePurchase() {
    setError(null);
    setBusy(true);
    try {
      await grant({ data: { source: "purchase" } });
      await refetch();
      setDone(true);
      setTimeout(() => navigate({ to: "/long-form" }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grant access");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> One-time purchase
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Deep Analysis — €19</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlock the full diagnostic workspace: detailed questionnaire, electricity-bill &amp;
            appliance-photo uploads, a Kenergy Loop-written Energy Report with concrete product picks across three
            tiers, and an interoperable ecosystem kit you can later plug into the Kenergy Loop dashboard.
            Your Energy Report is saved forever — view it anytime without re-spending credits.
          </p>

          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Detailed long-form questionnaire (heating, PV, EV, schedules…)",
              "Upload bills & appliance photos as evidence",
              "Free-text notes — add anything we should know",
              "Concrete product picks: budget · balanced · integrated",
              "Compatible ecosystem kit (Matter / Zigbee / Home Assistant)",
              "Saved history — no re-running the check to revisit it",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {!user ? (
            <Link
              to="/login"
              className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in to continue
            </Link>
          ) : access.hasDeepAnalysis ? (
            <div className="mt-8 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
              You already have Deep Analysis access.{" "}
              <Link to="/long-form" className="font-semibold text-primary hover:underline">
                Open the workspace →
              </Link>
            </div>
          ) : (
            <>
              <button
                onClick={handleSimulatePurchase}
                disabled={busy || done}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {done ? "Unlocked — redirecting…" : "Simulate purchase (€19) — instant unlock"}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Demo checkout — no real payment is processed. Plug in Stripe later for production billing.
              </p>
              {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
