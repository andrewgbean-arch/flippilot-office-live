import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

export interface GoogleCarPriceGuide {
  average: number;
  lowest: number;
  highest: number;
  sourceCount: number;
  sources: string[];
}

export interface GooglePriceGuideResponse {
  available: boolean;
  guide?: GoogleCarPriceGuide;
}

// Deliberately called on demand only (a button click), never
// automatically — see backend/src/googleCarMarket.ts for why: the
// SerpAPI key behind this is shared with the sibling flippilotlatest
// project's own price lookups, and its free tier is only 100
// searches/month total for both apps.
export async function fetchGooglePriceGuide(
  make: string,
  model: string,
  year: number | null,
  mileage: number | null
): Promise<GooglePriceGuideResponse> {
  try {
    const params = new URLSearchParams({ make, model });
    if (year != null) params.set("year", String(year));
    if (mileage != null) params.set("mileage", String(mileage));

    const res = await fetch(`${BASE_URL}/market/google-price-guide?${params.toString()}`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!data.ok) return { available: false };
    return { available: Boolean(data.available), guide: data.guide };
  } catch (err) {
    console.error("fetchGooglePriceGuide: backend unreachable", err);
    return { available: false };
  }
}
