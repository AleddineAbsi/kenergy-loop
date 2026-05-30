import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Lock, LogOut, Menu, Moon, ShieldCheck, Sun, User, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";

type NavLink = { to: string; label: string; locked?: boolean; adminOnly?: boolean };
type NavGroup = { label: string; links: NavLink[] };

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState<string | false>(false);
  const { user, signOut, loading } = useAuth();
  const { access } = useAccess();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    setMoreOpen(false);
    navigate({ to: "/" });
  }

  const primaryLinks: NavLink[] = [
    { to: "/scan", label: "Scan-a-Room" },
    { to: "/survey", label: "Quick Survey" },
    { to: "/long-form", label: "Deep Analysis", locked: !access.hasDeepAnalysis },
    { to: "/monitoring", label: "Monitor" },
  ];

  const navGroups: NavGroup[] = [
    {
      label: "Account",
      links: [
        { to: "/pricing", label: "Pricing" },
        { to: "/settings", label: "Settings" },
      ],
    },
  ];

  const visiblePrimary = primaryLinks.filter((l) => !l.adminOnly || access.isAdmin);
  const visibleGroups = navGroups
    .map((group) => ({ ...group, links: group.links.filter((l) => !l.adminOnly || access.isAdmin) }))
    .filter((group) => group.links.length > 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Zap className="h-4 w-4" />
          </span>
          <span>Kenergy Loop</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {visiblePrimary.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMoreOpen(false)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
            >
              {l.adminOnly && <ShieldCheck className="h-3 w-3 text-primary" />}
              {l.locked && <Lock className="h-3 w-3" />}
              {l.label}
            </Link>
          ))}
          {visibleGroups.map((group) => (
            <div key={group.label} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((value) => (value === group.label ? false : group.label))}
                onBlur={() => window.setTimeout(() => setMoreOpen(false), 120)}
                className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-haspopup="menu"
                aria-expanded={moreOpen === group.label}
              >
                {group.label} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen === group.label ? "rotate-180" : ""}`} />
              </button>
              {moreOpen === group.label && (
                <div
                  role="menu"
                  className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-soft)]"
                >
                  {group.links.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
                    >
                      {l.adminOnly && <ShieldCheck className="h-3 w-3 text-primary" />}
                      {l.locked && <Lock className="h-3 w-3" />}
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
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
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Start
            </div>
            {visiblePrimary.map((l) => (
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
            {visibleGroups.map((group) => (
              <div key={group.label}>
                <div className="mt-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {group.links.map((l) => (
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
              </div>
            ))}
            <div className="my-2 h-px bg-border" />
            <div className="px-3 py-2">
              <ThemeToggle className="w-full justify-center" />
            </div>
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
    <footer className="relative z-10 border-t border-border/60 bg-card/95 py-8 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Kenergy Loop</span> — Smart home energy-saving assistant. Estimates only; not professional advice.
      </div>
    </footer>
  );
}

function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("kenergy-loop-theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("kenergy-loop-theme", next);
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground ${className}`}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      {dark ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
      <span className="hidden lg:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
