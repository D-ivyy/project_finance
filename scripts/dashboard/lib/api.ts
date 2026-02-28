import type { SiteData } from "@/types";

// In production (Cloud Run), API is on the same origin behind Nginx → use ""
// In development, API runs on a separate port → use localhost:8001
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchSites(): Promise<
  { asset_slug: string; asset_type: string; state: string }[]
> {
  const res = await fetch(`${API_BASE}/api/sites`);
  if (!res.ok) throw new Error(`Failed to load sites: ${res.statusText}`);
  return res.json();
}

export async function fetchSiteData(
  siteSlug: string,
  kind = "hub",
  market = "da"
): Promise<SiteData> {
  const url = `${API_BASE}/api/revenue/${siteSlug}?kind=${kind}&market=${market}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load data for ${siteSlug}: ${res.statusText}`);
  return res.json();
}

/** Format a number as $X.XXM */
export function fmtMillion(n: number, decimals = 2): string {
  return `$${(n / 1_000_000).toFixed(decimals)}M`;
}

/** Format a DSCR value */
export function fmtDscr(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}x`;
}

/** Format a percent */
export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}
