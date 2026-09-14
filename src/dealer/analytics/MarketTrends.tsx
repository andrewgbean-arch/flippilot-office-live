import { useInventory } from "@/context/InventoryProvider";
import { simulateMarketIntel } from "@/features/vehicles/market/simulatedMarketIntel";
import "@/staff/StaffDashboard.css";

export default function MarketTrends() {
  const { vehicles } = useInventory();

  const intels = vehicles.map(v =>
    simulateMarketIntel({
      id: v.id,
      buyPrice: v.priceTrade,
      sellPrice: null,
      valuation: v.priceRetail,
      mileage: v.mileage ?? undefined,
      flipScore: v.supernovaScore,
      timestamp: new Date().toISOString(),
      market: {},
      mot: { mileage: v.mileage ?? undefined },
    } as any)
  );

  const total = intels.length;

  const avgDemand = total > 0
    ? Math.round(intels.reduce((sum, i) => sum + i.demandIndex, 0) / total)
    : 0;

  const avgSellTime = total > 0
    ? Math.round(intels.reduce((sum, i) => sum + i.sellTimeDays, 0) / total)
    : 0;

  const avgSentiment = total > 0
    ? Math.round(intels.reduce((sum, i) => sum + i.sentimentScore, 0) / total)
    : 0;

  const pressureCounts = intels.reduce((acc, i) => {
    acc[i.pressureLevel] = (acc[i.pressureLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Market Trends</h1>
          <p className="sn-hero__subtitle">
            Aggregate market demand and sentiment across your stock.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Avg Demand Index" value={avgDemand} accent="gold" suffix="/100" />
        <MetricCard label="Avg Days to Sell" value={avgSellTime} accent="blue" />
        <MetricCard label="Avg Sentiment" value={avgSentiment} accent="success" suffix="/100" />
        <MetricCard label="Vehicles Tracked" value={total} accent="primary" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Pricing Pressure Across Stock</h2>
          {total === 0 ? (
            <p className="sn-empty">No vehicles in inventory yet.</p>
          ) : (
            <div className="sn-role-bars">
              <RoleBar label="Undervalued" count={pressureCounts.undervalued ?? 0} total={total} />
              <RoleBar label="Fair" count={pressureCounts.fair ?? 0} total={total} />
              <RoleBar label="Overpriced" count={pressureCounts.overpriced ?? 0} total={total} />
            </div>
          )}
        </section>
      </main>

    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
  suffix?: string;
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{value}{suffix}</div>
      <div className="sn-metric__label">{label}</div>
    </div>
  );
}

function RoleBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="sn-role">
      <span className="sn-role__label">{label}</span>
      <div className="sn-role__bar">
        <div className="sn-role__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sn-role__pct">{pct}%</span>
    </div>
  );
}