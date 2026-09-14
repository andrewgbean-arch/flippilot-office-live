import { useState } from "react";
import "@/staff/StaffDashboard.css";

export default function ProfitBreakdown() {
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [reconCost, setReconCost] = useState(0);
  const [partsLabour, setPartsLabour] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [vatMarginScheme, setVatMarginScheme] = useState(true);

  const totalCosts = purchasePrice + reconCost + partsLabour + otherCosts;
  const grossProfit = salePrice - totalCosts;

  // VAT margin scheme: VAT is only due on the profit margin (UK used car dealers)
  const vatOnMargin = vatMarginScheme && grossProfit > 0 ? grossProfit * (1 / 6) : 0;
  const netProfit = grossProfit - vatOnMargin;

  const marginPct = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Profit Breakdown</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        See the real margin on a vehicle after all costs.
      </p>

      <div className="sn-form">
        <label>Purchase Price (£)</label>
        <input
          type="number"
          className="sn-input"
          value={purchasePrice}
          onChange={e => setPurchasePrice(Number(e.target.value))}
        />

        <label>Reconditioning Cost (£)</label>
        <input
          type="number"
          className="sn-input"
          value={reconCost}
          onChange={e => setReconCost(Number(e.target.value))}
        />

        <label>Parts & Labour (£)</label>
        <input
          type="number"
          className="sn-input"
          value={partsLabour}
          onChange={e => setPartsLabour(Number(e.target.value))}
        />

        <label>Other Costs (£)</label>
        <input
          type="number"
          className="sn-input"
          value={otherCosts}
          onChange={e => setOtherCosts(Number(e.target.value))}
        />

        <label>Sale Price (£)</label>
        <input
          type="number"
          className="sn-input"
          value={salePrice}
          onChange={e => setSalePrice(Number(e.target.value))}
        />

        <label className="sn-checkbox-row">
          <input
            type="checkbox"
            checked={vatMarginScheme}
            onChange={e => setVatMarginScheme(e.target.checked)}
          />
          Apply VAT Margin Scheme
        </label>
      </div>

      <div className="sn-deal-summary">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Breakdown</h3>

        <div className="sn-deal-row">
          <span>Total Costs</span>
          <span>£{totalCosts.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Sale Price</span>
          <span>£{salePrice.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Gross Profit</span>
          <span>£{grossProfit.toFixed(2)}</span>
        </div>
        {vatMarginScheme && (
          <div className="sn-deal-row">
            <span>VAT on Margin (1/6)</span>
            <span>-£{vatOnMargin.toFixed(2)}</span>
          </div>
        )}
        <div className="sn-deal-row sn-deal-row--total">
          <span>Net Profit</span>
          <span style={{ color: netProfit >= 0 ? "#00dc8c" : "#ff6b6b" }}>
            £{netProfit.toFixed(2)}
          </span>
        </div>
        <div className="sn-deal-row">
          <span>Margin %</span>
          <span>{marginPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
