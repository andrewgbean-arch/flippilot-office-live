import { useInventory } from "@/context/InventoryProvider";
import "@/staff/StaffDashboard.css";

export default function InventoryAnalytics() {
  const { vehicles } = useInventory();

  const total = vehicles.length;

  const motDueSoon = vehicles.filter(v => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  const reconNeeded = vehicles.filter(v => (v.predictedRepairs?.length ?? 0) > 0).length;

  const highConfidence = vehicles.filter(v => (v.valuationConfidence ?? 0) >= 70).length;
  const mediumConfidence = vehicles.filter(v => {
    const c = v.valuationConfidence ?? 0;
    return c >= 40 && c < 70;
  }).length;
  const lowConfidence = vehicles.filter(v => (v.valuationConfidence ?? 0) < 40).length;

  const avgRetailPrice = total > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + (v.priceRetail ?? 0), 0) / total)
    : 0;

  const avgMileage = total > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + (v.mileage ?? 0), 0) / total)
    : 0;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Inventory Analytics</h1>
          <p className="sn-hero__subtitle">
            Stock composition, condition, and pricing confidence.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Total Stock" value={total} accent="primary" />
        <MetricCard label="MOT Due Soon" value={motDueSoon} accent="blue" />
        <MetricCard label="Recon Needed" value={reconNeeded} accent="gold" />
        <MetricCard label="Avg Retail Price" value={avgRetailPrice} accent="success" prefix="£" />
        <MetricCard label="Avg Mileage" value={avgMileage} accent="purple" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Pricing Confidence Distribution</h2>
          {total === 0 ? (
            <p className="sn-empty">No vehicles in inventory yet.</p>
          ) : (
            <div className="sn-role-bars">
              <RoleBar label="High Confidence" count={highConfidence} total={total} />
              <RoleBar label="Medium Confidence" count={mediumConfidence} total={total} />
              <RoleBar label="Low Confidence" count={lowConfidence} total={total} />
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
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
  prefix?: string;
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{prefix}{value.toLocaleString()}</div>
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