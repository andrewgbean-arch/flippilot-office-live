import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";
import { demandLevel } from "../../engines/MarketIntel";
import "@/staff/StaffDashboard.css";

const TOOLS = [
  { label: "Sales Analytics", to: "/dealer/analytics/sales", desc: "Lead pipeline performance and conversion." },
  { label: "Inventory Analytics", to: "/dealer/analytics/inventory", desc: "Stock composition and pricing confidence." },
  { label: "Pricing Analytics", to: "/dealer/analytics/pricing", desc: "AI-recommended pricing across your stock." },
  { label: "Market Trends", to: "/dealer/analytics/market-trends", desc: "Aggregate demand and sentiment." },
  { label: "Lead Conversion", to: "/dealer/analytics/lead-conversion", desc: "Which sources convert best." },
  { label: "Staff Analytics", to: "/dealer/analytics/staff", desc: "Team composition and tenure." },
  { label: "Branch Comparison", to: "/dealer/analytics/branches", desc: "Compare performance across branches." },
];

export default function AnalyticsHub() {
  const { vehicles } = useInventory();
  const navigate = useNavigate();

  const avgDemandScore =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + (v.market?.demandScore ?? 50), 0) / vehicles.length
      : 50;

  const demand = demandLevel({ buyers: Math.round(avgDemandScore), sellers: 100 - Math.round(avgDemandScore) });

  // priceMovement/trendDirection compare the first and last item of an
  // array — meaningful for one vehicle's price over time, meaningless
  // for a cross-section of different vehicles' current prices (which
  // is all this app tracks; there's no per-vehicle price history yet).
  // Real, honest cross-sectional stats instead: average price and the
  // spread between cheapest and priciest in stock right now.
  const priceSeries = vehicles
    .map(v => v.priceRetail)
    .filter((p): p is number => typeof p === "number" && p > 0);

  const avgPrice = priceSeries.length > 0 ? Math.round(priceSeries.reduce((a, b) => a + b, 0) / priceSeries.length) : 0;
  const minPrice = priceSeries.length > 0 ? Math.min(...priceSeries) : 0;
  const maxPrice = priceSeries.length > 0 ? Math.max(...priceSeries) : 0;

  const highConfidenceCount = vehicles.filter(v => (v.valuationConfidence ?? 0) >= 70).length;
  const stockPerformancePct = vehicles.length > 0
    ? Math.round((highConfidenceCount / vehicles.length) * 100)
    : 0;

  const stockPerformanceLabel =
    stockPerformancePct >= 70 ? "Strong" : stockPerformancePct >= 40 ? "Moderate" : "Weak";

  return (
    <div className="animate-fadeIn">

      <h1 className="text-3xl font-bold text-gold mb-4 drop-shadow-goldGlow">
        Dealer Analytics Hub
      </h1>
      <p className="text-white/60 mb-10">
        Market trends, pricing intelligence, and performance insights.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Market Demand</h2>
          <p className="text-white text-4xl font-bold">{demand}</p>
          <p className="text-white/60 mt-1">Based on your stock's demand scoring</p>
        </div>

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Average Price</h2>
          <p className="text-white text-4xl font-bold">£{avgPrice.toLocaleString()}</p>
          <p className="text-white/60 mt-1">
            {priceSeries.length > 0 ? `£${minPrice.toLocaleString()} – £${maxPrice.toLocaleString()} range` : "No priced stock yet"}
          </p>
        </div>

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Stock Performance</h2>
          <p className="text-white text-4xl font-bold">{stockPerformanceLabel}</p>
          <p className="text-white/60 mt-1">{stockPerformancePct}% high-confidence pricing</p>
        </div>
      </div>

      <div className="sn-panel sn-panel--full" style={{ marginTop: 20 }}>
        <h2 className="sn-panel__title">Analytics Tools</h2>
        <div className="sn-staff-grid">
          {TOOLS.map(tool => (
            <div
              key={tool.to}
              className="sn-staff-card"
              onClick={() => navigate(tool.to)}
              style={{ cursor: "pointer" }}
            >
              <div className="sn-staff-card__header">
                <span className="sn-staff-card__name">{tool.label}</span>
              </div>
              <div className="sn-staff-card__branch">{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}