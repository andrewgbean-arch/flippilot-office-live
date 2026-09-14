import { useInventory } from "@/context/InventoryProvider";
import { computeAiPrice } from "@/engines/computeAiPrice";
import "@/staff/StaffDashboard.css";

export default function PricingBrain() {
  const { vehicles } = useInventory();

  const riskColor: Record<string, string> = {
    low: "#00dc8c",
    medium: "#ffd700",
    high: "#ff6b6b",
  };

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pricing Brain</h1>
          <p className="sn-hero__subtitle">
            AI-recommended pricing for every vehicle in stock.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Recommended Pricing</h2>

          {vehicles.length === 0 ? (
            <p className="sn-empty">No vehicles in inventory yet.</p>
          ) : (
            <div className="sn-staff-grid">
              {vehicles.map(v => {
                const result = computeAiPrice(v as any);

                return (
                  <div key={v.id} className="sn-staff-card">
                    <div className="sn-staff-card__header">
                      <span className="sn-staff-card__name">
                        {v.make} {v.model}
                      </span>
                      <span
                        className="sn-staff-card__role"
                        style={{ color: riskColor[result.riskLevel] }}
                      >
                        {result.riskLevel} risk
                      </span>
                    </div>

                    <div className="sn-lender-payment" style={{ fontSize: 20, marginTop: 6 }}>
                      £{result.recommendedSellPrice.toLocaleString()}
                    </div>

                    <div className="sn-staff-card__branch" style={{ marginTop: 6 }}>
                      Confidence: {result.confidence}%
                    </div>

                    {result.notes && (
                      <div className="sn-staff-card__branch" style={{ marginTop: 4, fontStyle: "italic" }}>
                        {result.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

    </div>
  );
}
