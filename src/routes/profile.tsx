import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Kenergy Loop" },
      { name: "description", content: "Your saved energy profile, surveys, and Energy-Saving Plan history." },
    ],
  }),
  component: ProfilePage,
});

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [hasSurvey, setHasSurvey] = useState<boolean | null>(null);
  const [hasLongForm, setHasLongForm] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { count: sc }, { count: lc }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("long_form_responses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setProfile(p);
      setDisplayName(p?.display_name ?? "");
      setHasSurvey((sc ?? 0) > 0);
      setHasLongForm((lc ?? 0) > 0);
    })();
  }, [user]);

  async function saveName() {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setSaving(false);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-2xl px-4 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Account</h2>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            onClick={saveName}
            disabled={saving || displayName === (profile?.display_name ?? "")}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Energy profile</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <ProgressRow done={!!hasSurvey} label="60-second Quick Survey" cta="Take it" href="/survey" />
            <ProgressRow done={!!hasLongForm} label="Long-form profile" cta="Open" href="/long-form" />
          </ul>
          <Link
            to="/recommendations"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            View my Energy-Saving Plan
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProgressRow({ done, label, cta, href }: { done: boolean; label: string; cta: string; href: string }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-4 py-3">
      <span className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
        {label}
      </span>
      <Link to={href} className="text-xs font-medium text-primary hover:underline">
        {done ? "Update" : cta}
      </Link>
    </li>
  );
}
