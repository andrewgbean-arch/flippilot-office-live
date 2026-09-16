// Real used-car comparable pricing via eBay's official Browse API
// (OAuth2 client-credentials flow — the same free, self-serve tier used
// by the sibling flippilotlatest project's own eBay integration, just
// adapted here for cars instead of general retail items).
//
// Two things a naive "average every matching eBay listing" approach
// would get wrong for a used-car dealer, both filtered out below:
//  - PRIVATE listings often price well under trade value because of
//    damage, very high mileage, or an insurance write-off the seller
//    is quietly offloading — comparing a dealer's asking price against
//    those skews the "market average" down unfairly. eBay's Browse API
//    returns a real seller.sellerAccountType (BUSINESS vs INDIVIDUAL)
//    field on EBAY_GB, so this only ever counts BUSINESS (trade) sellers.
//  - Listings for a written-off/damaged car of the same make and model
//    are not comparable stock at all, so titles mentioning a write-off
//    category or damage are excluded outright, regardless of seller type.
// Mileage also isn't filterable numerically via the Browse API's search
// itself, so it's extracted from each listing's own title text and used
// to keep only genuinely comparable listings (a 24k-mile car isn't a
// fair comp against a 140k-mile one of the same model).

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

// Read at call time, not module load — same dotenv-ordering reasoning
// as getJwtSecret()/getStripe() elsewhere in this backend.
function hasEbayCreds(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`eBay OAuth token request failed: ${res.status}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 7200) * 1000,
  };
  return tokenCache.token;
}

// UK listing titles disclose a write-off category or damage in fairly
// consistent, predictable wording (eBay/consumer law effectively
// requires it) — not a guaranteed-complete filter, but a real, honest
// first line of defence against averaging in non-comparable damaged
// stock, same "strip obviously non-comparable listings before
// averaging" shape as flippilotlatest's own bulk-listing filter.
const DAMAGE_PATTERNS = [
  /\bcat(?:egory)?\s*[.\-]?\s*[abcdns]\b/i, // "Cat S", "Category N", "CAT.C"
  /\bwrite[\s-]?off\b/i,
  /\bsalvage\b/i,
  /\bnon[\s-]?runner\b/i,
  /\bspares?\s*(?:or|and|\/)\s*repairs?\b/i,
  /\baccident\s*damage(?:d)?\b/i,
  /\bdamaged\b/i,
  /\bfire\s*damage(?:d)?\b/i,
  /\bflood\s*damage(?:d)?\b/i,
];

function isDamagedOrWriteOff(title: string | undefined | null): boolean {
  if (!title) return false;
  return DAMAGE_PATTERNS.some((re) => re.test(title));
}

// Best-effort mileage extraction from a UK car listing's own title —
// there's no structured, queryable mileage field on eBay's search
// itself. Handles the common real formats: "24,000 miles", "24000 mi",
// "24k miles". Returns null (not excluded, just "unknown") when a
// title doesn't state it plainly, rather than guessing.
function extractMileageFromTitle(title: string | undefined | null): number | null {
  if (!title) return null;
  const kMatch = title.match(/\b(\d{1,3})\s*k\s*(?:miles|mi\b)/i);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const plainMatch = title.match(/\b(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:miles|mi\b)/i);
  if (plainMatch?.[1]) return Number(plainMatch[1].replace(/,/g, ""));
  return null;
}

// UK listing titles conventionally lead with the registration year
// ("2020 BMW M2 Competition ...") — a plausible 4-digit year (1980 to
// next year, to allow a plate-year listed slightly ahead) anywhere in
// the title. Returns null when none is found rather than guessing.
function extractYearFromTitle(title: string | undefined | null): number | null {
  if (!title) return null;
  const currentYear = new Date().getFullYear();
  const matches = title.match(/\b(19[89]\d|20[0-4]\d)\b/g);
  if (!matches) return null;
  const year = Number(matches[0]);
  return year <= currentYear + 1 ? year : null;
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

export interface EbayCarComps {
  average: number;
  lowest: number;
  highest: number;
  soldCount: number; // real: count of comparable listings actually used
  demandScore: number;
  yearFiltered: boolean; // true only when a real year was supplied and actually applied as a filter
  mileageFiltered: boolean; // true if the average is from mileage-comparable listings specifically
  sampleSize: number; // total dealer, non-damaged listings found before mileage narrowing
}

interface CacheEntry {
  result: EbayCarComps | null;
  expiresAt: number;
}
const compsCache = new Map<string, CacheEntry>();
// eBay's free tier is 5,000 calls/day shared across the whole app —
// caching per make+model for several hours means a dealer with many
// vehicles of similar stock, or the same page reloaded repeatedly,
// doesn't re-spend that budget on an identical search every time.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchEbayCarComps(
  make: string,
  model: string,
  year: number | null,
  mileage: number | null
): Promise<EbayCarComps | null> {
  if (!hasEbayCreds() || !make || !model) return null;

  const cacheKey = `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}|${year ?? "?"}|${mileage ?? "?"}`;
  const cached = compsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const token = await getEbayAccessToken();
    const query = year ? `${year} ${make} ${model}` : `${make} ${model}`;

    // Confirmed live against the real API: a plain keyword search with
    // no category restriction pulls in die-cast models, keyrings, and
    // parts alongside real cars — for "BMW M2 Competition" that dragged
    // the average down to single/double-digit pounds. "9801" is eBay
    // GB's real "Cars" leaf category (confirmed via a live test call —
    // not guessed); this scopes results to actual vehicle listings.
    const res = await fetch(
      `${EBAY_SEARCH_URL}?${new URLSearchParams({
        q: query,
        category_ids: "9801",
        limit: "50",
      }).toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        },
      }
    );

    if (!res.ok) {
      console.error("eBay Browse API search failed:", res.status, await res.text());
      compsCache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const data = await res.json();
    const summaries: any[] = data.itemSummaries ?? [];

    // Dealer-only, non-damaged, and (when a year is known) the same
    // model year — a 2020 car isn't a fair comp against a 2016 one of
    // the same model, so this is a hard requirement, not a soft
    // preference like the mileage band below. A listing whose title
    // doesn't clearly state a year is excluded too, rather than
    // assumed to match, when a year was actually asked for.
    const comparable = summaries.filter((item) => {
      if (item?.seller?.sellerAccountType !== "BUSINESS") return false;
      if (isDamagedOrWriteOff(item?.title)) return false;
      if (typeof item?.price?.value === "undefined") return false;
      if (year != null) {
        const listedYear = extractYearFromTitle(item?.title);
        if (listedYear !== year) return false;
      }
      return true;
    });

    if (comparable.length === 0) {
      compsCache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    // Narrow further to listings whose own title states a mileage
    // within a reasonable band of the real vehicle's mileage — a
    // generous band (not an exact match) since sample sizes are small
    // and "roughly comparable" is the realistic bar here, not "exact".
    let pool = comparable;
    let mileageFiltered = false;
    if (mileage != null && mileage > 0) {
      const lowBound = mileage * 0.5;
      const highBound = mileage * 1.75 + 15000;
      const mileageMatched = comparable.filter((item) => {
        const m = extractMileageFromTitle(item?.title);
        return m != null && m >= lowBound && m <= highBound;
      });
      // Only trust the narrower pool if it actually left enough to
      // average sensibly — 3 real comps is a low but honest bar for a
      // niche make/model search, not the same "statistically solid"
      // bar a mainstream model with hundreds of listings could meet.
      if (mileageMatched.length >= 3) {
        pool = mileageMatched;
        mileageFiltered = true;
      }
    }

    const rawPrices = pool.map((item) => parseFloat(item.price.value)).filter((p) => !isNaN(p));
    const prices = filterOutliers(rawPrices);
    if (prices.length === 0) {
      compsCache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const result: EbayCarComps = {
      average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      lowest: Math.round(Math.min(...prices)),
      highest: Math.round(Math.max(...prices)),
      soldCount: prices.length,
      demandScore: Math.min(100, prices.length * 8),
      yearFiltered: year != null,
      mileageFiltered,
      sampleSize: comparable.length,
    };

    compsCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.error("fetchEbayCarComps failed:", err);
    return null;
  }
}
