import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, FileText, History, Image as ImageIcon, Loader2, Lock, MessageSquare, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { loadLongFormResponse, saveLongFormResponse } from "@/lib/responses";
import { deleteLongFormUpload, listLongFormUploads, uploadLongFormFile, type LongFormUpload, type UploadKind } from "@/lib/long-form-uploads";
import { generateDeepDiagnosis, listMyDiagnoses, type DeepDiagnosisRecord } from "@/lib/deep-diagnosis.functions";

export const Route = createFileRoute("/long-form")({
  head: () => ({
    meta: [
      { title: "Deep Analysis workspace — Kenergy" },
      { name: "description", content: "The full Kenergy paid diagnostic workspace: questionnaire, uploads, notes, AI diagnosis, and history." },
    ],
  }),
  component: LongFormPage,
});

type FormState = Record<string, string | string[] | number | boolean>;
type TabId = "form" | "uploads" | "notes" | "diagnosis" | "history";

const sections: Array<{
  id: string;
  title: string;
  description: string;
  fields: Array<
    | { id: string; label: string; type: "text" | "number"; placeholder?: string; unit?: string }
    | { id: string; label: string; type: "select"; options: string[] }
    | { id: string; label: string; type: "multi"; options: string[] }
    | { id: string; label: string; type: "toggle" }
  >;
}> = [
  {
    id: "home",
    title: "Your home",
    description: "Basic facts about the property.",
    fields: [
      { id: "type", label: "Property type", type: "select", options: ["Apartment", "House", "Studio", "Other"] },
      { id: "size", label: "Living area", type: "number", placeholder: "55", unit: "m²" },
      { id: "rooms", label: "Number of rooms", type: "number", placeholder: "3" },
      { id: "age", label: "Building age", type: "select", options: ["Before 1970", "1970–2000", "2000–2015", "After 2015"] },
      { id: "insulation", label: "Insulation quality", type: "select", options: ["Poor", "Average", "Good", "Excellent", "Not sure"] },
      { id: "people", label: "People in household", type: "number", placeholder: "2" },
      { id: "ownership", label: "Rent or own?", type: "select", options: ["Rent", "Own", "Live with family"] },
    ],
  },
  {
    id: "heating",
    title: "Heating & hot water",
    description: "Heating usually drives 50–70% of a home's energy use.",
    fields: [
      { id: "heatType", label: "Heating system", type: "select", options: ["Central gas", "District heating", "Electric", "Heat pump", "Wood / pellet", "Oil", "Not sure"] },
      { id: "heatAge", label: "Heating system age (years)", type: "number", placeholder: "8" },
      { id: "fuelCostMonthly", label: "Monthly heating cost", type: "number", placeholder: "120", unit: "€" },
      { id: "thermostat", label: "Smart thermostat?", type: "toggle" },
      { id: "winterTemp", label: "Average winter indoor temperature", type: "number", placeholder: "21", unit: "°C" },
      { id: "nightSetback", label: "Lower temperature at night?", type: "toggle" },
      { id: "hotWater", label: "Hot water source", type: "select", options: ["Shared boiler", "Electric in-unit", "Gas in-unit", "Heat pump"] },
    ],
  },
  {
    id: "energy",
    title: "Electricity, PV & EV",
    description: "Generation, storage and mobility.",
    fields: [
      { id: "monthlyBill", label: "Average monthly electricity bill", type: "number", placeholder: "140", unit: "€" },
      { id: "tariff", label: "Electricity tariff", type: "select", options: ["Flat", "Day / night", "Hourly (dynamic)", "Not sure"] },
      { id: "tariffProvider", label: "Provider (optional)", type: "text", placeholder: "e.g. Tibber, Octopus, Vattenfall" },
      { id: "pv", label: "Rooftop solar (PV)?", type: "toggle" },
      { id: "pvKwp", label: "PV size", type: "number", placeholder: "8", unit: "kWp" },
      { id: "battery", label: "Home battery?", type: "toggle" },
      { id: "batteryKwh", label: "Battery size", type: "number", placeholder: "10", unit: "kWh" },
      { id: "ev", label: "Electric vehicle?", type: "toggle" },
      { id: "evChargeWindow", label: "Typical EV charge window", type: "select", options: ["Anytime", "Overnight", "When PV produces", "Smart-scheduled"] },
    ],
  },
  {
    id: "appliances",
    title: "Smart appliances",
    description: "Tick every smart / connected appliance you own.",
    fields: [
      {
        id: "smartList",
        label: "Connected appliances",
        type: "multi",
        options: ["Smart thermostat", "Smart plugs", "Smart lighting", "Connected washer", "Connected dryer", "Connected dishwasher", "Smart fridge", "Smart AC / heat pump", "EV charger", "Solar inverter", "Home battery", "Home Assistant / openHAB"],
      },
      { id: "standby", label: "Devices left on standby", type: "select", options: ["None", "A few", "Many"] },
      { id: "majorApplianceAge", label: "Average major-appliance age (years)", type: "number", placeholder: "8" },
    ],
  },
  {
    id: "habits",
    title: "Habits & goal",
    description: "How you live shapes the action plan as much as what you own.",
    fields: [
      { id: "hoursHome", label: "Hours at home per weekday", type: "number", placeholder: "10" },
      { id: "wfh", label: "Days/week working from home", type: "number", placeholder: "3" },
      { id: "laundry", label: "Laundry loads per week", type: "number", placeholder: "4" },
      { id: "goal", label: "What matters most to you?", type: "select", options: ["Lower my bill", "Lower my CO₂", "Comfort & automation", "All equally"] },
      { id: "targetReduction", label: "Target reduction (%)", type: "number", placeholder: "20", unit: "%" },
      { id: "ecosystem", label: "Preferred ecosystem", type: "select", options: ["No preference", "Matter / Apple Home", "Google / Nest", "Amazon Alexa", "Home Assistant", "AVM FRITZ!", "Hue / Philips"] },
    ],
  },
];

