import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Leaf, Cpu, Timer, ShieldCheck, Sparkles } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kenergy — AI energy optimizer for smart home appliances" },
      {
        name: "description",
        content:
          "Kenergy is an AI energy optimizer for smart home appliances. Build your energy profile in 60 seconds and unlock a personalized action plan that cuts your bill.",
      },
      { property: "og:title", content: "Kenergy — AI energy optimizer for smart home appliances" },
      {
        property: "og:description",
        content: "60-second profile, AI action plan, real savings on your smart appliances.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10 opacity-90"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden
          />
          <div className="mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
            <div className="text-primary-foreground">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
                <Leaf className="h-3 w-3" /> AI energy optimizer for smart home appliances
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Lower your bill.<br />Automate every appliance.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/90">
                Answer 12 quick questions and Kenergy's AI builds your home's energy profile,
                ranks the actions that save the most, and sketches a smart-home kit you can
                actually order.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/survey"
                  className="inline-flex items-center gap-2 rounded-md bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
                >
                  <Timer className="h-4 w-4" /> Start 60-second survey
                </Link>
                <Link
                  to="/recommendations"
                  className="inline-flex items-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-white/10"
                >
                  See sample action plan
                </Link>
              </div>
              <p className="mt-4 text-xs text-primary-foreground/70">
                No signup needed. Works without a smart meter.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: Timer, title: "1. 60-second survey", body: "Tell us about your home and appliances. No bills, no smart meter required." },
              { icon: Cpu, title: "2. AI action plan", body: "We rank optimizations for every smart appliance by € saved and kg CO₂ avoided." },
              { icon: LineChart, title: "3. Track savings", body: "Monitor consumption and watch your kWh drop week after week." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Private by default</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Grounded in a curated knowledge base</span>
            <span className="inline-flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-primary" /> No vendor lock-in</span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
