import { demandLevel, trendDirection } from "../../engines/MarketIntel";
import { priceMovement } from "../../engines/PricingEngine";

export default function AnalyticsHub() {

  // Engine-powered values
  const demand = demandLevel({ buyers: 120, sellers: 80 });
  const trend = trendDirection([9800, 10000, 10250]);
  const movement = priceMovement([9800, 10000, 10250]).toFixed(1);

  return (
    <div className="animate-fadeIn">

      {/* Title */}
      <h1 className="text-3xl font-bold text-gold mb-4 drop-shadow-goldGlow">
        Dealer Analytics Hub
      </h1>
      <p className="text-white/60 mb-6">
        Market trends, pricing intelligence, and performance insights powered by FlipPilot Supernova V2.
      </p>

      {/* Badge */}
      <span className="inline-block px-4 py-2 bg-black/40 border border-gold rounded-lg text-gold text-sm mb-10">
        Analytics Engine • Supernova V2
      </span>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        {/* Market Trend */}
        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Market Trend</h2>
          <p className="text-white text-4xl font-bold">{trend}</p>
          <p className="text-white/60 mt-1">Demand: {demand}</p>
        </div>

        {/* Avg. Price Movement */}
        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Avg. Price Movement</h2>
          <p className="text-white text-4xl font-bold">{movement}%</p>
          <p className="text-white/60 mt-1">Last 14 days</p>
        </div>

        {/* Stock Performance */}
        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Stock Performance</h2>
          <p className="text-white text-4xl font-bold">Strong</p>
          <p className="text-white/60 mt-1">Healthy turnover</p>
        </div>
      </div>

      {/* Deep Analytics */}
      <div className="bg-black/40 border border-gold rounded-xl p-6 shadow-blueGlow backdrop-blur-xl mb-10">
        <h2 className="text-xl font-semibold text-gold mb-4">Deep Analytics</h2>
        <p className="text-white/70 leading-relaxed">
          FlipPilot Analytics processes market signals, auction data, regional pricing trends,
          and historical performance to generate actionable insights.  
          Soon, this module will include live charts, predictive graphs, and automated dealer recommendations.
        </p>
      </div>

      {/* Upcoming Features */}
      <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow">
        <h2 className="text-xl font-semibold text-gold mb-4">Upcoming Analytics Features</h2>
        <ul className="space-y-3 text-white/70">
          <li>• Live pricing charts</li>
          <li>• Market heatmaps</li>
          <li>• Dealer performance scoring</li>
          <li>• Predictive trend forecasting</li>
          <li>• Automated buying strategy insights</li>
        </ul>
      </div>

    </div>
  );
}

