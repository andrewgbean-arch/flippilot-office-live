import { useInventory } from "@/context/InventoryProvider";
import {
  askingPriceSummary,
  averageMileage,
  motCounts,
  stockAgeBands,
  unsold,
  withMotAdvisories,
} from "@/dealer/inventory/stockFacts";
import "@/staff/StaffDashboard.css";

// Everything here is counted from the dealer's own cars that are still unsold
// (see stockFacts.ts). This page used to count sold cars as stock, average the
// asking price over every car with unpriced ones as £0, treat an unknown
// mileage as 0, fold expired MOTs into "due soon", and add a "Recon Needed"
// count and a "Pricing Confidence Distribution" built from scores that were the
// same guess for every dealer. Those are gone.
export default function InventoryAnalytics() {
  const { vehicles } = useInventory();

  const now = new Date();
  const onHand = unsold(vehicles);
  const total = onHand.length;

  const mot = motCounts(vehicles, now);
  const advisories = withMotAdvisories(vehicles).length;
  const prices = askingPriceSummary(vehicles);
  const mileage = averageMileage(vehicles);
  const ages = stockAgeBands(vehicles, now);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Inventory Analytics</h1>
          <p className="sn-hero__subtitle">
            Cars you still have to sell: MOT dates, prices, mileage and how long they have been here.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Cars in Stock" value={total} accent="primary" />
        <MetricCard label="MOT Expired" value={mot.expired} accent="gold" />
        <MetricCard label="MOT Due in 30 Days" value={mot.dueSoon} accent="blue" />
        <MetricCard label="With MOT Advisories" value={advisories} accent="purple" />
        <MetricCard
          label={prices ? `Avg Asking Price (${prices.count} priced)` : "Avg Asking Price"}
          value={prices ? prices.average : null}
          accent="success"
          prefix="£"
        />
        <MetricCard
          label={mileage ? `Avg Mileage (${mileage.count} with mileage)` : "Avg Mileage"}
          value={mileage ? mileage.average : null}
          accent="purple"
        />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Days in Stock</h2>
          {total === 0 ? (
            <p className="sn-empty">No vehicles in stock yet.</p>
          ) : (
            <div className="sn-role-bars">
              <RoleBar label="Under 30 days" count={ages.under30} total={total} />
              <RoleBar label="30 to 59 days" count={ages.from30to59} total={total} />
              <RoleBar label="60 to 89 days" count={ages.from60to89} total={total} />
              <RoleBar label="90 days or more" count={ages.from90} total={total} />
              {ages.unknown > 0 && (
                <RoleBar label="Date added not recorded" count={ages.unknown} total={total} />
              )}
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
  value: number | null;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
  prefix?: string;
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      {/* No figure at all reads as a dash, never as a 0 that could pass for a real average */}
      <div className="sn-metric__value">{value === null ? "–" : `${prefix ?? ""}${value.toLocaleString()}`}</div>
      <div className="sn-metric__label">{label}</div>
    </div>
  );
}

function RoleBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    // Wider columns than the shared bars: the labels are longer and the figure
    // is "count (percent)".
    <div className="sn-role" style={{ gridTemplateColumns: "170px minmax(0, 1fr) 90px" }}>
      <span className="sn-role__label">{label}</span>
      <div className="sn-role__bar">
        <div className="sn-role__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sn-role__pct">
        {count} ({pct}%)
      </span>
    </div>
  );
}
