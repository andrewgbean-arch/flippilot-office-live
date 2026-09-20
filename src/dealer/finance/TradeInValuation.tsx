import { useState } from "react";
import "@/staff/StaffDashboard.css";

type Condition = "excellent" | "good" | "fair" | "poor";

const CONDITION_ADJUSTMENT: Record<Condition, number> = {
  excellent: 0,
  good: -0.05,
  fair: -0.12,
  poor: -0.22,
};

export default function TradeInValuation() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [mileage, setMileage] = useState(0);
  const [marketValue, setMarketValue] = useState(0);
  const [condition, setCondition] = useState<Condition>("good");
  const [outstandingFinance, setOutstandingFinance] = useState(0);

  const conditionAdjustment = marketValue * CONDITION_ADJUSTMENT[condition];
  const adjustedValue = marketValue + conditionAdjustment;

  // Dealer typically offers below market value to allow for resale margin
  const dealerMargin = adjustedValue * 0.1;
  const offerBeforeFinance = adjustedValue - dealerMargin;
  const finalOffer = offerBeforeFinance - outstandingFinance;

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Trade-In Valuation</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Estimate a fair trade-in offer based on condition and market value.
      </p>

      <div className="sn-form">
        <label htmlFor="tradeinvaluation-make">Make</label>
        <input id="tradeinvaluation-make"
          className="sn-input"
          value={make}
          onChange={e => setMake(e.target.value)}
          placeholder="e.g. Ford"
        />

        <label htmlFor="tradeinvaluation-model">Model</label>
        <input id="tradeinvaluation-model"
          className="sn-input"
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="e.g. Fiesta"
        />

        <label htmlFor="tradeinvaluation-year">Year</label>
        <input id="tradeinvaluation-year"
          type="number"
          className="sn-input"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        />

        <label htmlFor="tradeinvaluation-mileage">Mileage</label>
        <input id="tradeinvaluation-mileage"
          type="number"
          className="sn-input"
          value={mileage}
          onChange={e => setMileage(Number(e.target.value))}
        />

        <label htmlFor="tradeinvaluation-estimated-market-value">Estimated Market Value (£)</label>
        <input id="tradeinvaluation-estimated-market-value"
          type="number"
          className="sn-input"
          value={marketValue}
          onChange={e => setMarketValue(Number(e.target.value))}
          placeholder="e.g. from AutoTrader/CAP"
        />

        <label htmlFor="tradeinvaluation-condition">Condition</label>
        <select id="tradeinvaluation-condition"
          className="sn-input"
          value={condition}
          onChange={e => setCondition(e.target.value as Condition)}
        >
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>

        <label htmlFor="tradeinvaluation-outstanding-finance">Outstanding Finance (£)</label>
        <input id="tradeinvaluation-outstanding-finance"
          type="number"
          className="sn-input"
          value={outstandingFinance}
          onChange={e => setOutstandingFinance(Number(e.target.value))}
        />
      </div>

      <div className="sn-deal-summary">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Valuation</h3>

        <div className="sn-deal-row">
          <span>Vehicle</span>
          <span>{make || model ? `${year} ${make} ${model}` : "—"}</span>
        </div>
        <div className="sn-deal-row">
          <span>Market Value</span>
          <span>£{marketValue.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Condition Adjustment ({condition})</span>
          <span>£{conditionAdjustment.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Dealer Margin (10%)</span>
          <span>-£{dealerMargin.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Outstanding Finance</span>
          <span>-£{outstandingFinance.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row sn-deal-row--total">
          <span>Trade-In Offer</span>
          <span style={{ color: finalOffer >= 0 ? "#00dc8c" : "#ff6b6b" }}>
            £{finalOffer.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}