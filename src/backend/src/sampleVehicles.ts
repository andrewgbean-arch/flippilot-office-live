// The web app used to seed 8 demo cars into every new dealership's REAL
// stock the first time it loaded (ids ULTRA-001..005 and DM-001..003).
// Vehicles a dealer really adds get random UUIDs, so ids of this shape
// can only ever be that demo data.
//
// They were "In Stock", so the anonymous public store page and the
// public stock feed published them as the dealer's own cars — fake
// listings, with prices, under a real dealership's name. New accounts no
// longer get them, but every account created before that fix still
// holds them, so the public routes must never publish them. Safe to
// delete once no dealership's stock contains them any more.
export function isSampleVehicleId(id: unknown): boolean {
  return typeof id === "string" && /^(ULTRA|DM)-\d{3}$/.test(id);
}