function LongFormPage() {
  const { user, loading: authLoading } = useAuth();
  const { access, loading: accessLoading } = useAccess();

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-muted-foreground">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <PaywallShell
        title="Sign in to unlock Deep Analysis"
        cta={<Link to="/login" className="inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Sign in</Link>}
      />
    );
  }

  if (!access.hasDeepAnalysis) {
    return (
      <PaywallShell
        title="Unlock the Deep Analysis workspace"
        cta={
          <Link to="/checkout/deep-analysis" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <Sparkles className="h-4 w-4" /> Unlock for €19
          </Link>
        }
      />
    );
  }

  return <Workspace />;
}

function PaywallShell({ title, cta }: { title: string; cta: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="mb-2 text-xs uppercase tracking-wide text-primary">Deep Analysis · one-time €19</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            One purchase, one in-depth AI diagnosis tailored to your home — bills, photos, free-text
            notes, an A–G energy grade, three product tiers (budget · balanced · integrated) and a
            compatible smart-home ecosystem kit. Saved forever, viewable anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {cta}
            <Link to="/survey" className="rounded-md border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">
              Use the free 60s survey instead
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <FileText className="h-4 w-4" />, t: "Detailed questionnaire", d: "Heating, PV, EV, schedules, ages, target reduction + custom notes per section." },
            { icon: <ImageIcon className="h-4 w-4" />, t: "Bills & appliance photos", d: "Drop your electricity bill and nameplate photos — the AI cross-references them." },
            { icon: <MessageSquare className="h-4 w-4" />, t: "Free-text notes", d: "Tell the AI about budget, landlord constraints, brands you prefer." },
            { icon: <Wand2 className="h-4 w-4" />, t: "Concrete product picks", d: "Budget · balanced · integrated tiers — real models, real prices." },
            { icon: <Sparkles className="h-4 w-4" />, t: "Ecosystem kit", d: "Matter / Zigbee / Home-Assistant compatible bundle, ready for the dashboard." },
            { icon: <History className="h-4 w-4" />, t: "Forever history", d: "Re-open old diagnoses any time. New runs cost a new credit." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-primary">{f.icon}<span className="text-sm font-semibold">{f.t}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Sample diagnosis preview</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Example</span>
          </div>
          <div className="relative">
            <div className="pointer-events-none select-none blur-[1.5px]">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">Switch heating schedule + retire the 2014 fridge — saves ~€340/yr</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Goal alignment: lower bill, comfort preserved. 22% reduction reachable in 90 days.</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">C</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Energy score 58</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-muted p-2"><div className="font-semibold">€340</div><div className="text-muted-foreground">Saved/yr</div></div>
                <div className="rounded-md bg-muted p-2"><div className="font-semibold">1,130</div><div className="text-muted-foreground">kWh/yr</div></div>
                <div className="rounded-md bg-muted p-2"><div className="font-semibold">medium</div><div className="text-muted-foreground">Data</div></div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { tier: "budget", name: "Shelly Plus Plug S", brand: "Shelly", price: 18 },
                  { tier: "balanced", name: "Liebherr CNd 5253 fridge", brand: "Liebherr", price: 749 },
                  { tier: "integrated", name: "Home Assistant Green hub", brand: "Nabu Casa", price: 99 },
                ].map((x) => (
                  <div key={x.name} className="rounded-md border border-border/60 p-3 text-left">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.tier}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{x.name}</span>
                      <span className="text-xs">€{x.price}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{x.brand}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <div className="rounded-full border border-border bg-background/90 px-4 py-2 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)]">
                <Lock className="mr-1.5 inline h-3 w-3" /> Unlock to see your real diagnosis
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Workspace() {
  const [tab, setTab] = useState<TabId>("form");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "form", label: "Questionnaire", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "uploads", label: "Bills & photos", icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: "notes", label: "Notes to AI", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: "diagnosis", label: "AI diagnosis", icon: <Wand2 className="h-3.5 w-3.5" /> },
    { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-primary">Deep Analysis workspace</div>
        <h1 className="text-3xl font-bold tracking-tight">Your in-depth energy profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in what you can, drop in bills or appliance photos, add any extra context, then let the AI write a tailored plan with concrete product picks.
        </p>

        <div className="mt-6 flex flex-wrap gap-1 rounded-lg border border-border bg-muted/50 p-1 text-xs">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                tab === t.id ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "form" && <Questionnaire />}
          {tab === "uploads" && <UploadsTab />}
          {tab === "notes" && <NotesTab />}
          {tab === "diagnosis" && <DiagnosisTab />}
          {tab === "history" && <HistoryTab />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Questionnaire ───────────────────────────────────────────────────────────

function Questionnaire() {
  const { user } = useAuth();
  const [state, setState] = useState<FormState>({});
  const [openId, setOpenId] = useState<string>(sections[0].id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hydrated, setHydrated] = useState(false);

  const totalFields = useMemo(() => sections.reduce((n, s) => n + s.fields.length, 0), []);
  const filled = useMemo(
    () =>
      Object.entries(state).filter(([k, v]) => {
        if (k === "notes") return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "number") return !Number.isNaN(v);
        return v !== undefined && v !== null;
      }).length,
    [state],
  );
  const progress = Math.round((filled / totalFields) * 100);

  useEffect(() => {
    if (!user) return;
    loadLongFormResponse().then((row) => {
      if (row?.answers && typeof row.answers === "object") setState(row.answers as FormState);
      setHydrated(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !hydrated) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      saveLongFormResponse(state as Record<string, unknown>, progress)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(t);
  }, [state, progress, user, hydrated]);

  function update(id: string, value: FormState[string]) {
    setState((s) => ({ ...s, [id]: value }));
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filled} / {totalFields} fields</span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wide">
            {saveState === "saving" && "saving…"}
            {saveState === "saved" && "✓ saved"}
            {saveState === "error" && "save error"}
          </span>
          <span>{progress}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-6 space-y-3">
        {sections.map((section) => {
          const open = openId === section.id;
          return (
            <div key={section.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
              <button onClick={() => setOpenId(open ? "" : section.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={open}>
                <div>
                  <div className="text-base font-semibold">{section.title}</div>
                  <div className="text-xs text-muted-foreground">{section.description}</div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="space-y-4 border-t border-border/60 px-5 py-5">
                  {section.fields.map((f) => (
                    <FieldRenderer key={f.id} field={f} value={state[f.id]} onChange={(v) => update(f.id, v)} />
                  ))}
                  <label className="block">
                    <span className="mb-1 flex items-center justify-between text-sm font-medium">
                      Custom note for this section
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">optional · free text</span>
                    </span>
                    <textarea
                      rows={2}
                      maxLength={600}
                      placeholder="Anything that doesn't fit the fields above — the AI reads this verbatim."
                      value={(state[`${section.id}_custom`] as string) ?? ""}
                      onChange={(e) => update(`${section.id}_custom`, e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: (typeof sections)[number]["fields"][number];
  value: FormState[string] | undefined;
  onChange: (v: FormState[string]) => void;
}) {
  const baseInput = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  if (field.type === "text" || field.type === "number") {
    return (
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-sm font-medium">
          {field.label}
          {"unit" in field && field.unit && <span className="text-xs text-muted-foreground">{field.unit}</span>}
        </span>
        <input
          type={field.type}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          value={(value as string | number | undefined) ?? ""}
          onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
          className={baseInput}
        />
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{field.label}</span>
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={baseInput}>
          <option value="">Choose…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "multi") {
    const arr = (value as string[]) ?? [];
    return (
      <div>
        <span className="mb-2 block text-sm font-medium">{field.label}</span>
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = arr.includes(o);
            return (
              <button key={o} type="button" onClick={() => onChange(active ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const on = Boolean(value);
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{field.label}</span>
      <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

function UploadsTab() {
  const [items, setItems] = useState<LongFormUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listLongFormUploads());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleFile(kind: UploadKind, file: File) {
    setBusy(true);
    setError(null);
    try {
      await uploadLongFormFile(file, kind);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Drop a recent electricity bill (PDF or photo) and snap any appliance nameplate you'd like the AI to consider. Files are private to your account.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <UploadDrop kind="bill" label="Upload electricity bill" hint="PDF or JPG. Yearly bill is most useful." accept=".pdf,image/*" onFile={(f) => handleFile("bill", f)} busy={busy} />
        <UploadDrop kind="appliance" label="Appliance photo" hint="Nameplate / energy label / model number." accept="image/*" onFile={(f) => handleFile("appliance", f)} busy={busy} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div>
        <h3 className="text-sm font-semibold">Your uploads</h3>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No uploads yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                {u.signedUrl ? (
                  <a href={u.signedUrl} target="_blank" rel="noreferrer" className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {u.storage_path.match(/\.(png|jpe?g|webp|gif)$/i) ? (
                      <img src={u.signedUrl} alt={u.label ?? ""} className="h-full w-full object-cover" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                  </a>
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{u.label || u.kind}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{u.kind} · {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <button onClick={() => deleteLongFormUpload(u.id, u.storage_path).then(refresh)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UploadDrop({ label, hint, accept, onFile, busy }: { kind: UploadKind; label: string; hint: string; accept: string; onFile: (f: File) => void; busy: boolean }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center hover:border-primary/50 hover:bg-primary/5">
      <Upload className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────

function NotesTab() {
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    loadLongFormResponse().then((row) => {
      const a = (row?.answers ?? {}) as Record<string, unknown>;
      setNotes(typeof a.notes === "string" ? a.notes : "");
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const row = await loadLongFormResponse();
        const answers = ((row?.answers ?? {}) as Record<string, unknown>);
        answers.notes = notes;
        await saveLongFormResponse(answers, row?.progress ?? 0);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [notes, hydrated]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Anything that doesn't fit a form field — preferred brands, constraints, what you've already tried, budget, landlord situation, etc. The AI reads this verbatim.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={10}
        maxLength={2000}
        placeholder="e.g. I rent, can't change the heating system. Budget under €500. I like Apple Home / Matter and want everything on one dashboard. The old fridge sounds loud at night."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{notes.length} / 2000</span>
        <span>
          {saveState === "saving" && "saving…"}
          {saveState === "saved" && "✓ saved"}
          {saveState === "error" && "save error"}
        </span>
      </div>
    </div>
  );
}

// ─── Diagnosis ───────────────────────────────────────────────────────────────

function DiagnosisTab() {
  const { access, refetch } = useAccess();
  const gen = useServerFn(generateDeepDiagnosis);
  const list = useServerFn(listMyDiagnoses);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<DeepDiagnosisRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    list().then((rows) => {
      setLatest(rows[0] ?? null);
      setLoaded(true);
    });
  }, [list]);

  async function run() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const row = await loadLongFormResponse();
      const notes = (row?.answers as { notes?: string })?.notes ?? "";
      const res = await gen({ data: { notes } });
      setLatest(res);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleGenerateClick() {
    // Admin gets unlimited & no confirmation; everyone else must confirm.
    if (access.isAdmin) {
      run();
    } else {
      setConfirmOpen(true);
    }
  }

  const outOfCredits = access.diagnosisCredits <= 0 && access.diagnosisCredits < 999;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Run a new diagnosis</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Costs 1 credit. Uses every field, upload and note you've entered. Results are saved forever — old ones don't re-spend credits to view.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            {access.diagnosisCredits >= 999 ? "Unlimited (admin)" : `${access.diagnosisCredits} credit${access.diagnosisCredits === 1 ? "" : "s"} left`}
          </span>
        </div>
        <button
          onClick={handleGenerateClick}
          disabled={busy || outOfCredits}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? "Generating…" : "Generate diagnosis"}
        </button>
        {outOfCredits && (
          <p className="mt-2 text-xs text-muted-foreground">
            Out of credits.{" "}
            <Link to="/checkout/deep-analysis" className="font-semibold text-primary hover:underline">
              Top up
            </Link>{" "}
            to run another diagnosis.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Use one Deep Analysis credit?</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generating a new diagnosis will spend <strong>1 of your purchased analyses</strong> and cannot be undone.
                  Your existing diagnosis stays in <em>History</em> either way.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  You have <strong>{access.diagnosisCredits}</strong> credit{access.diagnosisCredits === 1 ? "" : "s"} left after this run: <strong>{Math.max(0, access.diagnosisCredits - 1)}</strong>.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={run}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" /> Yes, generate now
              </button>
            </div>
          </div>
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : latest ? (
        <DiagnosisView record={latest} />
      ) : (
        <p className="text-sm text-muted-foreground">No diagnosis yet — fill the form, then click generate.</p>
      )}
    </div>
  );
}

function DiagnosisView({ record }: { record: DeepDiagnosisRecord }) {
  const p = record.plan;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Diagnosis · {new Date(record.created_at).toLocaleDateString()}</div>
            <h3 className="mt-1 text-xl font-bold">{p.summary}</h3>
            <p className="mt-2 text-xs text-muted-foreground">{p.goal_alignment}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{p.grade}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Energy score {p.energy_score}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Mini label="Saved/yr" value={`€${Math.round(p.yearly_savings_eur)}`} />
          <Mini label="kWh/yr" value={`${Math.round(p.yearly_kwh)}`} />
          <Mini label="Data" value={p.data_quality} />
        </div>
      </div>

      <Section title="Concrete product picks">
        {p.product_picks?.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {(["budget", "balanced", "integrated"] as const).map((tier) => {
              const list = p.product_picks.filter((x) => x.tier === tier);
              if (!list.length) return null;
              return (
                <div key={tier} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{tier}</div>
                  <ul className="mt-2 space-y-3">
                    {list.map((x) => (
                      <li key={x.id} className="rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{x.name}</span>
                          <span className="text-xs">€{x.price_eur}</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{x.category} · {x.brand_examples}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{x.why}</p>
                        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                          <span className="rounded-full bg-muted px-2 py-0.5">{x.api_capability}</span>
                          {x.dashboard_ready && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Dashboard-ready</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No product picks for this profile.</p>
        )}
      </Section>

      {p.ecosystem_kit && (
        <Section title="Compatible ecosystem kit">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-semibold">{p.ecosystem_kit.name}</h4>
              <span className="text-sm">€{p.ecosystem_kit.total_eur}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.ecosystem_kit.description}</p>
            <p className="mt-1 text-[11px] text-muted-foreground"><strong>Hub:</strong> {p.ecosystem_kit.hub} · {p.ecosystem_kit.interoperability}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {p.ecosystem_kit.items.map((x) => (
                <li key={x.id} className="rounded-md bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{x.name}</span>
                    <span className="text-xs">€{x.price_eur}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{x.brand_examples}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{x.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {p.next_steps?.length > 0 && (
        <Section title="Next steps">
          <ol className="space-y-2">
            {p.next_steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-md border border-border p-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

function HistoryTab() {
  const list = useServerFn(listMyDiagnoses);
  const [rows, setRows] = useState<DeepDiagnosisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    list().then((r) => {
      setRows(r);
      setOpenId(r[0]?.id ?? null);
      setLoading(false);
    });
  }, [list]);

  const open = rows.find((r) => r.id === openId);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Every diagnosis you've generated is saved. Open one to view it again — no credit is spent for re-reading old results.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No diagnoses yet.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setOpenId(r.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    openId === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <div>
                    <div className="font-medium">{new Date(r.created_at).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      Grade {r.plan.grade} · ~€{Math.round(r.plan.yearly_savings_eur)}/yr potential
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {open && <DiagnosisView record={open} />}
        </>
      )}
    </div>
  );
}
