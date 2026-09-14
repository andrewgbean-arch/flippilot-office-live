import { useState } from "react";
import "@/staff/StaffDashboard.css";

type Lender = {
  id: string;
  name: string;
  apr: number;
};

const DEFAULT_LENDERS: Lender[] = [
  { id: "1", name: "Lender A", apr: 9.9 },
  { id: "2", name: "Lender B", apr: 12.5 },
  { id: "3", name: "Lender C", apr: 7.4 },
];

export default function LenderComparison() {
  const [amount, setAmount] = useState(10000);
  const [term, setTerm] = useState(36);
  const [lenders, setLenders] = useState<Lender[]>(DEFAULT_LENDERS);

  function updateLender(id: string, field: "name" | "apr", value: string) {
    setLenders(prev =>
      prev.map(l =>
        l.id === id
          ? { ...l, [field]: field === "apr" ? Number(value) : value }
          : l
      )
    );
  }

  function monthlyPayment(apr: number) {
    const monthlyRate = apr / 100 / 12;
    if (monthlyRate === 0) return amount / term;
    const payment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));
    return isNaN(payment) ? 0 : payment;
  }

  const best = lenders.reduce((min, l) =>
    monthlyPayment(l.apr) < monthlyPayment(min.apr) ? l : min
  , lenders[0]);

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Lender Comparison</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Compare monthly payments across lenders. Enter your own rates below.
      </p>

      <div className="sn-form">
        <label>Loan Amount (£)</label>
        <input
          type="number"
          className="sn-input"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
        />

        <label>Term (months)</label>
        <input
          type="number"
          className="sn-input"
          value={term}
          onChange={e => setTerm(Number(e.target.value))}
        />
      </div>

      <div className="sn-lender-grid">
        {lenders.map(l => {
          const payment = monthlyPayment(l.apr);
          const isBest = l.id === best.id;
          return (
            <div key={l.id} className={`sn-lender-card ${isBest ? "sn-lender-card--best" : ""}`}>
              <input
                className="sn-lender-name"
                value={l.name}
                onChange={e => updateLender(l.id, "name", e.target.value)}
              />
              <div className="sn-lender-apr-row">
                <span>APR</span>
                <input
                  type="number"
                  className="sn-lender-apr-input"
                  value={l.apr}
                  onChange={e => updateLender(l.id, "apr", e.target.value)}
                />
                <span>%</span>
              </div>
              <div className="sn-lender-payment">
                £{payment.toFixed(2)}<span className="sn-lender-payment__label">/month</span>
              </div>
              {isBest && <div className="sn-lender-badge">Best Rate</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}