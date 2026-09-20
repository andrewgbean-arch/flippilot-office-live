import { useState } from "react";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function DealSheet() {
  const { leads } = useLeads();

  const [leadId, setLeadId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [salePrice, setSalePrice] = useState(0);
  const [tradeInValue, setTradeInValue] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [financeTerm, setFinanceTerm] = useState(36);
  const [apr, setApr] = useState(9.9);

  const selectedLead = leads.find(l => l.id === leadId);

  const balanceToFinance = salePrice - tradeInValue - deposit;
  const monthlyRate = apr / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? balanceToFinance / financeTerm
      : (balanceToFinance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -financeTerm));

  const totalPayable = deposit + (isNaN(monthlyPayment) ? 0 : monthlyPayment * financeTerm) + tradeInValue;

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Deal Sheet</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Build and review a deal summary for a customer.
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
          className="sn-input"
          value={salePrice}
          onChange={e => setSalePrice(Number(e.target.value))}
        />

        <label htmlFor="dealsheet-trade-in-value">Trade-In Value (£)</label>
        <input id="dealsheet-trade-in-value"
          type="number"
          className="sn-input"
          value={tradeInValue}
          onChange={e => setTradeInValue(Number(e.target.value))}
        />

        <label htmlFor="dealsheet-deposit">Deposit (£)</label>
        <input id="dealsheet-deposit"
          type="number"
          className="sn-input"
          value={deposit}
          onChange={e => setDeposit(Number(e.target.value))}
        />

        <label htmlFor="dealsheet-finance-term-months">Finance Term (months)</label>
        <input id="dealsheet-finance-term-months"
          type="number"
          className="sn-input"
          value={financeTerm}
          onChange={e => setFinanceTerm(Number(e.target.value))}
        />

        <label htmlFor="dealsheet-apr">APR (%)</label>
        <input id="dealsheet-apr"
          type="number"
          className="sn-input"
          value={apr}
          onChange={e => setApr(Number(e.target.value))}
        />
      </div>

      <div className="sn-deal-summary">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Summary</h3>

        <div className="sn-deal-row">
          <span>Customer</span>
          <span>{selectedLead?.name ?? "—"}</span>
        </div>
        <div className="sn-deal-row">
          <span>Vehicle</span>
          <span>{vehicle || "—"}</span>
        </div>
        <div className="sn-deal-row">
          <span>Sale Price</span>
          <span>£{salePrice.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Trade-In Value</span>
          <span>-£{tradeInValue.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Deposit</span>
          <span>-£{deposit.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Balance to Finance</span>
          <span>£{balanceToFinance.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row">
          <span>Monthly Payment ({financeTerm} months @ {apr}%)</span>
          <span>£{isNaN(monthlyPayment) ? "0.00" : monthlyPayment.toFixed(2)}</span>
        </div>
        <div className="sn-deal-row sn-deal-row--total">
          <span>Total Payable</span>
          <span>£{isNaN(totalPayable) ? "0.00" : totalPayable.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}