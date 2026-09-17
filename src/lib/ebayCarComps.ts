import { authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

export interface EbayCarComps {
  average: number;
  lowest: number;
  highest: number;
  soldCount: number;
  demandScore: number;
  yearFiltered: boolean;
  mileageFiltered: boolean;
  sampleSize: number;
}

export interface EbayCompsResponse {
  available: boolean;
  comps?: EbayCarComps;
}

// Real, dealer-only, same-year, mileage-comparable eBay listings for a
// vehicle — see backend/src/ebayCarMarket.ts for the actual filtering.
// Returns { available: false } (not an error) whenever there's simply
// no usable real data — no eBay keys configured, or genuinely no
// comparable dealer listings found — so a caller can fall back to the
// existing simulated estimate rather than treating it as a failure.
export async function fetchEbayCarComps(
  make: string,
  model: string,
  year: number | null,
  mileage: number | null
): Promise<EbayCompsResponse> {
  try {
    const params = new URLSearchParams({ make, model });
    if (year != null) params.set("year", String(year));
    if (mileage != null) params.set("mileage", String(mileage));

    const res = await fetch(`${BASE_URL}/market/ebay-comps?${params.toString()}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!data.ok) return { available: false };
    return { available: Boolean(data.available), comps: data.comps };
  } catch (err) {
    console.error("fetchEbayCarComps: backend unreachable", err);
    return { available: false };
  }
}
