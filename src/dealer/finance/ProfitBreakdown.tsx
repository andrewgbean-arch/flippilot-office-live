import { useState } from "react";
import "@/staff/StaffDashboard.css";
import { calculateProfitBreakdown, type ProfitVatTreatment } from "./profitBreakdownModel";
import { formatMoney, toAmount } from "./money";

// The sums live in profitBreakdownModel.ts, which calls the same VAT code as
// the bookkeeping module. This file used to take 1/6 of (sale - ALL costs),
// which understated the VAT under the margin scheme.

const TREATMENT_LABEL: Record<ProfitVatTreatment, string> = {
  margin: "VAT margin scheme (VAT on sale price minus purchase price)",
  standard: "Standard 20% VAT (sale price includes VAT)",
  none: "No VAT taken off",
};

export default function ProfitBreakdown() {
  // Text state, so a blank box stays blank instead of turning into a 0.
  const [purchasePrice, setPurchasePrice] = useState("");
  const [reconCost, setReconCost] = useState("");
  const [partsLabour, setPartsLabour] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [treatment, setTreatment] = useState<ProfitVatTreatment>("margin");

  const result = calculateProfitBreakdown({
    purchasePrice,
    reconCost,
    partsLabour,
    otherCosts,
    salePrice,
    treatment,
  });

  const dash = "—";
  const enteredSale = toAmount(salePrice);
  const noCostsYet = [purchasePrice, reconCost, partsLabour, otherCosts].every(v => toAmount(v) === null);

  return (
    <div className="sn-panel sn-panel--full">
      <h1 className="sn-panel__title">Profit Breakdown</h1>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Work out the profit on a vehicle after costs and VAT. The VAT figure is a guide to
        check with your accountant, not a VAT return.
      </p>

      <div className="sn-form">
        <label htmlFor="profitbreakdown-purchase-price">Purchase Price (£)</label>
        <input id="profitbreakdown-purchase-price"
          type="number"
          min={0}
          className="sn-input"
          value={purchasePrice}
          placeholder="0.00"
          onChange={e => setPurchasePrice(e.target.value)}
        />

        <label htmlFor="profitbreakdown-reconditioning-cost">Reconditioning Cost (£)</label>
        <input id="profitbreakdown-reconditioning-cost"
          type="number"
          min={0}
          className="sn-input"
          value={reconCost}
          placeholder="0.00"
          onChange={e => setReconCost(e.target.value)}
        />

        <label htmlFor="profitbreakdown-parts-labour">Parts & Labour (£)</label>
        <input id="profitbreakdown-parts-labour"
          type="number"
          min={0}
          className="sn-input"
          value={partsLabour}
          placeholder="0.00"
          onChange={e => setPartsLabour(e.target.value)}
        />

        <label htmlFor="profitbreakdown-other-costs">Other Costs (£)</label>
        <input id="profitbreakdown-other-costs"
          type="number"
          min={0}
          className="sn-input"
          value={otherCosts}
          placeholder="0.00"
          onChange={e => setOtherCosts(e.target.value)}
        />

        <label htmlFor="profitbreakdown-sale-price">Sale Price (£)</label>
        <input id="profitbreakdown-sale-price"
          type="number"
          min={0}
          className="sn-input"
          value={salePrice}
          placeholder="0.00"
          onChange={e => setSalePrice(e.target.value)}
        />

        <label htmlFor="profitbreakdown-vat-treatment">VAT treatment</label>
        <select id="profitbreakdown-vat-treatment"
          className="sn-input"
          value={treatment}
          onChange={e => setTreatment(e.target.value as ProfitVatTreatment)}
        >
          {(Object.keys(TREATMENT_LABEL) as ProfitVatTreatment[]).map(key => (
            <option key={key} value={key}>{TREATMENT_LABEL[key]}</option>
          ))}
        </select>
      </div>

      <div className="sn-deal-summary">
        <h2 className="sn-panel__title" style={{ marginTop: 20 }}>Breakdown</h2>

        {!result.ready && (
          <p className="sn-form-note" style={{ marginTop: 0 }}>
            Enter the purchase price and the sale price to see the profit and the VAT.
          </p>
        )}

        <div className="sn-deal-row">
          <span>Total Costs (purchase + recon + parts &amp; labour + other)</span>
          <span>{noCostsYet ? dash : formatMoney(result.totalCosts)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Sale Price</span>
          <span>{enteredSale === null ? dash : formatMoney(enteredSale)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Gross Profit (sale price minus all costs, before VAT)</span>
          <span>{result.grossProfit === null ? dash : formatMoney(result.grossProfit)}</span>
        </div>
        {treatment === "margin" && (
          <div className="sn-deal-row">
            <span>
              VAT on margin (1/6 of sale price minus purchase price
              {result.vatBasis === null ? "" : `, ${formatMoney(result.vatBasis)}`})
            </span>
            <span>{result.vat === null ? dash : `-${formatMoney(result.vat)}`}</span>
          </div>
        )}
        {treatment === "standard" && (
          <div className="sn-deal-row">
            <span>VAT in the sale price (1/6 at 20%)</span>
            <span>{result.vat === null ? dash : `-${formatMoney(result.vat)}`}</span>
          </div>
        )}
        <div className="sn-deal-row sn-deal-row--total">
          <span>{treatment === "none" ? "Profit (no VAT taken off)" : "Net profit after VAT"}</span>
          <span
            style={
              result.netProfit === null
                ? undefined
                : { color: result.netProfit >= 0 ? "#00dc8c" : "#ff6b6b" }
            }
          >
            {result.netProfit === null ? dash : formatMoney(result.netProfit)}
          </span>
        </div>
        <div className="sn-deal-row">
          <span>Margin % (gross profit as a share of the sale price)</span>
          <span>{result.marginPct === null ? dash : `${result.marginPct.toFixed(1)}%`}</span>
        </div>

        {treatment === "margin" && (
          <p className="sn-form-note">
            Under the margin scheme the VAT is worked out on sale price minus purchase price only.
            Reconditioning, parts and other costs do not reduce it, and no VAT is due if the car
            sells for less than it cost.
          </p>
        )}
        {treatment === "standard" && (
          <p className="sn-form-note">
            The sale price is treated as including 20% VAT. Enter your costs without any VAT you
            can reclaim.
          </p>
        )}
      </div>
    </div>
  );
}
