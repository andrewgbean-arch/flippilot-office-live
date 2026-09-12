import { div, span } from "react";
export default function SellerBadges({ seller }: any) {
  if (!seller) return null;
  const badges: string[] = [];
  if (seller.verified) badges.push("✔ Verified");
  if (seller.rating >= 4.8) badges.push("⭐ Top Rated");
  else if (seller.rating >= 4.5) badges.push("⭐ High Rated");
  if (seller.totalSales >= 20) badges.push("🏆 Platinum Seller");
  else if (seller.totalSales >= 10) badges.push("🥇 Gold Seller");
  else if (seller.totalSales >= 5) badges.push("🥈 Silver Seller");
  else if (seller.totalSales >= 1) badges.push("🥉 Bronze Seller");
  if (seller.responseTime?.includes("hour")) badges.push("⚡ Fast Responder");
  return (
    <div
      className="p-2"
    >
      {badges.map((badge, i) => (
        <div
          key={i}
          className="p-2"
        >
          <span className="p-2">{badge}</span>
        </div>
      ))}
    </div>
  );
}
