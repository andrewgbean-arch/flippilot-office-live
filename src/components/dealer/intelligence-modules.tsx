import React from "react";

/* -------------------------------------------------------
   ⭐ Market Heat Engine
------------------------------------------------------- */
export function MarketHeatEngine({ vehicles }: { vehicles: any[] }) {
  const total = vehicles.length;
  const hot = vehicles.filter(v => (v.flipScore ?? 0) >= 80).length;
  const cold = vehicles.filter(v => (v.flipScore ?? 0) < 50).length;

  if (total === 0)
    return <span className="p-2">No flips yet. Market heat unavailable.</span>;

  return (
    <>
      <span className="p-2">Hot flips (score ≥ 80): {hot}</span>
      <span className="p-2">Cold flips (score {"<"} 50): {cold}</span>
      <span className="p-2">
        More hot than cold = strong market. More cold than hot = tighten your buying criteria.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Risk Radar
------------------------------------------------------- */
export function RiskRadar({ vehicles }: { vehicles: any[] }) {
  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  const highMileage = vehicles.filter(v => (v.mileage ?? 0) >= 120000).length;

  return (
    <>
      <span className="p-2">MOT risk vehicles (≤ 30 days): {motRisk}</span>
      <span className="p-2">High mileage stock (≥ 120k): {highMileage}</span>
      <span className="p-2">
        Focus on MOT‑risk and high‑mileage units first when planning stock rotation.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Profit Consistency
------------------------------------------------------- */
export function ProfitConsistency({ vehicles }: { vehicles: any[] }) {
  if (vehicles.length === 0)
    return <span className="p-2">No flips yet. Consistency score unavailable.</span>;

  const monthly: Record<string, number> = {};

  vehicles.forEach(v => {
    const month = new Date(v.timestamp).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
    });
    const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    monthly[month] = (monthly[month] ?? 0) + profit;
  });

  const profits = Object.values(monthly);
  if (profits.length === 0)
    return <span className="p-2">No monthly profit data.</span>;

  const avg = profits.reduce((s, p) => s + p, 0) / profits.length;
  const variance = profits.reduce((s, p) => s + (p - avg) ** 2, 0) / profits.length;
  const stdDev = Math.sqrt(variance);

  const consistency =
    avg === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(avg, 1)) * 100)));

  return (
    <>
      <span className="p-2">Profit consistency score: {consistency}/100</span>
      <span className="p-2">
        Higher score = more predictable profit month‑to‑month.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ MOT Health Index
------------------------------------------------------- */
export function MotHealthIndex({ vehicles }: { vehicles: any[] }) {
  const withMot = vehicles.filter(v => v.mot).length;

  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  if (withMot === 0)
    return <span className="p-2">No MOT data available.</span>;

  const healthy = withMot - motRisk;
  const index = Math.round((healthy / withMot) * 100);

  return (
    <>
      <span className="p-2">MOT health index: {index}/100</span>
      <span className="p-2">Vehicles with MOT data: {withMot}</span>
      <span className="p-2">MOT‑risk vehicles (≤ 30 days): {motRisk}</span>
      <span className="p-2">
        Aim to keep MOT health above 80 for a strong, low‑risk stock profile.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Flip Time Analyzer
------------------------------------------------------- */
export function FlipTimeAnalyzer({ vehicles }: { vehicles: any[] }) {
  const completed = vehicles.filter(v => v.sellDate);

  if (completed.length === 0)
    return <span className="p-2">No completed flips yet.</span>;

  const daysList = completed.map(v => {
    const buy = v.buyDate ? new Date(v.buyDate) : new Date(v.timestamp);
    const sell = new Date(v.sellDate ?? v.timestamp ?? Date.now());
    return Math.max(1, Math.ceil((sell.getTime() - buy.getTime()) / 86400000));
  });

  const avgDays = daysList.reduce((s, d) => s + d, 0) / daysList.length;

  return (
    <>
      <span className="p-2">Average flip time: {Math.round(avgDays)} days</span>
      <span className="p-2">
        Shorter flip times = faster cashflow and lower holding risk.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Price Efficiency
------------------------------------------------------- */
export function PriceEfficiency({ vehicles }: { vehicles: any[] }) {
  const withValuation = vehicles.filter(v => v.valuation && v.buyPrice);

  if (withValuation.length === 0)
    return <span className="p-2">No valuation data available.</span>;

  const diffs = withValuation.map(v => {
    const valuation = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return valuation === 0 ? 0 : (valuation - buy) / valuation;
  });

  const avgEff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const score = Math.max(0, Math.min(100, Math.round(avgEff * 100)));

  return (
    <>
      <span className="p-2">Price efficiency score: {score}/100</span>
      <span className="p-2">
        Higher score = buying well below valuation on average.
      </span>
    </>
  );
}

/* -------------------------------------------------------
   ⭐ Smart Alerts
------------------------------------------------------- */
export function SmartAlerts({ vehicles }: { vehicles: any[] }) {
  const motRisk = vehicles.filter(v => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 14;
  });

  const undervalued = vehicles.filter(v => {
    const valuation = v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return valuation - buy >= 1500;
  });

  const fastFlips = vehicles.filter(v => {
    if (!v.sellDate) return false;
    const buy = v.buyDate ? new Date(v.buyDate) : new Date(v.timestamp);
    const sell = new Date(v.sellDate);
    const days = Math.max(1, Math.ceil((sell.getTime() - buy.getTime()) / 86400000));
    return days <= 14;
  });

  if (motRisk.length === 0 && undervalued.length === 0 && fastFlips.length === 0)
    return <span className="p-2">No active alerts.</span>;

  return (
    <div className="p-2">
      {motRisk.length > 0 && (
        <span className="p-2">
          • {motRisk.length} vehicles with MOT expiring within 14 days.
        </span>
      )}
      {undervalued.length > 0 && (
        <span className="p-2">
          • {undervalued.length} undervalued vehicles (≥ £1500 below valuation).
        </span>
      )}
      {fastFlips.length > 0 && (
        <span className="p-2">
          • {fastFlips.length} fast‑moving flips (sold within 14 days).
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   ⭐ Business Score
------------------------------------------------------- */
export function BusinessScore({ vehicles }: { vehicles: any[] }) {
  if (vehicles.length === 0)
    return <span className="p-2">No data yet. Business score unavailable.</span>;

  const totalProfit = vehicles.reduce(
    (s, v) => s + ((v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0)),
    0
  );

  const completed = vehicles.filter(v => v.sellDate).length;

  const avgScore =
    vehicles.length === 0
      ? 0
      : vehicles.reduce((s, v) => s + (v.flipScore ?? 0), 0) / vehicles.length;

  const profitScore = totalProfit <= 0 ? 0 : Math.min(100, Math.round(totalProfit / 1000));
  const volumeScore = Math.min(100, completed * 5);
  const qualityScore = Math.min(100, Math.round(avgScore));

  const overall = Math.round(
    profitScore * 0.4 + volumeScore * 0.3 + qualityScore * 0.3
  );

  return (
    <>
      <span className="p-2">FlipPilot Business Score: {overall}/100</span>
      <span className="p-2">Profit score: {profitScore}/100</span>
      <span className="p-2">Volume score: {volumeScore}/100</span>
      <span className="p-2">Quality score: {qualityScore}/100</span>
      <span className="p-2">
        Use this as your dealership performance pulse over time.
      </span>
    </>
  );
}
