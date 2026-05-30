import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ExternalLink, Sparkles, ShoppingBag } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { getKitBySlug, type SmartKit } from "@/lib/kits";
import { amazonSearchUrl, formatEur } from "@/lib/affiliates";

export const Route = createFileRoute("/k/$slug")({
  loader: async ({ params }) => {
    const kit = await getKitBySlug(params.slug);
    if (!kit) throw notFound();
    return kit;
  },
  head: ({ loaderData }) => {
    const kit = loaderData as SmartKit | undefined;
    const title = kit?.headline?.slice(0, 60) ?? "An Kenergy Loop-curated smart home kit";
    const desc = kit
      ? `${kit.items.length} compatible items · indicative total ${formatEur(kit.subtotal_eur)}. Built by Kenergy Loop.`
      : "Kenergy Loop-curated smart home kit from Kenergy Loop.";
    return {
      meta: [
        { title: `${title} — Kenergy Loop` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: KitPage,
});

function KitPage() {
  const kit = Route.useLoaderData() as SmartKit;

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Kenergy Loop-curated kit
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {kit.headline ?? "Smart home kit tailored to a home like yours"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {kit.items.length} compatible items across multiple brands. No vendor lock-in. Prices are indicative — click to see live options.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          Indicative total: <span className="font-semibold">{formatEur(kit.subtotal_eur)}</span>
        </div>

        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {kit.items.map((item, i) => {
            const firstBrand = item.brand_examples.split(/[,;/]/)[0]?.trim() || "";
            const q = `${firstBrand} ${item.name}`.trim();
            return (
              <li
                key={`${item.name}-${i}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {item.name} <span className="font-normal text-muted-foreground">× {item.qty}</span>
                    </div>
                    <div className="shrink-0 text-sm font-semibold">
                      ~{formatEur(item.qty * item.price_each_eur)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{item.brand_examples}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.why}</div>
                </div>
                <a
                  href={amazonSearchUrl(q)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> View options
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
          <div className="font-semibold">Want a kit fitted to your home?</div>
          <p className="mt-1 text-muted-foreground">
            Run the free 60-second survey and we'll generate your own Kenergy Loop-curated kit, sized to your rooms, heating, and budget.
          </p>
          <Link
            to="/survey"
            className="mt-3 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Start free survey
          </Link>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Some links may earn Kenergy Loop a small commission — never affects price.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
