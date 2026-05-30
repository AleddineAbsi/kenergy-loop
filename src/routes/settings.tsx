import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { loadLongFormResponse, loadSurveyResponse } from "@/lib/responses";
import { listLongFormUploads, type LongFormUpload } from "@/lib/long-form-uploads";

type KnowledgeSnapshot = {
  survey: Record<string, unknown>;
  longForm: Record<string, unknown>;
  uploads: LongFormUpload[];
  surveyUpdated?: string;
  longFormUpdated?: string;
};

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account — Kenergy Loop" },
      { name: "description", content: "See the profile information Kenergy Loop currently uses for estimates and recommended actions." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingSnapshot(true);
      try {
        const [survey, longForm, uploads] = await Promise.all([
          loadSurveyResponse(),
          loadLongFormResponse(),
          listLongFormUploads(),
        ]);
        if (cancelled) return;
        setSnapshot({
          survey: normalizeRecord(survey?.answers),
          longForm: normalizeRecord(longForm?.answers),
          uploads,
          surveyUpdated: survey?.updated_at,
          longFormUpdated: longForm?.updated_at,
        });
      } finally {
        if (!cancelled) setLoadingSnapshot(false);
      }
    }
    if (user) load();
    else setLoadingSnapshot(false);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const surveyRows = useMemo(() => flattenInfo(snapshot?.survey ?? {}), [snapshot?.survey]);
  const longRows = useMemo(() => flattenInfo(snapshot?.longForm ?? {}), [snapshot?.longForm]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">Account</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">What Kenergy Loop knows about you</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              This is a read-only profile summary used for estimates and recommended actions. Update it by running the quick survey or requesting a new Deep Analysis.
            </p>
          </div>
          <Link to="/long-form" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Update through Deep Analysis
          </Link>
        </div>

        {loading || loadingSnapshot ? (
          <Section title="Loading">
            <p className="text-sm text-muted-foreground">Loading your profile context...</p>
          </Section>
        ) : !user ? (
          <Section title="Not signed in">
            <p className="text-sm text-muted-foreground">Sign in to see the information saved to your Kenergy Loop profile.</p>
            <Link to="/login" className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Sign in
            </Link>
          </Section>
        ) : (
          <>
            <Section title="Account">
              <ReadOnlyRow label="Email" value={user.email ?? "Unknown"} />
              <ReadOnlyRow label="Quick survey last updated" value={formatDate(snapshot?.surveyUpdated)} />
              <ReadOnlyRow label="Deep profile last updated" value={formatDate(snapshot?.longFormUpdated)} />
              <ReadOnlyRow label="Uploaded deep-analysis files" value={`${snapshot?.uploads.length ?? 0}`} />
            </Section>

            <Section title="Quick survey information">
              {surveyRows.length ? (
                <InfoGrid rows={surveyRows} />
              ) : (
                <EmptyState text="No quick survey answers saved yet." to="/survey" action="Take the free survey" />
              )}
            </Section>

            <Section title="Deep Analysis profile information">
              {longRows.length ? (
                <InfoGrid rows={longRows} />
              ) : (
                <EmptyState text="No deep profile answers saved yet." to="/long-form" action="Open Deep Analysis" />
              )}
            </Section>

            <Section title="Uploads Kenergy Loop can use">
              {snapshot?.uploads.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {snapshot.uploads.map((upload) => (
                    <div key={upload.id} className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                      <div className="font-semibold">{upload.label || upload.file_path}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{upload.kind}</div>
                      {upload.notes && <p className="mt-2 text-xs text-muted-foreground">{upload.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No bills, appliance photos, or extra documents uploaded yet." to="/long-form" action="Add files in Deep Analysis" />
              )}
            </Section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
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

function InfoGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <ReadOnlyRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm transition-all hover:-translate-y-0.5 hover:border-primary/30">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{humanize(label)}</div>
      <div className="mt-1 font-medium">{value || "Not provided"}</div>
    </div>
  );
}

function EmptyState({ text, to, action }: { text: string; to: string; action: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
      {text}
      <Link to={to} className="ml-2 font-semibold text-primary hover:underline">
        {action}
      </Link>
    </div>
  );
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function flattenInfo(record: Record<string, unknown>, prefix = ""): Array<{ label: string; value: string }> {
  return Object.entries(record)
    .flatMap(([key, value]) => {
      const label = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) return flattenInfo(value as Record<string, unknown>, label);
      if (Array.isArray(value)) return [{ label, value: value.join(", ") }];
      return [{ label, value: String(value ?? "") }];
    })
    .filter((row) => row.value && row.value !== "undefined" && row.value !== "null");
}

function humanize(value: string) {
  return value
    .replace(/^ai_follow_up\\./, "Follow-up detail: ")
    .replace(/[_.]/g, " ")
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}
