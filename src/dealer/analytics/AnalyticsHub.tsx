import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";
import { askingPriceSummary, averageDaysInStock, unsold } from "@/dealer/inventory/stockFacts";
import "@/staff/StaffDashboard.css";

// Every card here describes what its page really shows. The hub used to
// advertise "AI-recommended pricing" and "aggregate demand and sentiment"; those
// two pages (Pricing Analytics and Market Trends) are gone because everything on
// them was worked out from the dealer's own asking prices, not from the market.
const TOOLS = [
  { label: "Sales Analytics", to: "/dealer/analytics/sales", desc: "Your leads by status and source." },
  { label: "Inventory Analytics", to: "/dealer/analytics/inventory", desc: "Stock on hand: MOT dates, prices, mileage and how long cars have been here." },
  { label: "Lead Conversion", to: "/dealer/analytics/lead-conversion", desc: "Which lead sources your won leads came from." },
  { label: "Staff Analytics", to: "/dealer/analytics/staff", desc: "Your team by role and branch." },
  { label: "Staff by Branch", to: "/dealer/analytics/branches", desc: "How many staff work at each branch." },
];

export default function AnalyticsHub() {
  const { vehicles } = useInventory();
  const navigate = useNavigate();

  // The hub used to open with a "Market Demand" tile (always "Balanced": it read
  // a demand score nothing ever set) and a "Stock Performance" tile (the share
  // of cars with a high "valuation confidence", which fell as a dealer's margin
  // rose). Both are gone. These three are counted from the dealer's own cars,
  // sold ones left out.
  const now = new Date();
  const onHand = unsold(vehicles);
  const prices = askingPriceSummary(vehicles);
  const days = averageDaysInStock(vehicles, now);

  return (
    <div className="animate-fadeIn">

      <h1 className="text-3xl font-bold text-gold mb-4 drop-shadow-goldGlow">
        Dealer Analytics Hub
      </h1>
      <p className="text-white/60 mb-10">
        Figures worked out from your own stock, leads and staff records.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Cars in Stock</h2>
          <p className="text-white text-4xl font-bold">{onHand.length}</p>
          <p className="text-white/60 mt-1">
            {vehicles.length - onHand.length > 0
              ? `${vehicles.length - onHand.length} sold, not counted`
              : "Everything not yet sold"}
          </p>
        </div>

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Average Price</h2>
          <p className="text-white text-4xl font-bold">
            {prices ? `£${prices.average.toLocaleString()}` : "–"}
          </p>
          <p className="text-white/60 mt-1">
            {prices
              ? `Asking prices, £${prices.lowest.toLocaleString()} – £${prices.highest.toLocaleString()} across ${prices.count} priced car${prices.count === 1 ? "" : "s"}`
              : "No priced stock yet"}
          </p>
        </div>

        <div className="bg-flipDark border border-gold rounded-xl p-6 shadow-blueGlow hover:shadow-goldGlow transition">
          <h2 className="text-xl font-semibold text-gold mb-2">Average Days in Stock</h2>
          <p className="text-white text-4xl font-bold">{days ? days.average : "–"}</p>
          <p className="text-white/60 mt-1">
            {days
              ? `Since each car was added, across ${days.count} car${days.count === 1 ? "" : "s"}`
              : "No stock with a date added yet"}
          </p>
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
