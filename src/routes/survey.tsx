import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Sparkles,
  TrendingDown,
  Leaf,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { saveSurveyResponse, loadSurveyResponse } from "@/lib/responses";
import { estimateSurvey, type SurveyEstimate } from "@/lib/survey-estimate.functions";

export const Route = createFileRoute("/survey")({
  head: () => ({
    meta: [
      { title: "60-second Energy Profile — Kenergy" },
      {
        name: "description",
        content:
          "Answer 12 quick questions and unlock a personalized AI Energy Profile plus a smart home kit tailored to your home.",
      },
      { property: "og:title", content: "60-second Energy Profile — Kenergy" },
      {
        property: "og:description",
        content: "12 quick questions, personalized AI action plan, custom smart home kit preview.",
      },
    ],
  }),
  component: SurveyPage,
});

type Answers = Record<string, string>;

type Question =
  | {
      id: string;
      q: string;
      type: "choice";
      options: string[];
      otherTriggers?: string[]; // if selected, show follow-up text field
      otherId?: string;
      otherLabel?: string;
    }
  | {
      id: string;
      q: string;
      type: "text";
      placeholder: string;
    }
  | {
      id: string;
      q: string;
      type: "number";
      placeholder: string;
      unit?: string;
    }
  | {
      id: string;
      q: string;
      type: "dual-number";
      fields: Array<{ id: string; label: string; placeholder?: string }>;
      skippable: true;
    };

const questions: Question[] = [
  {
    id: "city",
    q: "What is your city or postal code?",
    type: "text",
    placeholder: "Berlin, 10115, Munich, Paris…",
  },
  {
    id: "tenure",
    q: "Do you rent or own?",
    type: "choice",
    options: ["Rent", "Own", "Other"],
  },
  {
    id: "place_type",
    q: "What do you want to estimate?",
    type: "choice",
    options: ["Room", "Apartment / Wohnung", "House"],
  },
  {
    id: "size_m2",
    q: "Approximate size?",
    type: "number",
    placeholder: "18 for a room, 65 for an apartment",
    unit: "m²",
  },
  {
    id: "people",
    q: "How many people live there?",
    type: "number",
    placeholder: "1, 2, 3…",
  },
  {
    id: "building_age",
    q: "Building year or age?",
    type: "text",
    placeholder: "1970s, around 2005, old building, I don't know",
  },
  {
    id: "heating",
    q: "Heating type?",
    type: "text",
    placeholder: "gas, district heating, electric, heat pump, radiators but not sure",
  },
  {
    id: "hot_water",
    q: "Hot water type?",
    type: "text",
    placeholder: "central, electric boiler, gas boiler, I don't know",
  },
  {
    id: "issue",
    q: "What is your biggest issue?",
    type: "choice",
    options: [
      "High bill",
      "Cold room",
      "Drafts",
      "Mold / humidity",
      "Too hot in summer",
      "Many devices",
      "Just want to save money",
      "Other",
    ],
    otherTriggers: ["Other"],
    otherId: "issue_other",
    otherLabel: "Describe your issue",
  },
  {
    id: "devices",
    q: "Which devices do you use often?",
    type: "text",
    placeholder: "gaming PC, laptop, monitors, TV, electric heater, AC, dehumidifier, dryer…",
  },
  {
    id: "spend",
    q: "Roughly how much do you pay monthly?",
    type: "dual-number",
    fields: [
      { id: "electricity_eur", label: "Electricity", placeholder: "€ / month" },
      { id: "heating_eur", label: "Heating", placeholder: "€ / month" },
    ],
    skippable: true,
  },
  {
    id: "budget",
    q: "Budget for improvements?",
    type: "choice",
    options: ["€0", "Up to €50", "Up to €250", "More than €250"],
  },
];

function SurveyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    loadSurveyResponse().then((row) => {
      if (row?.answers && typeof row.answers === "object") {
        setAnswers(row.answers as Answers);
      }
    });
  }, [user]);

  const current = questions[step];
  const total = questions.length;
  const done = step >= total;

  function setField(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function advance() {
    if (step < total - 1) setStep(step + 1);
    else setStep(total);
  }

  function isCurrentValid(): boolean {
    if (!current) return false;
    if (current.type === "dual-number") return true; // skippable
    if (current.type === "choice") {
      const v = answers[current.id];
      if (!v) return false;
      if (current.otherTriggers?.includes(v) && current.otherId) {
        return !!answers[current.otherId]?.trim();
      }
      return true;
    }
    const v = answers[current.id];
    return !!v && v.trim().length > 0;
  }

  useEffect(() => {
    if (!done || !user) return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    setSaveState("saving");
    saveSurveyResponse(answers, seconds)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, user]);

  const progress = ((step + (isCurrentValid() ? 1 : 0)) / total) * 100;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        {!done && current && (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>60-second Energy Profile</span>
              <span>
                {Math.min(step + 1, total)} / {total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <section className="mt-10">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{current.q}</h1>

              <div className="mt-6">
                <QuestionField
                  q={current}
                  answers={answers}
                  setField={setField}
                  onPickAdvance={advance}
                />
              </div>

              <div className="mt-8 flex items-center justify-between text-sm">
                <button
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="rounded-md px-3 py-2 text-muted-foreground disabled:opacity-30"
                >
                  ← Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={advance}
                    className="rounded-md px-3 py-2 text-muted-foreground"
                  >
                    Skip →
                  </button>
                  <button
                    onClick={advance}
                    disabled={current.type !== "dual-number" && !isCurrentValid()}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {current.type === "dual-number" ? "Continue" : "Next"}{" "}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {done && (
          <ResultScreen
            answers={answers}
            user={user}
            saveState={saveState}
            onRestart={() => {
              setAnswers({});
              setStep(0);
              startedAt.current = Date.now();
            }}
            onContinue={() => navigate({ to: "/recommendations" })}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function QuestionField({
  q,
  answers,
  setField,
  onPickAdvance,
}: {
  q: Question;
  answers: Answers;
  setField: (id: string, value: string) => void;
  onPickAdvance: () => void;
}) {
  if (q.type === "choice") {
    const selected = answers[q.id];
    const showOther = q.otherTriggers?.includes(selected ?? "") && q.otherId;
    return (
      <div className="grid gap-2.5">
        {q.options.map((opt) => {
          const isSel = selected === opt;
          return (
            <button
              key={opt}
              onClick={() => {
                setField(q.id, opt);
                if (!q.otherTriggers?.includes(opt)) {
                  setTimeout(onPickAdvance, 150);
                }
              }}
              className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 ${
                isSel ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
              }`}
            >
              {opt}
            </button>
          );
        })}
        {showOther && q.otherId && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {q.otherLabel}
            </label>
            <input
              autoFocus
              type="text"
              value={answers[q.otherId] ?? ""}
              onChange={(e) => setField(q.otherId!, e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Tell us a bit more…"
            />
          </div>
        )}
      </div>
    );
  }

  if (q.type === "text") {
    return (
      <input
        autoFocus
        type="text"
        value={answers[q.id] ?? ""}
        onChange={(e) => setField(q.id, e.target.value)}
        placeholder={q.placeholder}
        className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base outline-none focus:border-primary"
      />
    );
  }

  if (q.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={answers[q.id] ?? ""}
          onChange={(e) => setField(q.id, e.target.value)}
          placeholder={q.placeholder}
          className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base outline-none focus:border-primary"
        />
        {q.unit && (
          <span className="shrink-0 text-sm font-medium text-muted-foreground">{q.unit}</span>
        )}
      </div>
    );
  }

  // dual-number
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.fields.map((f) => (
        <div key={f.id}>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {f.label}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={answers[f.id] ?? ""}
            onChange={(e) => setField(f.id, e.target.value)}
            placeholder={f.placeholder}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Both fields are optional — skip if you don't know.
      </p>
    </div>
  );
}

/* ---------- Result screen ---------- */

function ResultScreen({
  answers,
  user,
  saveState,
  onRestart,
  onContinue,
}: {
  answers: Answers;
  user: ReturnType<typeof useAuth>["user"];
  saveState: "idle" | "saving" | "saved" | "error";
  onRestart: () => void;
  onContinue: () => void;
}) {
  const estimate = useServerFn(estimateSurvey);
  const query = useQuery<SurveyEstimate>({
    queryKey: ["survey-estimate", JSON.stringify(answers)],
    queryFn: () => estimate({ data: { answers } }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (query.isPending) {
    return (
      <section className="mt-10 rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          The AI is analyzing your answers…
        </p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="mt-10 rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-2 text-sm text-destructive">
          {(query.error as Error)?.message ?? "Couldn't generate your estimate."}
        </p>
        <button
          onClick={() => query.refetch()}
          className="mt-4 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          Try again
        </button>
      </section>
    );
  }

  const est = query.data!;

  if (!est.can_estimate) {
    return (
      <section className="mt-6 space-y-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Not enough info
          </div>
          <h2 className="mt-3 text-xl font-semibold">I need a bit more to work with</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{est.message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={onRestart}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Answer a few more
            </button>
            <Link
              to="/long-form"
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Try the deeper profile →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Your AI Energy Profile
        </div>
        <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          Potential yearly savings
        </div>
        <div className="mt-1 text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">
          €{Math.round(est.potential_eur_saved_per_year)}
          <span className="ml-1 align-middle text-base font-medium text-muted-foreground">
            / year
          </span>
        </div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          <TrendingDown className="h-3 w-3" /> after your AI action plan
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-background/70 p-3">
            <div className="text-xs text-muted-foreground">Current use (est.)</div>
            <div className="text-lg font-bold text-foreground">
              {Math.round(est.current_kwh_per_year)} kWh
            </div>
            <div className="text-[11px] text-muted-foreground">
              ≈ €{Math.round(est.current_eur_per_year)} / year
            </div>
          </div>
          <div className="rounded-xl bg-background/70 p-3">
            <div className="text-xs text-muted-foreground">Potential kWh saved</div>
            <div className="text-lg font-bold text-foreground">
              {Math.round(est.potential_kwh_saved_per_year)} kWh
            </div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Leaf className="h-3 w-3" /> {Math.round(est.co2_kg_saved_per_year)} kg CO₂
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
          {est.message} · data quality: {est.data_quality}
        </p>

        {user ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {saveState === "saving" && "Saving your answers…"}
            {saveState === "saved" && "✓ Saved to your profile"}
            {saveState === "error" && "Couldn't save — try again later."}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to save this estimate and unlock your full AI action plan.
          </p>
        )}

        <button
          onClick={onContinue}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          See my AI recommendations <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {est.top_recommendations.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top quick wins from your answers
          </h2>
          <ul className="mt-3 space-y-3">
            {est.top_recommendations.map((r, i) => (
              <li key={i} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="shrink-0 text-sm font-semibold text-primary">
                    ~€{Math.round(r.savings_eur_per_year)}/yr
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{r.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Want sharper numbers?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The deeper profile asks about appliances, usage patterns and (optionally) your
              latest bill so the AI can ground its plan in your real consumption.
            </p>
            <Link
              to="/long-form"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Open the deeper analysis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onRestart}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Start the survey over
        </button>
      </div>
    </section>
  );
}
