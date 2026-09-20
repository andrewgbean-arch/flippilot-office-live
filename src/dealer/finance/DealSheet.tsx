import { useState } from "react";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";
import { FINANCE_DISCLAIMER, FINANCE_METHOD_NOTE, dealSheetFigures } from "./financeMath";
import { formatMoney, toAmount } from "./money";

// A deal summary a customer may be shown. It used to pre-fill a 9.9% APR, say
// nothing about being illustrative, and print £0.00 for anything blank; see
// financeMath.ts.
export default function DealSheet() {
  const { leads } = useLeads();

  const [leadId, setLeadId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [tradeInValue, setTradeInValue] = useState("");
  const [deposit, setDeposit] = useState("");
  const [financeTerm, setFinanceTerm] = useState("36");
  // Empty on purpose: a rate nobody has quoted must not appear on a customer's sheet.
  const [apr, setApr] = useState("");

  const selectedLead = leads.find(l => l.id === leadId);
  const f = dealSheetFigures({ salePrice, tradeInValue, deposit, months: financeTerm, apr });
  const dash = "—";

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Deal Sheet</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Build and review a deal summary for a customer. {FINANCE_DISCLAIMER}
      </p>

      <div className="sn-form">
        <label htmlFor="dealsheet-customer-lead">Customer / Lead</label>
        <select id="dealsheet-customer-lead"
          className="sn-input"
          value={leadId}
          onChange={e => setLeadId(e.target.value)}
        >
          <option value="">Select a lead...</option>
          {leads.map(l => (
            <option key={l.id} value={l.id}>
              {l.name} {l.phone ? `(${l.phone})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="dealsheet-vehicle">Vehicle</label>
        <input id="dealsheet-vehicle"
          className="sn-input"
          value={vehicle}
          onChange={e => setVehicle(e.target.value)}
          placeholder="e.g. BMW M2 Competition"
        />

        <label htmlFor="dealsheet-sale-price">Sale Price (£)</label>
        <input id="dealsheet-sale-price"
          type="number"
          min={0}
          className="sn-input"
          value={salePrice}
          placeholder="0.00"
          onChange={e => setSalePrice(e.target.value)}
        />

        <label htmlFor="dealsheet-trade-in-value">Trade-In Value (£)</label>
        <input id="dealsheet-trade-in-value"
          type="number"
          min={0}
          className="sn-input"
          value={tradeInValue}
          placeholder="0.00"
          onChange={e => setTradeInValue(e.target.value)}
        />

        <label htmlFor="dealsheet-deposit">Deposit (£)</label>
        <input id="dealsheet-deposit"
          type="number"
          min={0}
          className="sn-input"
          value={deposit}
          placeholder="0.00"
          onChange={e => setDeposit(e.target.value)}
        />

        <label htmlFor="dealsheet-finance-term-months">Finance Term (months)</label>
        <input id="dealsheet-finance-term-months"
          type="number"
          min={1}
          step={1}
          className="sn-input"
          value={financeTerm}
          onChange={e => setFinanceTerm(e.target.value)}
        />

        <label htmlFor="dealsheet-apr">APR (%)</label>
        <input id="dealsheet-apr"
          type="number"
          min={0}
          step="any"
          className="sn-input"
          value={apr}
          placeholder="Enter the rate you have been quoted"
          onChange={e => setApr(e.target.value)}
        />
      </div>

      <div className="sn-deal-summary">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Summary (illustrative)</h3>

        <div className="sn-deal-row">
          <span>Customer</span>
          <span>{selectedLead?.name ?? dash}</span>
        </div>
        <div className="sn-deal-row">
          <span>Vehicle</span>
          <span>{vehicle || dash}</span>
        </div>
        <div className="sn-deal-row">
          <span>Sale Price</span>
          <span>{f.salePrice === null ? dash : formatMoney(f.salePrice)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Trade-In Value</span>
          <span>{toAmount(tradeInValue) === null ? dash : `-${formatMoney(f.tradeInValue)}`}</span>
        </div>
        <div className="sn-deal-row">
          <span>Deposit</span>
          <span>{toAmount(deposit) === null ? dash : `-${formatMoney(f.deposit)}`}</span>
        </div>
        <div className="sn-deal-row">
          <span>Balance to Finance</span>
          <span>{f.balanceToFinance === null ? dash : formatMoney(Math.max(0, f.balanceToFinance))}</span>
        </div>
        {f.surplus > 0 && (
          <div className="sn-deal-row">
            <span>Trade-in and deposit are more than the sale price by</span>
            <span>{formatMoney(f.surplus)}</span>
          </div>
        )}
        <div className="sn-deal-row">
          <span>
            Monthly Payment
            {f.loan.status === "ok" ? ` (${financeTerm} months @ ${apr}% APR)` : ""}
          </span>
          <span>{f.loan.status === "ok" ? formatMoney(f.loan.monthlyPayment as number) : dash}</span>
        </div>
        {f.loan.status !== "ok" && f.balanceToFinance !== null && (
          <p className="sn-form-note" style={{ margin: "4px 0" }}>{f.loan.message}</p>
        )}
        <div className="sn-deal-row">
          <span>Interest over the term</span>
          <span>{f.loan.status === "ok" ? formatMoney(f.loan.totalInterest as number) : dash}</span>
        </div>
        <div className="sn-deal-row sn-deal-row--total">
          <span>Total Payable (including deposit and trade-in)</span>
          <span>{f.totalPayable === null ? dash : formatMoney(f.totalPayable)}</span>
        </div>

        <p className="sn-form-note" style={{ marginTop: 12 }}>
          {FINANCE_DISCLAIMER} {FINANCE_METHOD_NOTE}
        </p>
      </div>
    </div>
  );
}
