import { useState } from "react";
import "@/staff/StaffDashboard.css";
import {
  CONDITION_ALLOWANCE_DEFAULT_PCT,
  DEFAULT_TRADE_IN_MARGIN_PCT,
  tradeInFigures,
  type TradeInCondition,
} from "./financeMath";
import { formatWholePounds } from "./money";

// A rule-of-thumb trade-in figure, not a valuation. It used to take a fixed
// -5% / -12% / -22% off for condition without saying so, collect a year and a
// mileage it never used, and print "Trade-In Offer" to the penny. The
// percentages are now shown, editable and labelled as a rule of thumb; the
// market value is whatever the dealer types from a source they trust.
export default function TradeInValuation() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [marketValue, setMarketValue] = useState("");
  const [condition, setCondition] = useState<TradeInCondition>("good");
  const [allowancePct, setAllowancePct] = useState(String(CONDITION_ALLOWANCE_DEFAULT_PCT.good));
  const [marginPct, setMarginPct] = useState(String(DEFAULT_TRADE_IN_MARGIN_PCT));
  const [outstandingFinance, setOutstandingFinance] = useState("");

  const f = tradeInFigures({ marketValue, allowancePct, marginPct, outstandingFinance });
  const dash = "—";

  // Choosing a condition sets the starting allowance; it stays editable.
  function chooseCondition(next: TradeInCondition) {
    setCondition(next);
    setAllowancePct(String(CONDITION_ALLOWANCE_DEFAULT_PCT[next]));
  }

  return (
    <div className="sn-panel sn-panel--full">
      <h1 className="sn-panel__title">Trade-In Valuation</h1>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        A rule-of-thumb starting point for a trade-in offer, worked out from a market value you enter.
        It is illustrative only: it does not look at the car, and it is not a valuation. Your own
        appraisal of the vehicle always comes first.
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

        <label htmlFor="tradeinvaluation-market-value">Market Value (£)</label>
        <input id="tradeinvaluation-market-value"
          type="number"
          min={0}
          className="sn-input"
          value={marketValue}
          onChange={e => setMarketValue(e.target.value)}
          placeholder="From a valuation guide or listings you trust"
        />

        <label htmlFor="tradeinvaluation-condition">Condition</label>
        <select id="tradeinvaluation-condition"
          className="sn-input"
          value={condition}
          onChange={e => chooseCondition(e.target.value as TradeInCondition)}
        >
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>

        <label htmlFor="tradeinvaluation-condition-allowance-off-the-market-value">Condition allowance (% off the market value)</label>
        <input id="tradeinvaluation-condition-allowance-off-the-market-value"
          type="number"
          min={0}
          max={100}
          step="any"
          className="sn-input"
          value={allowancePct}
          onChange={e => setAllowancePct(e.target.value)}
        />
        <p className="sn-form-note" style={{ margin: 0 }}>
          A rule of thumb, not a measured figure. Starting points: Excellent {CONDITION_ALLOWANCE_DEFAULT_PCT.excellent}%,
          Good {CONDITION_ALLOWANCE_DEFAULT_PCT.good}%, Fair {CONDITION_ALLOWANCE_DEFAULT_PCT.fair}%,
          Poor {CONDITION_ALLOWANCE_DEFAULT_PCT.poor}%. Change it to suit the car in front of you.
        </p>

        <label htmlFor="tradeinvaluation-your-margin-off-before-making-an-offer">Your margin (% off before making an offer)</label>
        <input id="tradeinvaluation-your-margin-off-before-making-an-offer"
          type="number"
          min={0}
          max={100}
          step="any"
          className="sn-input"
          value={marginPct}
          onChange={e => setMarginPct(e.target.value)}
        />

        <label htmlFor="tradeinvaluation-outstanding-finance">Outstanding Finance (£)</label>
        <input id="tradeinvaluation-outstanding-finance"
          type="number"
          min={0}
          className="sn-input"
          value={outstandingFinance}
          placeholder="0.00"
          onChange={e => setOutstandingFinance(e.target.value)}
        />
      </div>

      <div className="sn-deal-summary">
        <h2 className="sn-panel__title" style={{ marginTop: 20 }}>Valuation (illustrative)</h2>

        <div className="sn-deal-row">
          <span>Vehicle</span>
          <span>{make || model ? `${make} ${model}`.trim() : dash}</span>
        </div>
        <div className="sn-deal-row">
          <span>Market Value (as entered)</span>
          <span>{f.marketValue === null ? dash : formatWholePounds(f.marketValue)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Condition allowance ({condition}, {allowancePct === "" ? 0 : allowancePct}%)</span>
          <span>{f.ready ? `-${formatWholePounds(f.allowance)}` : dash}</span>
        </div>
        <div className="sn-deal-row">
          <span>Your margin ({marginPct === "" ? 0 : marginPct}%)</span>
          <span>{f.ready ? `-${formatWholePounds(f.margin)}` : dash}</span>
        </div>
        <div className="sn-deal-row sn-deal-row--total">
          <span>Suggested offer for the car (illustrative)</span>
          <span>{f.offerBeforeFinance === null ? dash : formatWholePounds(f.offerBeforeFinance)}</span>
        </div>
        {f.ready && f.outstandingFinance > 0 && (
          <div className="sn-deal-row">
            <span>Outstanding finance to clear</span>
            <span>-{formatWholePounds(f.outstandingFinance)}</span>
          </div>
        )}
        {f.ready && f.shortfall > 0 && (
          <div className="sn-deal-row">
            <span>Finance owed is more than the offer by</span>
            <span style={{ color: "#ff6b6b" }}>{formatWholePounds(f.shortfall)}</span>
          </div>
        )}
        {f.ready && f.shortfall === 0 && f.outstandingFinance > 0 && (
          <div className="sn-deal-row">
            <span>Left to pay the customer after clearing finance</span>
            <span style={{ color: "#00dc8c" }}>{formatWholePounds(f.paidToCustomer as number)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
