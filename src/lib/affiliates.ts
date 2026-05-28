// Affiliate-link helpers. Single source of truth so the tag can be swapped
// (or replaced with a real partner network) without hunting through the UI.
export const AFFILIATE_TAG = "kenergy-21";

export function amazonSearchUrl(query: string) {
  const q = encodeURIComponent(query.trim());
  return `https://www.amazon.de/s?k=${q}&tag=${AFFILIATE_TAG}`;
}

export function formatEur(n: number) {
  return `€${Math.round(n).toLocaleString()}`;
}
