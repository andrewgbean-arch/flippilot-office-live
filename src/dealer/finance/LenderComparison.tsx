import { useState } from "react";
import "@/staff/StaffDashboard.css";
import { FINANCE_DISCLAIMER, FINANCE_METHOD_NOTE, compareLenders, type LenderRowInput } from "./financeMath";
import { formatMoney } from "./money";

// Starts empty. It used to ship three invented lenders (A at 9.9%, B at 12.5%,
// C at 7.4%) with a "Best Rate" badge before anything had been typed, which
// reads as real lender rates. Only lenders and rates the dealer enters are
// compared, and a "lowest payment" mark only appears once there are at least
// two usable, different rates.
export default function LenderComparison({
  initialLenders = [],
  initialAmount = "",
}: {
  // Only for tests, to render a comparison that already has lenders in it.
  initialLenders?: LenderRowInput[];
  initialAmount?: string;
} = {}) {
  const [amount, setAmount] = useState(initialAmount);
  const [term, setTerm] = useState("36");
  const [lenders, setLenders] = useState<LenderRowInput[]>(initialLenders);

  function addLender() {
    setLenders(prev => [...prev, { id: crypto.randomUUID(), name: "", apr: "" }]);
  }

  function removeLender(id: string) {
    setLenders(prev => prev.filter(l => l.id !== id));
  }

  function updateLender(id: string, field: "name" | "apr", value: string) {
    setLenders(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  }

  const rows = compareLenders(amount, term, lenders);

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Lender Comparison</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Compare monthly payments for the lenders and rates you enter. Nothing is pre-filled.{" "}
        {FINANCE_DISCLAIMER}
      </p>

      <div className="sn-form">
        <label>Loan Amount (£)</label>
        <input
          type="number"
          min={0}
          className="sn-input"
          value={amount}
          placeholder="0.00"
          onChange={e => setAmount(e.target.value)}
        />

        <label>Term (months)</label>
        <input
          type="number"
          min={1}
          step={1}
          className="sn-input"
          value={term}
          onChange={e => setTerm(e.target.value)}
        />
      </div>

      {rows.length === 0 && (
        <p className="sn-empty" style={{ marginTop: 16 }}>
          No lenders added yet. Add each lender you have a quote from and type in the APR they gave you.
        </p>
      )}

      <div className="sn-lender-grid">
        {rows.map(row => {
          const input = lenders.find(l => l.id === row.id) as LenderRowInput;
          return (
            <div key={row.id} className={`sn-lender-card ${row.isLowest ? "sn-lender-card--best" : ""}`}>
              <input
                className="sn-lender-name"
                value={input.name}
                placeholder="Lender name"
                onChange={e => updateLender(row.id, "name", e.target.value)}
              />
              <div className="sn-lender-apr-row">
                <span>APR</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="sn-lender-apr-input"
                  value={input.apr}
                  placeholder="quoted"
                  onChange={e => updateLender(row.id, "apr", e.target.value)}
                />
                <span>%</span>
              </div>
              {row.loan.status === "ok" ? (
                <>
                  <div className="sn-lender-payment">
                    {formatMoney(row.loan.monthlyPayment as number)}
                    <span className="sn-lender-payment__label">/month</span>
                  </div>
                  <div className="sn-form-note">
                    Total repayable {formatMoney(row.loan.totalRepayable as number)}
                  </div>
                </>
              ) : (
                <div className="sn-form-note">{row.loan.message}</div>
              )}
              {row.isLowest && <div className="sn-lender-badge">Lowest monthly payment</div>}
              <button className="sn-btn sn-btn--ghost" onClick={() => removeLender(row.id)} style={{ marginTop: 8 }}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <button className="sn-btn sn-btn--gold" onClick={addLender} style={{ marginTop: 16 }}>
        Add a lender
      </button>

      {rows.some(r => r.loan.status === "ok") && (
        <p className="sn-form-note" style={{ marginTop: 12 }}>
          {FINANCE_METHOD_NOTE} The lowest payment is not always the best deal: check fees, the total repayable
          and the terms.
        </p>
      )}
    </div>
  );
}
