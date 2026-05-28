import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, LogOut, Menu, ShieldCheck, User, X, Zap } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";

type NavLink = { to: string; label: string; locked?: boolean; adminOnly?: boolean };

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { user, signOut, loading } = useAuth();
  const { access } = useAccess();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  }

  const links: NavLink[] = [
    { to: "/scan", label: "Scan-a-Room" },
    { to: "/survey", label: "Quick Survey" },
    { to: "/long-form", label: "Deep Analysis", locked: !access.hasDeepAnalysis },
    { to: "/recommendations", label: "Actions" },
    { to: "/monitoring", label: "Monitor" },
    { to: "/admin/monitoring", label: "Fleet", adminOnly: true },
    { to: "/report", label: "Report" },
    { to: "/pricing", label: "Pricing" },
    { to: "/settings", label: "Settings" },
  ];

  const visible = links.filter((l) => !l.adminOnly || access.isAdmin);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Zap className="h-4 w-4" />
          </span>
          <span>Kenergy</span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {visible.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
            >
              {l.adminOnly && <ShieldCheck className="h-3 w-3 text-primary" />}
              {l.locked && <Lock className="h-3 w-3" />}
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <User className="h-4 w-4" />
                {user.email?.split("@")[0]}
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
            >
              Sign in
            </Link>
          )}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-md border border-border md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-2 py-2">
            {visible.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-md px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
              >
                {l.adminOnly && <ShieldCheck className="h-3 w-3 text-primary" />}
                {l.locked && <Lock className="h-3 w-3" />}
                {l.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {user.email}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
        Kenergy — AI energy optimizer for smart home appliances. Estimates only; not professional advice.
      </div>
    </footer>
  );
}
