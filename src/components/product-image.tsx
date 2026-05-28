import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  name: string;
  brand?: string;
  /**
   * Optional explicit image URL. If provided we try this first.
   * If it fails to load (or no URL is given), we render a stylized
   * "image not found" placeholder card so the layout never breaks.
   */
  src?: string | null;
  className?: string;
  /** Tailwind aspect class, e.g. "aspect-[4/3]" (default) */
  aspect?: string;
};

/**
 * Renders a product image with a graceful fallback.
 * Used anywhere we suggest a product (replacement kits, smart-home kits,
 * recommended swaps). When no image URL is available — or the URL 404s —
 * we render a branded placeholder with the product name so the user
 * always sees something rather than a broken icon.
 */
export function ProductImage({ name, brand, src, className = "", aspect = "aspect-[4/3]" }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={`${aspect} relative w-full overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted/60 to-muted ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
          <ImageOff className="mb-1.5 h-5 w-5 text-muted-foreground/60" />
          <div className="line-clamp-2 text-[10px] font-semibold text-foreground/80">{name}</div>
          {brand && (
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{brand}</div>
          )}
          <div className="mt-1 text-[9px] text-muted-foreground/70">image not found</div>
        </div>
      )}
    </div>
  );
}
