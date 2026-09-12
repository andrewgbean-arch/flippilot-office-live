import { div, span } from "react";
export default function DealProbabilityAI({ listing, prediction }: any) {
  const { price, score, vehicle, seller } = listing;
  let probability = 40; // base chance
  if (price < prediction.profitEstimate * 1.2) probability += 10;
  if (price < prediction.profitEstimate) probability += 15;
  if (prediction.flipScore >= 80) probability += 15;
  else if (prediction.flipScore >= 70) probability += 10;
  if (seller?.rating >= 4.8) probability += 10;
  else if (seller?.rating >= 4.5) probability += 5;
  if (listing.photos?.length >= 5) probability += 10;
  if (listing.description?.length > 150) probability += 5;
  if (score >= 85 && price <= 5000) probability += 15;
  const popularModels = ["fiesta", "focus", "corsa", "golf", "a3", "astra"];
  const model = vehicle.model?.toLowerCase() || "";
  if (popularModels.some((m) => model.includes(m))) probability += 10;
  const age = new Date().getFullYear() - (vehicle.year || 2010);
  const mileage = listing.mileage || 0;
  if (age < 10 && mileage < 100000) probability += 10;
  probability = Math.min(100, Math.max(0, probability));
  const getColor = () => {
    if (probability >= 80) return "#4CAF50";
    if (probability >= 60) return "#FFD700";
    return "#FF5252";
  };
  const getLabel = () => {
    if (probability >= 80) return "Very High Chance";
    if (probability >= 60) return "High Chance";
    if (probability >= 40) return "Moderate Chance";
    return "Low Chance";
  };
  return (
    <div
      className="p-2"
    >
      <span className="p-2">
        Deal Probability (7‑Day Forecast)
      </span>
      <span className="p-2">
        {getLabel()} ({probability}%)
      </span>
      <span className="p-2">
        Based on price, FlipScore, seller rating, listing quality, and market demand.
      </span>
    </div>
  );
}
