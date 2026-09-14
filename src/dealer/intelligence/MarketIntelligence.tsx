import { useInventory } from "@/context/InventoryProvider";
import { simulateMarketIntel } from "@/features/vehicles/market/simulatedMarketIntel";
import "@/staff/StaffDashboard.css";

export default function MarketIntelligence() {
  const { vehicles } = useInventory();

  const pressureColor: Record<string, string> = {
    undervalued: "#00dc8c",
    overpriced: "#ff6b6b",
    fair: "#a9b4ff",
  };

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Market Intelligence</h1>
          <p className="sn-hero__subtitle">
            Per-vehicle market position, pricing pressure, and demand signals.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Inventory Market Position</h2>

          {vehicles.length === 0 ? (
            <p className="sn-empty">No vehicles in inventory yet.</p>
          ) : (
            <div className="sn-staff-grid">
              {vehicles.map(v => {
                const intel = simulateMarketIntel({
                  id: v.id,
                  buyPrice: v.priceTrade,
                  sellPrice: null,
                  valuation: v.priceRetail,
                  mileage: v.mileage ?? undefined,
                  flipScore: v.supernovaScore,
                  timestamp: new Date().toISOString(),
                  market: {},
                  mot: { mileage: v.mileage ?? undefined },
                } as any);

                return (
                  <div key={v.id} className="sn-staff-card">
                    <div className="sn-staff-card__header">
                      <span className="sn-staff-card__name">
                        {v.make} {v.model}
                      </span>
                      <span
                        className="sn-staff-card__role"
                        style={{ color: pressureColor[intel.pressureLevel] }}
                      >
                        {intel.pressureLevel}
                      </span>
                    </div>

                    <div className="sn-staff-card__branch">
                      Market Avg: £{intel.marketAvg.toLocaleString()}
                    </div>
                    <div className="sn-staff-card__branch">
                      Demand Index: {intel.demandIndex}/100
                    </div>
                    <div className="sn-staff-card__branch">
                      Est. Days to Sell: {intel.sellTimeDays}
                    </div>
                    <div className="sn-staff-card__branch">
                      Competitors: {intel.competitorCount}
                    </div>
                    <div className="sn-staff-card__branch">
                      Dealer Rank: Top {intel.dealerRankPercent}%
                    </div>
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