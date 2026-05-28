import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  FileText,
  ListChecks,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Gauge,
} from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";

export const Route = createFileRoute("/analysis-tool")({
  head: () => ({
    meta: [
      { title: "Deeper analysis tool — Kenergy" },
      {
        name: "description",
        content:
          "How the Kenergy deeper analysis tool sharpens your AI plan using bill uploads, room photos, and a few extra questions.",
      },
      { property: "og:title", content: "Deeper analysis tool — Kenergy" },
      {
        property: "og:description",
        content:
          "Optional, friendly tools (bill upload, room scan, deeper profile) that raise the confidence of your AI energy plan.",
      },
    ],
  }),
  component: AnalysisToolPage,
});

function AnalysisToolPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Optional · always free
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">The deeper analysis tool</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Your 60-second plan is already useful. The deeper analysis tool is for when you want
          higher-confidence numbers and more specific recommendations — by giving the AI a clearer
          picture of your actual home and consumption.
        </p>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Tool
            icon={<ListChecks className="h-5 w-5" />}
            title="Deeper profile (≈15 questions)"
            body="A few extra answers about appliances, heating habits, and daily usage. Each answer narrows the AI's assumptions, so estimates stop being averages and start being yours."
            cta={{ to: "/long-form", label: "Open the deeper profile" }}
          />
          <Tool
            icon={<FileText className="h-5 w-5" />}
            title="Bill upload"
            body="Drop in a recent electricity or heating bill (PDF or photo). The AI reads your real kWh/year and tariff, then re-grounds every savings number on actual consumption — no more rough guesses."
            cta={{ to: "/long-form", label: "Upload a bill" }}
          />
          <Tool
            icon={<Camera className="h-5 w-5" />}
            title="Room scan (photo)"
            body="Snap a photo of a room. Computer vision spots specific devices (old bulbs, standby clusters, single-pane windows, electric heaters) so suggestions target what you actually own."
            cta={{ to: "/scan", label: "Scan a room" }}
          />
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-xl font-semibold">What changes in your plan</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <Bullet
              icon={<Gauge className="h-4 w-4 text-primary" />}
              title="Higher confidence scores"
              body="Each recommendation shows a confidence %. With more real data, weak (~50%) suggestions become strong (80–95%). You can see immediately which actions are safe bets."
            />
            <Bullet
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              title="More accurate € and kWh estimates"
              body="Bill-grounded plans replace national averages with your real tariff and usage. Expect savings ranges to tighten by 2–3×."
            />
            <Bullet
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Smarter recommendations"
              body="Photos let the AI skip irrelevant advice (you already have LEDs) and surface specific wins (a 90W TV cluster on standby; a north-facing single-pane window)."
            />
            <Bullet
              icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              title="Source-cited where possible"
              body="When the AI relies on public figures (BfEE, dena, ADEME, IEA, vendor specs) it cites them. Deeper data lets it cite YOUR data instead — even better."
            />
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Your data, your call</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Bills and photos are stored privately under your account and used only to generate your
            plan. You can skip any of these tools, use just one, or use all three. The 60-second
            survey alone always gives you a working plan.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/long-form"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            Start the deeper analysis →
          </Link>
          <Link
            to="/recommendations"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to my plan
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Tool({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { to: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link
        to={cta.to}
        className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
      >
        {cta.label} →
      </Link>
    </div>
  );
}

function Bullet({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
    </li>
  );
}
