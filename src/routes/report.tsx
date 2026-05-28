import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Printer, Mail, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { buildMonthlyReport, emailMonthlyReport, type MonthlyReport } from "@/lib/report.functions";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Monthly report — Kenergy" },
      { name: "description", content: "Printable monthly energy report with consumption trend, top actions and CO₂ avoided." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { user, loading: authLoading } = useAuth();
  const build = useServerFn(buildMonthlyReport);
  const sendEmail = useServerFn(emailMonthlyReport);

  const q = useQuery<MonthlyReport>({
    queryKey: ["monthly-report", user?.id ?? "guest"],
    queryFn: () => build(),
    enabled: Boolean(user) && !authLoading,
  });

  const email = useMutation({
    mutationFn: () => sendEmail(),
    onSuccess: (res) => {
      if (res.ok) toast.success(`Sent to ${res.sent_to}`);
      else if (res.reason === "missing-secret")
        toast.info("Email isn't set up yet. Ask the workspace owner to add the RESEND_API_KEY secret to enable monthly emails.");
      else toast.error("Couldn't send the email — please try again.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Sign in to view your report</h1>
          <Link to="/login" className="mt-6 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="print:hidden"><SiteNav /></div>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monthly report</h1>
            <p className="mt-1 text-sm text-muted-foreground">Print to PDF or email yourself a copy.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <Printer className="h-4 w-4" /> Download PDF
            </button>
            <button
              onClick={() => email.mutate()}
              disabled={email.isPending || !q.data}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {email.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Email me
            </button>
          </div>
        </div>

        {q.isPending && (
          <div className="mt-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> Building your report…
          </div>
        )}
        {q.isError && (
          <div className="mt-8 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" /> {(q.error as Error).message}
          </div>
        )}

        {q.data && <ReportBody r={q.data} />}
      </main>
      <div className="print:hidden"><SiteFooter /></div>
    </div>
  );
}

function ReportBody({ r }: { r: MonthlyReport }) {
  const max = Math.max(1, ...r.readings.map((p) => p.kwh));
  return (
    <article className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] print:border-0 print:shadow-none">
      <header>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Kenergy · monthly report</div>
        <h2 className="mt-1 text-2xl font-bold">{r.display_name ?? r.user_email ?? "Your home"}</h2>
        <p className="text-sm text-muted-foreground">{r.period_start} → {r.period_end}</p>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">kWh used</div>
          <div className="text-2xl font-bold">{r.total_kwh}</div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">vs prev 30d</div>
          <div className={`text-2xl font-bold ${r.delta_pct > 0 ? "text-destructive" : "text-primary"}`}>
            {r.delta_pct > 0 ? "+" : ""}{r.delta_pct}%
          </div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-[11px] uppercase text-muted-foreground">CO₂ kg</div>
          <div className="text-2xl font-bold">{r.co2_kg}</div>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Consumption trend</h3>
        {r.readings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No readings yet — log a few in <Link to="/monitoring" className="text-primary hover:underline">Monitor</Link> to see your trend.</p>
        ) : (
          <div className="mt-3 flex h-32 items-end gap-1">
            {r.readings.map((p, i) => (
              <div
                key={i}
                title={`${p.date}: ${p.kwh} kWh`}
                className="flex-1 rounded-t bg-primary/70"
                style={{ height: `${(p.kwh / max) * 100}%` }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Top 5 actions to save more</h3>
        {r.top_actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Generate your <Link to="/recommendations" className="text-primary hover:underline">AI action plan</Link> to populate this section.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {r.top_actions.map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>{a.title}</span>
                <span className="font-semibold text-primary">~€{a.savings_eur_per_year}/yr</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-6 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Estimated yearly savings if all actions are applied: <b>€{r.yearly_savings_eur}</b> · Score {r.energy_score} ({r.grade}) · Generated {new Date(r.generated_at).toLocaleString()}
      </footer>
    </article>
  );
}
