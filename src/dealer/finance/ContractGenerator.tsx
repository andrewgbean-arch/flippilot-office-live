import { useState } from "react";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function ContractGenerator() {
  const { leads } = useLeads();

  const [leadId, setLeadId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [reg, setReg] = useState("");
  const [salePrice, setSalePrice] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [terms, setTerms] = useState(
    "This vehicle is sold with a valid MOT and 3 months warranty unless otherwise stated. Buyer confirms they have inspected the vehicle prior to purchase."
  );

  const selectedLead = leads.find(l => l.id === leadId);
  const balanceOnCollection = salePrice - deposit;
  const today = new Date().toLocaleDateString("en-GB");

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Contract Generator</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Generate a sale contract summary for print or record.
      </p>

      <div className="sn-form">
        <label>Customer / Lead</label>
        <select
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

        <label>Vehicle</label>
        <input
          className="sn-input"
          value={vehicle}
          onChange={e => setVehicle(e.target.value)}
          placeholder="e.g. BMW M2 Competition"
        />

        <label>Registration</label>
        <input
          className="sn-input"
          value={reg}
          onChange={e => setReg(e.target.value.toUpperCase())}
          placeholder="e.g. AB12 CDE"
        />

        <label>Sale Price (£)</label>
        <input
          type="number"
          className="sn-input"
          value={salePrice}
          onChange={e => setSalePrice(Number(e.target.value))}
        />

        <label>Deposit Paid (£)</label>
        <input
          type="number"
          className="sn-input"
          value={deposit}
          onChange={e => setDeposit(Number(e.target.value))}
        />

        <label>Terms & Conditions</label>
        <textarea
          className="sn-input sn-textarea"
          value={terms}
          onChange={e => setTerms(e.target.value)}
          rows={4}
        />
      </div>

      <div className="sn-contract-preview">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Contract Preview</h3>

        <div className="sn-contract-doc printable-invoice">
          <p><strong>Vehicle Sale Agreement</strong></p>
          <p>Date: {today}</p>
          <p>Buyer: {selectedLead?.name ?? "___________________"}</p>
          <p>Contact: {selectedLead?.phone ?? selectedLead?.email ?? "___________________"}</p>
          <hr />
          <p>Vehicle: {vehicle || "___________________"}</p>
          <p>Registration: {reg || "___________________"}</p>
          <hr />
          <p>Sale Price: £{salePrice.toFixed(2)}</p>
          <p>Deposit Paid: £{deposit.toFixed(2)}</p>
          <p>Balance Due on Collection: £{balanceOnCollection.toFixed(2)}</p>
          <hr />
          <p><strong>Terms:</strong></p>
          <p>{terms}</p>
        </div>

        <button className="sn-btn sn-btn--gold" onClick={() => window.print()} style={{ marginTop: 16 }}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}