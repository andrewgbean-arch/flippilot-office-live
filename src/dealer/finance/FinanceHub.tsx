import { useNavigate } from "react-router-dom";
import "@/staff/StaffDashboard.css";

const TOOLS = [
  { label: "Finance Calculator", to: "/dealer/finance/calculator", desc: "Illustrative monthly payments from an APR you enter." },
  { label: "Deal Sheet", to: "/dealer/finance/deal-sheet", desc: "Build an illustrative deal summary for a customer." },
  { label: "Lender Comparison", to: "/dealer/finance/lender-comparison", desc: "Compare payments for the lenders and rates you type in." },
  { label: "Profit Breakdown", to: "/dealer/finance/profit-breakdown", desc: "Profit on a vehicle after costs and VAT." },
  { label: "Trade-In Valuation", to: "/dealer/finance/trade-in", desc: "A rule-of-thumb starting point for a trade-in offer." },
  { label: "Contract Generator", to: "/dealer/finance/contract", desc: "A sale agreement template to fill in and print. Check it before use." },
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
            Deal structuring and finance tools. The finance figures are illustrative only: not a finance
            quote or a credit offer.
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