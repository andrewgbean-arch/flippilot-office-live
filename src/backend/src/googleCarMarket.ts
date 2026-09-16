// Cross-reference used-car dealer pricing from real UK price-comparison
// and classified sites (AutoTrader, Cazoo, AutoUncle, Parkers, etc.) via
// SerpAPI's Google search — a second, independent signal alongside the
// eBay guide price, since eBay's Buy It Now prices are what a seller set
// to sell quickly, not necessarily full retail value.
//
// Deliberately manual/on-demand only (see routes/googlePriceGuide.ts) —
// SerpAPI's key here is the SAME one flippilotlatest's consumer app
// already uses for its barcode-scanner price lookups, and its free tier
// is only 100 searches/month for BOTH apps combined. Auto-fetching this
// on every vehicle page view (like the eBay comps do) would burn through
// that shared budget in a single afternoon of browsing inventory.
//
// No official structured "used car price" API exists behind this — the
// price figures come from parsing real page snippets in Google's own
// search results, which is inherently less precise than eBay's
// structured price field. Reported as its own separate, clearly labelled
// guide rather than blended into the eBay number, so a dealer can weigh
// both rather than being handed one falsely-precise blended figure.

function hasSerpApiKey(): boolean {
  return Boolean(process.env.SERPAPI_KEY);
}

function filterOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  if (q1 == null || q3 == null) return prices;
  const iqr = q3 - q1;
  const min = q1 - iqr * 1.5;
  const max = q3 + iqr * 1.5;
  return prices.filter((p) => p >= min && p <= max);
}

// Pulls every "£X,XXX" (optionally "£X,XXX - £Y,YYY" range) mention out
// of a page snippet. Deliberately requires the £ sign — a bare number
// ("8,618 cars available") is a listing count, not a price, and this
// avoids picking those up.
function extractPricesFromText(text: string | undefined | null): number[] {
  if (!text) return [];
  // Two alternatives, tried in order: a comma-grouped number ("£29,750",
  // requires at least one ",XXX" group so it never partially matches a
  // plain number) or a plain 3-6 digit run with no separator ("£5998").
  // The comma-only version this replaced silently truncated any 4+
  // digit price with no comma — "£5998" (a real snippet, confirmed
  // live) was parsed as just "599" and nearly fell below the £300
  // floor below, quietly discarding a genuine price as noise.
  const matches = text.match(/£\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|£\s?\d{3,6}(?:\.\d{2})?/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/[£,\s]/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 300 && n <= 200000); // strips deposit/monthly figures and obvious junk
}

export interface GoogleCarPriceGuide {
  average: number;
  lowest: number;
  highest: number;
  sourceCount: number; // how many real snippets a price was pulled from
  sources: string[]; // site names actually used (e.g. "autotrader.co.uk")
}

interface CacheEntry {
  result: GoogleCarPriceGuide | null;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
// Much longer than the eBay cache (6h) — SerpAPI's shared 100/month
// budget can't support frequent re-fetching the way eBay's free
// 5,000/day tier can. Only applied to genuine successful results —
// a FAILURE (bad API response, or zero usable prices) gets a much
// shorter TTL below, so a transient issue (or, as happened live: this
// key not being loaded yet on an older running process) doesn't get
// stuck returning "not found" for a full week.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchGoogleCarPriceGuide(
  make: string,
  model: string,
  year: number | null,
  mileage: number | null
): Promise<GoogleCarPriceGuide | null> {
  if (!hasSerpApiKey() || !make || !model) return null;

  const cacheKey = `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}|${year ?? "?"}|${mileage ?? "?"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const parts = [make, model];
    if (year != null) parts.push(String(year));
    if (mileage != null) parts.push(`${mileage} miles`);
    const query = `used ${parts.join(" ")} price UK`;

    const url =
      "https://serpapi.com/search.json?" +
      new URLSearchParams({
        engine: "google",
        q: query,
        google_domain: "google.co.uk",
        gl: "uk",
        hl: "en",
        api_key: process.env.SERPAPI_KEY!,
      }).toString();

    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.error("SerpAPI Google search failed:", res.status);
      cache.set(cacheKey, { result: null, expiresAt: Date.now() + FAILURE_CACHE_TTL_MS });
      return null;
    }

    const data = await res.json();
    const results: any[] = data.organic_results ?? [];

    const prices: number[] = [];
    const sources = new Set<string>();

    for (const r of results) {
      const found = extractPricesFromText(r?.snippet);
      if (found.length === 0) continue;
      prices.push(...found);
      try {
        const host = new URL(r?.link ?? "").hostname.replace(/^www\./, "");
        if (host) sources.add(host);
      } catch {
        // malformed link — skip attributing a source, the prices still count
      }
    }

    const filtered = filterOutliers(prices);
    if (filtered.length === 0) {
      cache.set(cacheKey, { result: null, expiresAt: Date.now() + FAILURE_CACHE_TTL_MS });
      return null;
    }

    const result: GoogleCarPriceGuide = {
      average: Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length),
      lowest: Math.round(Math.min(...filtered)),
      highest: Math.round(Math.max(...filtered)),
      sourceCount: filtered.length,
      sources: Array.from(sources),
    };

    cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.error("fetchGoogleCarPriceGuide failed:", err);
    return null;
  }
}
