import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Camera,
  ClipboardCheck,
  Euro,
  Gauge,
  Leaf,
  LineChart,
  Mail,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiteFooter, SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kenergy Loop - renter-first energy savings app" },
      {
        name: "description",
        content:
          "Kenergy Loop turns a room photo and a short home profile into free renter-friendly energy-saving actions, deeper analysis, and consumption monitoring.",
      },
      { property: "og:title", content: "Kenergy Loop - renter-first energy savings app" },
      {
        property: "og:description",
        content: "Scan your room, get an energy score, unlock free saving actions, and track progress when you are ready.",
      },
    ],
  }),
  component: Index,
});

const features: Feature[] = [
  {
    icon: Camera,
    eyebrow: "Fast entry point",
    title: "Room scan",
    body: "A photo scan detects visible machines, heating points, windows, cooling devices, and rough appliance consumption. It is useful for a quick first estimate before asking for detailed data.",
    points: ["Visible appliance detection", "Confidence on detected objects", "Photo-based consumption estimate"],
  },
  {
    icon: Timer,
    eyebrow: "Free profile",
    title: "Free 60-second profile",
    body: "The short survey builds the basic energy profile: home size, building type, heating system, household size, biggest problem, and budget. The result is immediate and does not require a smart meter.",
    points: ["Personalized home context", "Budget-aware recommendations", "Immediate result"],
  },
  {
    icon: ClipboardCheck,
    eyebrow: "Decision engine",
    title: "Actionable saving plan",
    body: "Kenergy Loop ranks actions and product suggestions from low-friction to high-friction, cheap to expensive, and small savings to larger yearly impact. It separates what the renter can do alone from items that need a landlord, technician, or another stakeholder.",
    points: ["Do-it-yourself actions", "Landlord or technician actions", "Estimated yearly savings"],
  },
  {
    icon: Users,
    eyebrow: "Implementation support",
    title: "Guided follow-through",
    body: "The app does not stop at advice. It can guide the user through what to check, which documents to collect, where a technician may be needed, and how to explain the issue to a landlord.",
    points: ["Checklist for each action", "Documents to gather", "Who needs to be involved"],
  },
  {
    icon: Mail,
    eyebrow: "Communication",
    title: "Energy emails and reports",
    body: "For actions that involve a landlord or technician, Kenergy Loop can draft a professional message with the relevant technical details, the suspected issue, and the supporting context.",
    points: ["Landlord-ready explanation", "Technical details included", "Clear non-legal wording"],
  },
  {
    icon: Gauge,
    eyebrow: "Reliability",
    title: "Confidence, sources, and uncertainty",
    body: "Every recommendation is tied to an accuracy level. If the system is unsure, it says so. When it uses external benchmarks or product knowledge, it explains the basis and shows sources where available.",
    points: ["Confidence levels", "Sources when available", "Honest uncertainty"],
  },
  {
    icon: BarChart3,
    eyebrow: "Progressive profile",
    title: "More data improves the result",
    body: "The profile becomes more accurate as the user adds room photos, meter readings, bill uploads, completed actions, and real usage habits.",
    points: ["Photos and bills", "Manual meter readings", "Completed-action feedback"],
  },
  {
    icon: LineChart,
    eyebrow: "Ongoing tracking",
    title: "Monitoring dashboard",
    body: "Monitoring tracks consumption trends, recent readings, alerts, monthly estimates, and appliance status. Smart devices can be connected through compatible ecosystems and standards such as Matter when available.",
    points: ["Regular consumption baseline", "Broken or inefficient device alerts", "Smart-device integrations"],
  },
  {
    icon: Euro,
    eyebrow: "Business model",
    title: "Free advice, paid monitoring",
    body: "Kenergy Loop keeps the core recommendations free. Paid value comes from longer history, alerts, reports, monitoring, automation, product comparisons, and deeper savings analysis.",
    points: ["Free saving plan", "Paid dashboard history", "Reports and alerts"],
  },
];

