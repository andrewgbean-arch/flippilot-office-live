import { useInventory } from "@/context/InventoryProvider";
import { computeAiPrice } from "@/engines/computeAiPrice";
import "@/staff/StaffDashboard.css";

export default function PricingAnalytics() {
  const { vehicles } = useInventory();

  const results = vehicles.map(v => ({
    vehicle: v,
    result: computeAiPrice(v as any),
  }));

  const total = results.length;

  const avgConfidence = total > 0
    ? Math.round(results.reduce((sum, r) => sum + r.result.confidence, 0) / total)
    : 0;

  const avgRecommended = total > 0
    ? Math.round(results.reduce((sum, r) => sum + r.result.recommendedSellPrice, 0) / total)
    : 0;

  const avgCurrent = total > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + (v.priceRetail ?? 0), 0) / total)
    : 0;

  const riskCounts = results.reduce((acc, r) => {
    acc[r.result.riskLevel] = (acc[r.result.riskLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priceGap = avgRecommended - avgCurrent;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pricing Analytics</h1>
          <p className="sn-hero__subtitle">
            AI-recommended pricing performance across your stock.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Avg Current Price" value={avgCurrent} accent="primary" prefix="£" />
        <MetricCard label="Avg AI Recommended" value={avgRecommended} accent="gold" prefix="£" />
        <MetricCard label="Avg Confidence" value={avgConfidence} accent="blue" suffix="%" />
        <MetricCard
          label="Pricing Gap"
          value={Math.abs(priceGap)}
          accent={priceGap >= 0 ? "success" : "purple"}
          prefix={priceGap >= 0 ? "+£" : "-£"}
        />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Pricing Risk Distribution</h2>
          {total === 0 ? (
            <p className="sn-empty">No vehicles in inventory yet.</p>
          ) : (
            <div className="sn-role-bars">
              <RoleBar label="Low Risk" count={riskCounts.low ?? 0} total={total} />
              <RoleBar label="Medium Risk" count={riskCounts.medium ?? 0} total={total} />
              <RoleBar label="High Risk" count={riskCounts.high ?? 0} total={total} />
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
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{prefix}{value.toLocaleString()}{suffix}</div>
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