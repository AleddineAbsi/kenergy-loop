import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { seedKnowledgeBase } from "@/lib/rag.functions";


export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Kenergy" },
      { name: "description", content: "Edit your home profile, notification preferences and connected data sources." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <Section title="Home profile">
          <Row label="Postal code" value="10115 Berlin" />
          <Row label="Apartment size" value="55 m²" />
          <Row label="People in household" value="2" />
          <Row label="Heating type" value="District heating" />
        </Section>

        <Section title="Data sources">
          <Row label="Last room scan" value="3 days ago" />
          <Row label="Last bill upload" value="Not yet" action="Upload" />
          <Row label="Smart plug" value="Not connected" action="Connect" />
        </Section>

        <Section title="Notifications">
          <Toggle label="Weekly summary email" defaultChecked />
          <Toggle label="Anomaly alerts" defaultChecked />
          <Toggle label="Product offers" />
        </Section>

        <Section title="Account">
          <button className="w-full rounded-md border border-border px-4 py-2 text-left text-sm hover:bg-muted">Export my data</button>
          <button className="mt-2 w-full rounded-md border border-destructive/30 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/5">
            Delete account
          </button>
        </Section>

        <Section title="AI knowledge base">
          <p className="text-sm text-muted-foreground">
            Seed the retrieval-augmented agent with curated energy-savings snippets. Re-run to refresh.
          </p>
          <SeedButton />
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SeedButton() {
  const seed = useServerFn(seedKnowledgeBase);
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await seed();
          toast.success(`Seeded ${res.inserted} knowledge chunks`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Seed failed");
        } finally {
          setLoading(false);
        }
      }}
      className="w-full rounded-md border border-border px-4 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
    >
      {loading ? "Seeding…" : "Seed knowledge base"}
    </button>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, value, action }: { label: string; value: string; action?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3">
        <span className="font-medium">{value}</span>
        {action && <button className="text-primary hover:underline">{action}</button>}
      </span>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-5 w-9 appearance-none rounded-full bg-muted transition-colors checked:bg-primary" />
    </label>
  );
}