type Feature = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
};

function Index() {
  const revealTimerRef = useRef<number | null>(null);
  const [visibleScene, setVisibleScene] = useState(0);

  useEffect(() => {
    const scenes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-autoscene]"));

    const reveal = (index: number) => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => setVisibleScene((current) => Math.max(current, index)), 60);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const index = Number((best.target as HTMLElement).dataset.autoscene);
        if (!Number.isNaN(index)) reveal(index);
      },
      { rootMargin: "-10% 0px -18% 0px", threshold: [0.12, 0.3, 0.55] },
    );

    scenes().forEach((scene) => observer.observe(scene));

    return () => {
      observer.disconnect();
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="relative isolate overflow-x-hidden">
        <FixedGreenBackdrop />
        <HeroSection visible={visibleScene >= 0} />
        <ProcessSection visible={visibleScene >= 1} />
        {features.map((feature, index) => (
          <FeatureSection key={feature.title} feature={feature} index={index} visible={visibleScene >= index + 2} />
        ))}
        <TrustSection />
        <HomeLegalFooter />
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroSection({ visible }: { visible: boolean }) {
  return (
    <section data-autoscene={0} className="relative z-10 grid min-h-[58vh] place-items-center overflow-hidden px-4 py-10">
      <div className={`relative mx-auto max-w-3xl rounded-[2rem] border border-white/15 bg-white/10 px-5 py-8 text-center text-primary-foreground shadow-[var(--shadow-soft)] backdrop-blur-md transition-all duration-500 sm:px-8 ${visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-md"}`}>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
          <Leaf className="h-3 w-3" /> Renter-first energy savings
        </div>
        <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
          Scan your room.
          <br />
          Get your saving plan.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-primary-foreground/90">
          Kenergy Loop starts with a visible room energy score, then turns it into free, practical actions renters can
          actually take. Add your home profile, bills, or meter readings whenever you want more accuracy.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 rounded-md bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
          >
            <Camera className="h-4 w-4" /> Scan a room
          </Link>
          <Link
            to="/survey"
            className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-white/10"
          >
            <Timer className="h-4 w-4" /> Free 60-second survey
          </Link>
        </div>
        <p className="mt-4 text-xs text-primary-foreground/70">
          Your digital energy consultant for scans, profiles, recommendations, reports, and monitoring.
        </p>
      </div>
    </section>
  );
}

function ProcessSection({ visible }: { visible: boolean }) {
  const steps = [
    ["Collect", "Photos, profile answers, bills, readings."],
    ["Analyze", "Loads, building context, confidence."],
    ["Identify", "Waste, risks, opportunities."],
    ["Recommend", "Actions, products, reports, monitoring."],
  ];

  return (
    <section data-autoscene={1} className="relative z-10 grid min-h-[36vh] place-items-center overflow-hidden px-4 py-4">
      <div className={`relative w-full max-w-5xl rounded-[1.75rem] border border-primary/15 bg-card/70 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-all duration-500 md:p-7 ${visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-md"}`}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">How Kenergy Loop fits together</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Kenergy Loop works like a digital energy consultant: it collects the right context, estimates where energy
            is going, identifies realistic opportunities, and turns them into clear next steps.
          </p>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
          {steps.map(([title, body], index) => (
            <div key={title} className="contents">
              <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-background/65 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30">
                <div className="absolute right-3 top-2 text-3xl font-black text-primary/10">0{index + 1}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Kenergy Loop</div>
                <div className="mt-1 text-base font-bold">{title}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
              </div>
              {index < 3 && (
                <div className="hidden place-items-center px-1 text-primary/70 md:grid">
                  <MoveRight className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection({ feature, index, visible }: { feature: Feature; index: number; visible: boolean }) {
  const Icon = feature.icon;

  return (
    <section data-autoscene={index + 2} className="relative z-10 grid min-h-[38vh] place-items-center overflow-hidden px-4 py-4">
      <div className={`relative grid w-full max-w-5xl gap-5 rounded-[1.75rem] border border-primary/15 bg-card/70 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl transition-all duration-500 hover:border-primary/25 md:grid-cols-[0.52fr_0.48fr] md:p-6 ${visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-md"}`}>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary backdrop-blur">
            <Icon className="h-3.5 w-3.5" />
            {feature.eyebrow}
          </span>
          <h3 className="mt-3 max-w-xl text-2xl font-black tracking-tight md:text-4xl">{feature.title}</h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{feature.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {feature.points.map((point) => (
              <span
                key={point}
                className="rounded-full border border-primary/15 bg-background/55 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
        <FeatureVisual icon={Icon} index={index} />
      </div>
    </section>
  );
}

function FeatureVisual({ icon: Icon, index }: { icon: LucideIcon; index: number }) {
  const bars = [44, 72, 58, 86, 64];
  const offset = index % bars.length;

  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[16rem] place-items-center md:max-w-[18rem]">
      <div className="absolute inset-6 rounded-full border border-primary/15 bg-primary/5 blur-sm" />
      <div className="absolute inset-12 rounded-full border border-primary/20 bg-background/40 backdrop-blur-xl" />
      <div className="relative grid h-24 w-24 place-items-center rounded-[1.5rem] border border-primary/20 bg-background/65 text-primary shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <Icon className="h-10 w-10" />
      </div>
      <div className="absolute bottom-7 left-7 right-7 rounded-2xl border border-primary/15 bg-background/55 p-3 backdrop-blur-xl">
        <div className="grid grid-cols-5 items-end gap-2">
          {bars.map((_, i) => (
            <div key={i} className="flex h-14 items-end rounded-full bg-primary/10 p-1">
              <div
                className="w-full rounded-full bg-primary"
                style={{
                  height: `${bars[(i + offset) % bars.length]}%`,
                  transformOrigin: "bottom",
                  animation: `kenergy-eq-breathe ${5 + i * 0.45}s ease-in-out ${i * 0.35}s infinite`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrustSection() {
  return (
    <section className="relative z-10 grid min-h-[22vh] place-items-center px-4 py-6">
      <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-primary/15 bg-card/70 px-5 py-4 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Private by default
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Explainable estimates
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Leaf className="h-3.5 w-3.5 text-primary" /> Built for renters
        </span>
      </div>
    </section>
  );
}

function HomeLegalFooter() {
  const year = new Date().getFullYear();

  return (
    <section className="relative z-10 px-4 pb-10">
      <div className="mx-auto max-w-6xl rounded-3xl border border-primary/15 bg-card/90 p-6 text-foreground shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="text-lg font-bold">Kenergy Loop</div>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Renter-first energy estimates, saving plans, deeper analysis, and monitoring. Built as a hackathon
              prototype; results are estimates, not certified audits.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">Project</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/scan" className="hover:text-primary">Scan a room</Link></li>
              <li><Link to="/survey" className="hover:text-primary">Free survey</Link></li>
              <li><Link to="/monitoring" className="hover:text-primary">Monitoring</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">Legal</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Privacy-first prototype</li>
              <li>Terms: estimates only</li>
              <li>Contact: team@kenergy.demo</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>© {year} Kenergy Loop. Hackathon MVP.</span>
          <span>Photo scans are not meter readings. Professional work should be done by qualified technicians.</span>
        </div>
      </div>
    </section>
  );
}

function FixedGreenBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes kenergy-grid-drift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(32px, -22px, 0) scale(1.04); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes kenergy-eq-breathe {
          0%, 100% { transform: scaleY(0.72); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div className="absolute inset-0 opacity-95" style={{ background: "var(--gradient-hero)" }} />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, white 45%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, white 45%, transparent) 1px, transparent 1px), radial-gradient(circle, color-mix(in oklab, white 48%, transparent) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          animation: "kenergy-grid-drift 16s ease-in-out infinite",
        }}
      />
      <div className="absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
    </div>
  );
}
