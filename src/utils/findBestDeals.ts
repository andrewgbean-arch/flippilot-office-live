export function findBestDeals(listings: any[]) {
  return listings
    .map((listing) => {
      const price = listing.price ?? 0;
      const score = listing.score ?? 0;
      const dealStrength =
        score * 1.5 -
        price / 120 +
        (listing.vehicle?.mileage < 80000 ? 10 : 0);
      return {
        ...listing,
        dealStrength,
      };
    })
    .sort((a, b) => b.dealStrength - a.dealStrength)
    .slice(0, 5); // Top 5 deals
}
