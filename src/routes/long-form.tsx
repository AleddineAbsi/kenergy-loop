import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ExternalLink, FileText, Headphones, HelpCircle, History, Image as ImageIcon, Info, Lightbulb, Loader2, Lock, Mail, MessageSquare, Sparkles, Trash2, Upload, Wand2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { loadLongFormResponse, saveLongFormResponse } from "@/lib/responses";
import { deleteLongFormUpload, listLongFormUploads, uploadLongFormFile, type LongFormUpload, type UploadKind } from "@/lib/long-form-uploads";
import {
  generateDeepDiagnosis,
  listMyDiagnoses,
  type DeepDiagnosisRecord,
  type DeepRecommendedAction,
  type EcosystemPack,
  type ProductPick,
} from "@/lib/deep-diagnosis.functions";

export const Route = createFileRoute("/long-form")({
  head: () => ({
    meta: [
      { title: "Deep Analysis workspace — Kenergy Loop" },
      { name: "description", content: "The full Kenergy Loop paid diagnostic workspace: questionnaire, uploads, notes, Energy Check, and history." },
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
    description: "How you live shapes the saving plan as much as what you own.",
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
      <div className="flex min-h-screen flex-col">
        <SiteNav />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-sm text-muted-foreground">Loading…</main>
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
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="mb-2 text-xs uppercase tracking-wide text-primary">Deep Analysis · one-time €19</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            One purchase, one in-depth Energy Check tailored to your home — bills, photos, free-text
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
            { icon: <ImageIcon className="h-4 w-4" />, t: "Bills & appliance photos", d: "Drop your electricity bill and nameplate photos — Kenergy Loop cross-references them." },
            { icon: <MessageSquare className="h-4 w-4" />, t: "Additional details", d: "Add budget, landlord constraints, preferred brands, or anything else we should know." },
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
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Sample Energy Report preview</span>
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
                <Lock className="mr-1.5 inline h-3 w-3" /> Unlock to see your real Energy Report
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

  const tabs: { id: TabId; label: string; description: string; icon: React.ReactNode }[] = [
    { id: "form", label: "Questionnaire", description: "Home, heating, habits", icon: <FileText className="h-4 w-4" /> },
    { id: "uploads", label: "Bills & photos", description: "Proof for sharper numbers", icon: <ImageIcon className="h-4 w-4" /> },
    { id: "notes", label: "additional details", description: "Budget, constraints, goals", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "diagnosis", label: "Energy Check", description: "Ranked paid saving plan", icon: <Wand2 className="h-4 w-4" /> },
    { id: "history", label: "History", description: "Saved previous runs", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-primary">Deep Analysis workspace</div>
        <h1 className="text-3xl font-bold tracking-tight">Your in-depth energy profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in what you can, drop in bills or appliance photos, add any extra context, then let Kenergy Loop build a tailored plan with concrete product picks.
        </p>

        <div className="mt-6 grid gap-2 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-2 shadow-[var(--shadow-soft)] sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                tab === t.id
                  ? "border-primary/40 bg-background text-foreground shadow-[var(--shadow-glow)]"
                  : "border-border/70 bg-background/55 text-muted-foreground hover:border-primary/25 hover:bg-background/85 hover:text-foreground"
              }`}
            >
              <span className="absolute inset-x-3 top-0 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-x-100" />
              <span className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              }`}>
                {t.icon}
              </span>
              <span className="mt-3 block text-sm font-bold">{t.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{t.description}</span>
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
                      placeholder="Anything that doesn't fit the fields above — Kenergy Loop uses this as extra context."
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
        Drop a recent electricity bill (PDF or photo) and snap any appliance nameplate you'd like Kenergy Loop to consider. Files are private to your account.
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
        Anything that doesn't fit a form field — preferred brands, constraints, what you've already tried, budget, landlord situation, etc. Kenergy Loop uses this as extra context.
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
            <h3 className="text-base font-semibold">Run a new Energy Check</h3>
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
          {busy ? "Generating…" : "Generate Energy Check"}
        </button>
        {outOfCredits && (
          <p className="mt-2 text-xs text-muted-foreground">
            Out of credits.{" "}
            <Link to="/checkout/deep-analysis" className="font-semibold text-primary hover:underline">
              Top up
            </Link>{" "}
            to run another Energy Check.
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
                  Generating a new Energy Check will spend <strong>1 of your purchased analyses</strong> and cannot be undone.
                  Your existing Energy Check stays in <em>History</em> either way.
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
        <p className="text-sm text-muted-foreground">No Energy Check yet — fill the form, then click generate.</p>
      )}
    </div>
  );
}

function DiagnosisView({ record }: { record: DeepDiagnosisRecord }) {
  const p = record.plan;
  const [technicianOpen, setTechnicianOpen] = useState(false);
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [landlordEmail, setLandlordEmail] = useState("");
  const [supportTarget, setSupportTarget] = useState<string | null>(null);
  const [docsTarget, setDocsTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | DeepActionFilter>("all");
  const actionPlanCards = buildDeepRecommendedActions(p);
  const visibleActionCards = actionPlanCards.filter((action) => filter === "all" || deepFilterFor(action) === filter);
  const ecosystemPacks = buildEcosystemPacks(p, actionPlanCards);
  const mainIntervention =
    actionPlanCards.find((x) => x.requires_technician || x.requires_landlord)?.title ??
    actionPlanCards.find((x) => x.product)?.product?.name ??
    "radiator controls and heating schedule optimization";
  const landlordPreview = `Subject: Request to approve a small energy-saving improvement

Hello,

I used Kenergy Loop to review my home energy profile and it identified a practical intervention that could reduce consumption without changing the building structure.

Technical summary:
- Recommended intervention: ${mainIntervention}
- Estimated annual saving potential: about €${Math.round(p.yearly_savings_eur)} and ${Math.round(p.yearly_kwh)} kWh
- Current Energy Check grade: ${p.grade} (score ${p.energy_score})
- Data quality: ${p.data_quality}
- Work requested: permission for a technician to inspect compatibility and, if suitable, install or adjust the relevant control hardware.

This should be treated as a low-impact efficiency measure. No structural work is requested at this stage. I can share the full Kenergy Loop report and any documents needed before booking a technician.

Could you confirm whether this is allowed and whether you have a preferred technician or process?

Best regards,`;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Energy Check · {new Date(record.created_at).toLocaleDateString()}
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight">{p.summary}</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{p.goal_alignment}</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Potential yearly saving"
            value={`€${Math.round(p.yearly_savings_eur)}`}
            help="Estimated yearly euro upside from the full ranked plan. It is a planning estimate, not a guaranteed bill reduction."
            tone="money"
          />
          <MetricCard
            label="Energy cut"
            value={`${Math.round(p.yearly_kwh)} kWh`}
            help="Estimated yearly energy reduction if the ranked actions are followed. It is not a meter reading; bills and readings improve it."
            tone="energy"
          />
          <MetricCard
            label="Grade"
            value={p.grade}
            help="A quick A-G summary of how efficient the current profile appears. A is best, G is worst, and it is based on the available profile data."
            tone="grade"
          />
          <MetricCard
            label="Data quality"
            value={p.data_quality}
            help="How much evidence Kenergy Loop had. Low/medium means some assumptions remain; bills, meter readings, appliance labels, and photos improve confidence."
            tone="quality"
          />
        </div>
      </div>

      <Section title="Recommended Energy-Saving Plan">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm transition-all duration-300 hover:border-primary/35 hover:shadow-md">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h4 className="font-semibold">Sorted from easiest money to deeper interventions</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Same structure as the quick survey, but with more actions, product picks, approval steps, technician steps, and confidence notes.
              </p>
            </div>
            <span className="rounded-full bg-background px-4 py-2 text-sm font-bold text-primary shadow-sm">
              up to €{Math.round(p.yearly_savings_eur)}/year
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {deepFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 ${
                  filter === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sorted from easiest to most involved. Confidence reflects how well your survey, uploads, notes, and deep profile support the suggestion.
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {visibleActionCards.map((action, i) => (
              <li key={action.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {categoryLabel(action.category)}
                      </span>
                    </div>
                    <h5 className="mt-3 text-lg font-semibold">{action.title}</h5>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {action.effort}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{action.why}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  {action.requires_landlord && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700">Landlord approval</span>}
                  {action.requires_technician && <span className="rounded-full bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-700">Technician</span>}
                  {action.product?.sponsored && <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">Sponsored product suggestion</span>}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-base font-extrabold text-primary">
                    {action.savings_eur_per_year > 0
                      ? `~€${Math.round(action.savings_eur_per_year)}/yr`
                      : "Savings need better data"}
                  </span>
                  <span className="relative flex items-center gap-1 text-xs text-muted-foreground">
                    <HelpCircle tabIndex={0} className="peer h-3 w-3 cursor-help outline-none" />
                    Confidence {Math.round(action.confidence)}%
                    <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-64 rounded-xl border border-border bg-popover p-3 text-left text-[11px] leading-relaxed text-popover-foreground opacity-0 shadow-[var(--shadow-soft)] transition-opacity peer-hover:opacity-100 peer-focus:opacity-100">
                      Confidence means how strongly this recommendation is supported by your current answers. Lower confidence usually means Kenergy Loop had to assume missing information; bills, meter readings, or photos make it sharper.
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, action.confidence))}%` }} />
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <details className="group rounded-lg border border-border bg-background/40 p-3">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                      <Lightbulb className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">How it saves energy</span>
                    </summary>
                    <p className="mt-2 text-muted-foreground">{action.how_it_works}</p>
                  </details>

                  <details className="group rounded-lg border border-border bg-background/40 p-3">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                      <Wrench className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">How to proceed</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-muted-foreground">{action.how_to_proceed}</p>
                  </details>

                  <details className="group rounded-lg border border-border bg-background/40 p-3">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-foreground">
                      <Info className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">Why this applies to you</span>
                    </summary>
                    <p className="mt-2 text-muted-foreground">{action.why}</p>
                  </details>

                  {action.sources && action.sources.length > 0 && (
                    <div className="rounded-lg border border-dashed border-border bg-background/30 p-3">
                      <div className="text-[11px] font-medium text-foreground">Sources</div>
                      <ul className="mt-1 space-y-0.5">
                        {action.sources.map((source, sourceIndex) => (
                          <li key={`${action.id}-source-${sourceIndex}`}>
                            {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                              >
                                {source.label} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{source.label}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {action.product && (
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">Product recommendation</div>
                        <div className="font-semibold">{action.product.name}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{action.product.why}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-full bg-background px-2 py-0.5">{action.product.brand_examples}</span>
                          <span className="rounded-full bg-background px-2 py-0.5">{action.product.api_capability}</span>
                          {action.product.dashboard_ready && <span className="rounded-full bg-background px-2 py-0.5 text-primary">Dashboard-ready</span>}
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <div className="rounded-xl bg-background px-3 py-2 text-center shadow-sm">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Price</div>
                          <div className="text-lg font-black text-primary">€{Math.round(action.product.price_eur)}</div>
                        </div>
                        <a href={productUrl(action.product)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-background px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/10">
                          Open product <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSupportTarget(action.product?.name ?? action.title)} className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10">
                        <Headphones className="h-3 w-3" />
                        Technical team
                      </button>
                      <button type="button" onClick={() => setDocsTarget(action.product?.name ?? action.title)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:border-primary/30 hover:bg-primary/5">
                        <BookOpen className="h-3 w-3" />
                        Product docs
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {action.requires_landlord && (
                    <button type="button" onClick={() => setLandlordOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15">
                      <Mail className="h-3.5 w-3.5" />
                      Preview approval email
                    </button>
                  )}
                  {action.requires_technician && (
                    <button type="button" onClick={() => setTechnicianOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-500/15">
                      <Wrench className="h-3.5 w-3.5" />
                      Choose technician
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {ecosystemPacks.length > 0 && (
        <Section title="Sponsored product packs">
          <div className="grid gap-3 lg:grid-cols-2">
            {ecosystemPacks.map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-primary">Pack solves actions {pack.solves_action_ids.join(", ")}</div>
                    <h4 className="mt-1 font-bold">{pack.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">{pack.description}</p>
                  </div>
                  <div className="rounded-xl bg-primary/10 px-4 py-3 text-right">
                    <div className="text-2xl font-black text-primary">€{Math.round(pack.yearly_savings_eur)}</div>
                    <div className="text-[11px] text-muted-foreground">up to / year</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">Bundle price ~€{Math.round(pack.total_eur)}</span>
                  {pack.vendor_url && (
                    <a href={pack.vendor_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold text-primary hover:bg-primary/5">
                      Open vendor search <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {pack.items.map((item) => (
                    <li key={`${pack.id}-${item.id}`} className="rounded-xl border border-border/70 bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">{item.brand_examples}</div>
                        </div>
                        <span className="text-xs font-bold text-primary">€{Math.round(item.price_eur)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={productUrl(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15">
                          Product link <ExternalLink className="h-3 w-3" />
                        </a>
                        <button type="button" onClick={() => setSupportTarget(item.name)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-primary/30 hover:bg-primary/5">
                          <Headphones className="h-3 w-3" />
                          Tech team
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {technicianOpen && (
        <Modal title="Choose technicians" onClose={() => setTechnicianOpen(false)}>
          <p className="text-sm text-muted-foreground">
            Demo preview: Kenergy Loop would match the saving plan with local technicians who can inspect compatibility and complete the installation.
          </p>
          <div className="mt-4 space-y-3">
            {[
              ["ThermoCheck Berlin", "Radiator valve inspection + smart thermostat fitting", "€89 inspection", "4.8"],
              ["EcoHaus Service", "Heating balancing and control optimization", "€129 visit", "4.6"],
              ["SmartHeat Partner", "Matter-ready thermostat and sensor setup", "€149 setup", "4.7"],
            ].map(([name, scope, price, rating]) => (
              <button
                key={name}
                type="button"
                onClick={() => setTechnicianOpen(false)}
                className="w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{name}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">★ {rating}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{scope}</p>
                <p className="mt-2 text-xs font-medium">{price} · demo selection</p>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {landlordOpen && (
        <Modal title="Landlord email preview" onClose={() => setLandlordOpen(false)}>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="landlord-email">
            Landlord email
          </label>
          <input
            id="landlord-email"
            value={landlordEmail}
            onChange={(e) => setLandlordEmail(e.target.value)}
            placeholder="landlord@example.com"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{landlordPreview}</pre>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Demo only: this preview shows how Kenergy Loop would prepare the message. No email is sent from this page.
          </p>
        </Modal>
      )}

      {supportTarget && (
        <Modal title="Technical team contact" onClose={() => setSupportTarget(null)}>
          <p className="text-sm text-muted-foreground">
            Demo preview: Kenergy Loop would route this request to the product or kit technical team with your Energy Report attached.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected item</div>
            <div className="mt-1 font-semibold">{supportTarget}</div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-background p-3">
                <div className="font-medium">Support request</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compatibility check, installation requirements, wiring constraints, and hub setup questions.
                </p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <div className="font-medium">Attached context</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Home type, heating system, Energy Check grade, estimated savings, and selected kit components.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              onClick={() => setSupportTarget(null)}
            >
              Request callback demo
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold"
              onClick={() => setSupportTarget(null)}
            >
              Start support chat demo
            </button>
          </div>
        </Modal>
      )}

      {docsTarget && (
        <Modal title="Technical documentation" onClose={() => setDocsTarget(null)}>
          <p className="text-sm text-muted-foreground">
            Demo preview: Kenergy Loop would collect the official setup guide, compatibility notes, API capability, and maintenance documents for this product.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Documentation bundle</div>
            <div className="mt-1 font-semibold">{docsTarget}</div>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Installation checklist and required tools",
                "Compatibility notes for heating valves, hubs, Wi-Fi, Matter, or Zigbee",
                "Manufacturer setup guide and troubleshooting steps",
                "Data/API capabilities for monitoring dashboards",
                "Warranty, maintenance, and safety documentation",
              ].map((item) => (
                <li key={item} className="flex gap-2 rounded-md bg-background p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Demo only: these buttons show the product direction. Real manufacturer links can be connected later.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ActionStepCard({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
      {action && (
        <button
          type="button"
          onClick={onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {action}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function buildDeepRecommendedActions(plan: DeepDiagnosisRecord["plan"]): DeepRecommendedAction[] {
  const total = Math.max(120, Math.round(plan.yearly_savings_eur || 0));
  const provided = (plan.recommended_actions ?? []).map((action, index) => ({
    ...action,
    id: action.id || `ai-${index + 1}`,
    confidence: Math.max(0, Math.min(100, Number(action.confidence ?? 55))),
    savings_eur_per_year: Math.max(8, Number(action.savings_eur_per_year ?? Math.round(total / 8))),
    sources: externalSources(action.sources),
  }));

  const fallbackProducts = plan.product_picks ?? [];
  const productActions: DeepRecommendedAction[] = fallbackProducts.slice(0, 4).map((product, index) => ({
    id: `product-${product.id || index + 1}`,
    title: `Install ${product.name}`,
    category: "product",
    effort: product.dashboard_ready ? "medium" : "easy",
    savings_eur_per_year: Math.max(22, Math.round(total * (0.12 + index * 0.03))),
    confidence: product.dashboard_ready ? 62 : 55,
    why: product.why,
    how_it_works: `${product.name} helps reduce waste or reveal consumption patterns so the highest-load device can be controlled instead of guessed.`,
    how_to_proceed: `Compare ${product.brand_examples}, check compatibility, then use the technical team and product docs buttons before buying.`,
    requires_landlord: false,
    requires_technician: false,
    product,
    sources: defaultSourcesFor(product.category),
  }));

  const firstStep = plan.next_steps?.[0];
  const actions = [
    ...provided,
    ...(provided.length ? [] : [
      {
        id: "do-now-1",
        title: firstStep ?? "Tune heating schedule and radiator controls",
        category: "do_now" as const,
        effort: "easy" as const,
        savings_eur_per_year: Math.max(25, Math.round(total * 0.16)),
        confidence: 70,
        why: "This starts with the lowest-friction setting change before buying hardware, so the user gets a clean before/after baseline.",
        how_it_works: "Lower setpoints, better timing, and fewer overheated hours reduce heating demand without changing the building.",
        how_to_proceed: "Set a 7-day schedule, keep rooms around the target comfort level, and compare the next meter reading.",
        requires_landlord: false,
        requires_technician: false,
        sources: defaultSourcesFor("heating"),
      },
      ...productActions,
    ]),
  ];

  if (!actions.some((x) => x.requires_landlord || x.category === "needs_landlord")) {
    actions.push({
      id: "landlord-demo",
      title: "Ask the landlord to approve radiator control or window sealing work",
      category: "needs_landlord",
      effort: "medium",
      savings_eur_per_year: Math.max(45, Math.round(total * 0.22)),
      confidence: 48,
      why: "Assumption: the user rents or shares responsibility for fixed heating/window elements. This is included so the pitch shows the approval workflow.",
      how_it_works: "Approval unlocks small building-side fixes that reduce heat loss or improve heat control without a full renovation.",
      how_to_proceed: "Use the email preview, attach the Kenergy Loop estimate, and ask whether the landlord has a preferred technician or process.",
      requires_landlord: true,
      requires_technician: false,
      sources: defaultSourcesFor("renter"),
    });
  }

  if (!actions.some((x) => x.requires_technician || x.category === "needs_technician")) {
    actions.push({
      id: "technician-demo",
      title: "Book a technician for heating balancing and control compatibility",
      category: "needs_technician",
      effort: "hard",
      savings_eur_per_year: Math.max(65, Math.round(total * 0.28)),
      confidence: 44,
      why: "Assumption: the heating system may have unbalanced radiators or older controls. This pitch action shows Kenergy Loop's technician matching flow.",
      how_it_works: "Hydraulic balancing and compatible controls can reduce overheating and distribution losses across the home.",
      how_to_proceed: "Open Choose technician, select a demo provider, and prepare heating type, photos, and recent bills for the visit.",
      requires_landlord: true,
      requires_technician: true,
      sources: defaultSourcesFor("heating balancing"),
    });
  }

  if (!actions.some((x) => x.category === "monitor")) {
    actions.push({
      id: "monitor-demo",
      title: "Track the biggest load for two weeks",
      category: "monitor",
      effort: "easy",
      savings_eur_per_year: Math.max(24, Math.round(total * 0.1)),
      confidence: 58,
      why: "Monitoring turns the Energy Check into proof: it shows whether behavior, product, or technician actions actually changed consumption.",
      how_it_works: "Repeated readings reveal baseline loads, spikes, and devices that keep drawing energy when not expected.",
      how_to_proceed: "Add two meter readings or use a dashboard-ready smart plug for the suspected high-load appliance.",
      requires_landlord: false,
      requires_technician: false,
      sources: defaultSourcesFor("monitoring"),
    });
  }

  if (!actions.some((x) => x.category === "add_info")) {
    actions.push({
      id: "add-info-demo",
      title: "Add one missing datapoint to sharpen the estimate",
      category: "add_info",
      effort: "easy",
      savings_eur_per_year: 0,
      confidence: 100,
      why: "The current Energy Check can rank actions, but one concrete datapoint would make the savings numbers more reliable.",
      how_it_works: "Bills, meter readings, tariff prices, appliance nameplates, and landlord constraints reduce assumptions in the estimation model.",
      how_to_proceed: "Add the most useful missing number before the next Energy Check so Kenergy Loop can sharpen the estimate.",
      requires_landlord: false,
      requires_technician: false,
      sources: defaultSourcesFor("monitoring"),
    });
  }

  return actions
    .filter((action) => action.title && action.why)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || b.savings_eur_per_year - a.savings_eur_per_year)
    .slice(0, 12);
}

function buildEcosystemPacks(plan: DeepDiagnosisRecord["plan"], actions: DeepRecommendedAction[]): EcosystemPack[] {
  const provided = plan.ecosystem_packs ?? [];
  if (provided.length >= 2) {
    return provided.map((pack, index) => ({
      ...pack,
      yearly_savings_eur: Math.max(Math.round((plan.yearly_savings_eur || 180) * (index === 0 ? 0.75 : 0.55)), pack.yearly_savings_eur),
    }));
  }

  const productActions = actions.filter((action) => action.product);
  const products = productActions.map((action) => action.product!).filter(Boolean);
  const fallbackProducts: ProductPick[] = [
    {
      id: "fallback-smart-plug",
      category: "monitoring plug",
      tier: "budget",
      name: "Matter energy-monitoring smart plug",
      brand_examples: "Eve Energy, TP-Link Tapo, Shelly Plug",
      price_eur: 28,
      why: "Tracks standby and appliance consumption so Kenergy Loop can prove which device actually changed.",
      api_capability: "Matter / Local API",
      dashboard_ready: true,
      sponsored: true,
    },
    {
      id: "fallback-thermostat",
      category: "radiator thermostat",
      tier: "balanced",
      name: "Smart radiator thermostat starter set",
      brand_examples: "tado, Bosch Smart Home, Homematic IP",
      price_eur: 110,
      why: "Improves heating schedules room by room and supports savings verification during the heating season.",
      api_capability: "Matter / Cloud API / Zigbee",
      dashboard_ready: true,
      sponsored: true,
    },
    {
      id: "fallback-humidity",
      category: "comfort sensor",
      tier: "budget",
      name: "Temperature and humidity sensor",
      brand_examples: "Aqara, SwitchBot, Shelly BLU",
      price_eur: 24,
      why: "Adds indoor comfort context so heating cuts do not create mold or comfort problems.",
      api_capability: "Zigbee / Bluetooth / Matter",
      dashboard_ready: true,
    },
  ];
  const usableProducts = [...products, ...fallbackProducts].slice(0, 5);

  if (plan.ecosystem_kit?.items?.length) {
    const legacyPack = {
      id: "legacy-kit",
      name: plan.ecosystem_kit.name,
      solves_action_ids: actions.slice(0, 3).map((action) => action.id),
      description: `${plan.ecosystem_kit.description} ${plan.ecosystem_kit.interoperability}`,
      total_eur: plan.ecosystem_kit.total_eur,
      yearly_savings_eur: Math.max(95, Math.round((plan.yearly_savings_eur || 180) * 0.85)),
      items: plan.ecosystem_kit.items,
      vendor_url: searchUrl(plan.ecosystem_kit.name),
    };
    return [
      legacyPack,
      {
        id: "proof-pack",
        name: "Savings proof pack",
        solves_action_ids: actions.filter((action) => deepFilterFor(action) === "monitor" || deepFilterFor(action) === "small-helper").slice(0, 3).map((action) => action.id),
        description: "A lighter bundle focused on measuring before/after savings and catching inefficient always-on devices.",
        total_eur: usableProducts.slice(0, 2).reduce((sum, item) => sum + Number(item.price_eur || 0), 0),
        yearly_savings_eur: Math.max(75, Math.round((plan.yearly_savings_eur || 180) * 0.55)),
        items: usableProducts.slice(0, 2),
        vendor_url: searchUrl("energy monitoring smart plug humidity sensor"),
      },
    ];
  }

  const packOneItems = usableProducts.slice(0, 3);
  const packTwoItems = usableProducts.slice(1, 4);
  return [
    ...provided,
    {
      id: "comfort-control-pack",
      name: "Sponsored comfort control pack",
      solves_action_ids: actions.filter((action) => ["small-helper", "monitor"].includes(deepFilterFor(action))).slice(0, 3).map((action) => action.id),
      description: "A pitch-ready bundle for room-level heating control plus device monitoring, designed to turn recommendations into measurable savings.",
      total_eur: packOneItems.reduce((sum, item) => sum + Number(item.price_eur || 0), 0),
      yearly_savings_eur: Math.max(120, Math.round((plan.yearly_savings_eur || 180) * 0.9)),
      items: packOneItems,
      vendor_url: searchUrl(packOneItems.map((item) => item.name).join(" ")),
    },
    {
      id: "monitoring-proof-pack",
      name: "Sponsored monitoring proof pack",
      solves_action_ids: actions.filter((action) => ["monitor", "add-info"].includes(deepFilterFor(action))).slice(0, 3).map((action) => action.id),
      description: "A cheaper bundle focused on proof: it records appliance load and comfort data so Kenergy Loop can identify waste faster.",
      total_eur: packTwoItems.reduce((sum, item) => sum + Number(item.price_eur || 0), 0),
      yearly_savings_eur: Math.max(85, Math.round((plan.yearly_savings_eur || 180) * 0.65)),
      items: packTwoItems,
      vendor_url: searchUrl(packTwoItems.map((item) => item.name).join(" ")),
    },
  ].slice(0, Math.max(2, provided.length + 2));
}

function categoryRank(category: DeepRecommendedAction["category"]) {
  return {
    do_now: 1,
    small_helper: 2,
    product: 3,
    monitor: 4,
    add_info: 5,
    needs_landlord: 6,
    needs_technician: 7,
  }[category];
}

function categoryLabel(category: DeepRecommendedAction["category"]) {
  return {
    do_now: "Do now",
    small_helper: "Small helper",
    product: "Product action",
    monitor: "Monitor",
    add_info: "Add info",
    needs_landlord: "Needs landlord",
    needs_technician: "Needs technician",
  }[category];
}

type DeepActionFilter = "do-now" | "small-helper" | "monitor" | "add-info" | "needs-landlord";

const deepFilters: Array<{ key: "all" | DeepActionFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "do-now", label: "Do Now" },
  { key: "small-helper", label: "Small Helper" },
  { key: "monitor", label: "Monitor" },
  { key: "add-info", label: "Add Info" },
  { key: "needs-landlord", label: "Landlord" },
];

function deepFilterFor(action: DeepRecommendedAction): DeepActionFilter {
  if (action.category === "do_now") return "do-now";
  if (action.category === "monitor") return "monitor";
  if (action.category === "add_info") return "add-info";
  if (action.category === "needs_landlord" || action.category === "needs_technician" || action.requires_landlord || action.requires_technician) {
    return "needs-landlord";
  }
  return "small-helper";
}

function productUrl(product: ProductPick) {
  return product.product_url || searchUrl(`${product.name} ${product.brand_examples}`);
}

function searchUrl(query: string) {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}`;
}

function externalSources(sources?: DeepRecommendedAction["sources"]) {
  return (sources ?? []).filter((source) => source.url?.startsWith("http"));
}

function defaultSourcesFor(topic: string) {
  const q = topic.toLowerCase();
  if (q.includes("renter")) return [{ label: "Verbraucherzentrale", url: "https://www.verbraucherzentrale.de/wissen/energie" }];
  if (q.includes("monitor")) return [{ label: "Energy Saving Trust", url: "https://energysavingtrust.org.uk/advice/smart-meters/" }];
  if (q.includes("balancing")) return [{ label: "co2online heating balancing", url: "https://www.co2online.de/modernisieren-und-bauen/heizung/hydraulischer-abgleich/" }];
  if (q.includes("plug") || q.includes("product")) return [{ label: "Energy Saving Trust appliances", url: "https://energysavingtrust.org.uk/advice/home-appliances/" }];
  return [{ label: "Umweltbundesamt heating guide", url: "https://www.umweltbundesamt.de/themen/richtig-heizen" }];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  help,
  tone,
}: {
  label: string;
  value: string;
  help: string;
  tone?: "money" | "energy" | "grade" | "quality";
}) {
  const toneClass =
    tone === "money"
      ? "border-primary/35 bg-primary/10 text-primary"
      : tone === "energy"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
        : tone === "grade"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : tone === "quality"
            ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
            : "border-border/60 bg-background/75 text-foreground";
  return (
    <div className={`group rounded-2xl border p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{label}</div>
        <span className="relative">
          <HelpCircle tabIndex={0} className="peer h-3.5 w-3.5 cursor-help opacity-70 outline-none transition-opacity hover:opacity-100" />
          <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-60 rounded-xl border border-border bg-popover p-3 text-[11px] leading-relaxed text-popover-foreground opacity-0 shadow-[var(--shadow-soft)] transition-opacity peer-hover:opacity-100 peer-focus:opacity-100">
            {help}
          </span>
        </span>
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
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
        Every Energy Report you've generated is saved. Open one to view it again — no credit is spent for re-reading old results.
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
