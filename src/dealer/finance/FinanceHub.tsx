import { useNavigate } from "react-router-dom";
import "@/staff/StaffDashboard.css";

const TOOLS = [
  { label: "Finance Calculator", to: "/dealer/finance/calculator", desc: "Quick monthly payment estimates." },
  { label: "Deal Sheet", to: "/dealer/finance/deal-sheet", desc: "Build a full deal summary for a customer." },
  { label: "Lender Comparison", to: "/dealer/finance/lender-comparison", desc: "Compare rates across lenders." },
  { label: "Profit Breakdown", to: "/dealer/finance/profit-breakdown", desc: "See real margin after all costs." },
  { label: "Trade-In Valuation", to: "/dealer/finance/trade-in", desc: "Estimate a fair trade-in offer." },
  { label: "Contract Generator", to: "/dealer/finance/contract", desc: "Generate a printable sale contract." },
];

export default function FinanceHub() {
  const navigate = useNavigate();

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Finance Hub</h1>
          <p className="sn-hero__subtitle">
            Deal structuring and finance tools.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Tools</h2>
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
        </section>
      </main>

    </div>
  );
}