import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Zap, Leaf, TrendingDown, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site-nav";
import { getShareCardBySlug, type ShareCard } from "@/lib/phase4";

export const Route = createFileRoute("/s/$slug")({
  head: ({ loaderData }) => {
    const card = loaderData as ShareCard | undefined;
    const title = card
      ? `${card.display_name ?? "Someone"} is saving €${card.savings_eur}/yr with Kenergy Loop`
      : "Kenergy Loop savings card";
    const desc = card
      ? `${card.savings_eur}€/year · ${card.kwh_saved} kWh · ${card.co2_saved_kg} kg CO₂ avoided. Get your own free energy-saving plan in 60 seconds.`
      : "Get your own free energy-saving plan in 60 seconds.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
    };
  },
  loader: async ({ params }) => {
    const card = await getShareCardBySlug(params.slug);
    if (!card) throw notFound();
    return card;
  },
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Couldn't load this card</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing or go home.</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Share card not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may have expired.</p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Get your free plan
        </Link>
      </div>
    </div>
  ),
  component: ShareCardPage,
});

function ShareCardPage() {
  const card = Route.useLoaderData() as ShareCard;
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My Kenergy Loop savings", url });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Couldn't copy link.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-16">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Zap className="h-4 w-4" />
          </span>
          Kenergy Loop
        </Link>

        <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div
            className="px-8 py-10 text-center"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="text-sm font-medium uppercase tracking-wider text-primary">
              {card.display_name ?? "A Kenergy Loop user"} just unlocked
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-7xl font-bold tracking-tight">€{card.savings_eur}</span>
              <span className="text-xl text-muted-foreground">/year</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">in estimated energy savings</div>
            {card.headline && (
              <p className="mx-auto mt-6 max-w-md text-base text-foreground/90">
                "{card.headline}"
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card p-6 text-center">
              <TrendingDown className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 text-2xl font-bold">{card.kwh_saved}</div>
              <div className="text-xs text-muted-foreground">kWh saved / year</div>
            </div>
            <div className="bg-card p-6 text-center">
              <Leaf className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 text-2xl font-bold">{card.co2_saved_kg}</div>
              <div className="text-xs text-muted-foreground">kg CO₂ avoided / year</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-card p-6 sm:flex-row">
            <Link
              to="/survey"
              className="flex-1 rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
            >
              Get your free plan in 60 seconds
            </Link>
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
          Estimates are based on the user's home profile. Get your own personalized Energy-Saving Plan —
          free, no credit card needed.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
