import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { saveSurveyResponse, loadSurveyResponse } from "@/lib/responses";
import { estimateSurvey } from "@/lib/survey-estimate.functions";

export const Route = createFileRoute("/survey")({
  head: () => ({
    meta: [
      { title: "60-second Energy Profile — Kenergy Loop" },
      {
        name: "description",
        content:
          "Answer 12 quick questions and unlock a personalized Energy Profile plus a smart home kit tailored to your home.",
      },
      { property: "og:title", content: "60-second Energy Profile — Kenergy Loop" },
      {
        property: "og:description",
        content: "12 quick questions, personalized Energy-Saving Plan, custom smart home kit preview.",
      },
    ],
  }),
  component: SurveyPage,
});

type Answers = Record<string, string>;
const SURVEY_DRAFT_KEY = "kenergy.quickSurveyAnswers";

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
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => loadLocalSurveyAnswers());
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    loadSurveyResponse().then((row) => {
      if (row?.answers && typeof row.answers === "object") {
        const saved = row.answers as Answers;
        setAnswers(saved);
        saveLocalSurveyAnswers(saved);
      }
    });
  }, [user]);

  const current = questions[step];
  const total = questions.length;
  const done = step >= total;

  function setField(id: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      saveLocalSurveyAnswers(next);
      return next;
    });
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

  const progress = ((step + (isCurrentValid() ? 1 : 0)) / total) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 sm:py-16">
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
              <p className="mt-2 text-sm text-muted-foreground">
                Answer at least 5 questions to get an instant free estimate. More answers make the plan sharper.
              </p>

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
          <FinalizingSurvey
            answers={answers}
            secondsTaken={Math.round((Date.now() - startedAt.current) / 1000)}
            onRestart={() => {
              saveLocalSurveyAnswers(answers);
              setStep(0);
              startedAt.current = Date.now();
            }}
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

/* ---------- Direct handoff to recommendations ---------- */

function FinalizingSurvey({
  answers,
  secondsTaken,
  onRestart,
}: {
  answers: Answers;
  secondsTaken: number;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const estimate = useServerFn(estimateSurvey);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function finish() {
      try {
        await saveSurveyResponse(answers, secondsTaken);
        const result = await estimate({ data: { answers } });
        if (!result.can_estimate) {
          throw new Error(result.message);
        }
        window.sessionStorage.setItem(
          "kenergy.quickSurveyEstimate",
          JSON.stringify({ answers, estimate: result, generatedAt: new Date().toISOString() }),
        );
        navigate({ to: "/recommendations" });
      } catch (e) {
        started.current = false;
        setError(e instanceof Error ? e.message : "Couldn't generate your recommendations.");
      }
    }
    finish();
  }, [answers, estimate, navigate, secondsTaken]);

  if (error) {
    return (
      <section className="mt-10 rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-2 text-sm text-destructive">{error}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setError(null);
              started.current = false;
            }}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Try again
          </button>
          <button
            onClick={onRestart}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Edit answers
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Building your recommended actions
      </div>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        Kenergy Loop is turning your survey answers into a direct saving plan with yearly saving potential.
      </p>
    </section>
  );
}

function loadLocalSurveyAnswers(): Answers {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SURVEY_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Answers) : {};
  } catch {
    return {};
  }
}

function saveLocalSurveyAnswers(answers: Answers) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(answers));
  } catch {
    // Ignore storage failures; the survey still works without draft persistence.
  }
}
