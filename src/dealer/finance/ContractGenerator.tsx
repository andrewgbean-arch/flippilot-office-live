import { useState } from "react";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";
import {
  CONTRACT_NOTICE_LINES,
  CONTRACT_NOTICE_TITLE,
  CONTRACT_STATUTORY_RIGHTS_LINE,
  contractFigures,
} from "./contractModel";
import { formatMoney } from "./money";

const BLANK = "___________________";

// A sale agreement TEMPLATE. Every promise in it is typed by the dealer; the
// screen used to pre-fill "3 months warranty" and an "inspected the vehicle"
// clause (see contractModel.ts for why both had to go).
export default function ContractGenerator() {
  const { leads } = useLeads();

  const [leadId, setLeadId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerVat, setSellerVat] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [reg, setReg] = useState("");
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [warranty, setWarranty] = useState("");
  const [otherTerms, setOtherTerms] = useState("");

  const selectedLead = leads.find(l => l.id === leadId);
  const figures = contractFigures(salePrice, deposit);
  const today = new Date().toLocaleDateString("en-GB");

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Contract Generator</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Fill in a sale agreement template to print or save as a PDF.
      </p>

      <div
        role="note"
        className="sn-form-note"
        style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderLeft: "3px solid #d4af37",
          background: "rgba(212,175,55,0.08)",
          borderRadius: 6,
        }}
      >
        <strong>{CONTRACT_NOTICE_TITLE}</strong>
        {CONTRACT_NOTICE_LINES.map(line => (
          <p key={line} style={{ margin: "6px 0 0" }}>{line}</p>
        ))}
      </div>

      <div className="sn-form">
        <label>Your business name (the seller)</label>
        <input
          className="sn-input"
          value={sellerName}
          onChange={e => setSellerName(e.target.value)}
          placeholder="Trading name as it appears on your invoices"
        />

        <label>Your address</label>
        <textarea
          className="sn-input sn-textarea"
          value={sellerAddress}
          onChange={e => setSellerAddress(e.target.value)}
          rows={2}
        />

        <label>VAT number (if you are VAT registered)</label>
        <input
          className="sn-input"
          value={sellerVat}
          onChange={e => setSellerVat(e.target.value)}
        />

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

        <label>VIN / chassis number</label>
        <input
          className="sn-input"
          value={vin}
          onChange={e => setVin(e.target.value.toUpperCase())}
        />

        <label>Mileage at sale</label>
        <input
          className="sn-input"
          value={mileage}
          onChange={e => setMileage(e.target.value)}
          placeholder="e.g. 48,200 miles"
        />

        <label>Sale Price (£)</label>
        <input
          type="number"
          min={0}
          className="sn-input"
          value={salePrice}
          placeholder="0.00"
          onChange={e => setSalePrice(e.target.value)}
        />

        <label>Deposit Paid (£)</label>
        <input
          type="number"
          min={0}
          className="sn-input"
          value={deposit}
          placeholder="0.00"
          onChange={e => setDeposit(e.target.value)}
        />
        {figures.depositExceedsPrice && (
          <p className="sn-form-note" style={{ color: "#ff6b6b", margin: 0 }}>
            The deposit is more than the sale price. Check the figures; the balance is left blank.
          </p>
        )}

        <label>Warranty terms (only if you are giving one)</label>
        <textarea
          className="sn-input sn-textarea"
          value={warranty}
          onChange={e => setWarranty(e.target.value)}
          rows={3}
          placeholder="Leave blank if none. If you give a warranty, write exactly what it covers and for how long."
        />

        <label>Other terms</label>
        <textarea
          className="sn-input sn-textarea"
          value={otherTerms}
          onChange={e => setOtherTerms(e.target.value)}
          rows={4}
          placeholder="Your own terms. Nothing is filled in for you."
        />
      </div>

      <div className="sn-contract-preview">
        <h3 className="sn-panel__title" style={{ marginTop: 20 }}>Contract Preview</h3>

        <div className="sn-contract-doc printable-invoice">
          <p><strong>Vehicle Sale Agreement</strong></p>
          <p>Date: {today}</p>
          <p>Seller: {sellerName.trim() || BLANK}</p>
          <p style={{ whiteSpace: "pre-line" }}>Seller address: {sellerAddress.trim() || BLANK}</p>
          {sellerVat.trim() && <p>VAT number: {sellerVat.trim()}</p>}
          <p>Buyer: {selectedLead?.name ?? BLANK}</p>
          <p>Contact: {selectedLead?.phone ?? selectedLead?.email ?? BLANK}</p>
          <hr />
          <p>Vehicle: {vehicle || BLANK}</p>
          <p>Registration: {reg || BLANK}</p>
          <p>VIN / chassis number: {vin || BLANK}</p>
          <p>Mileage at sale: {mileage.trim() || BLANK}</p>
          <hr />
          <p>Sale Price: {figures.salePrice === null ? BLANK : formatMoney(figures.salePrice)}</p>
          <p>Deposit Paid: {formatMoney(figures.deposit)}</p>
          <p>Balance Due on Collection: {figures.balance === null ? BLANK : formatMoney(figures.balance)}</p>
          <hr />
          <p><strong>Warranty (if any):</strong></p>
          <p style={{ whiteSpace: "pre-line" }}>{warranty.trim() || BLANK}</p>
          <p><strong>Other terms:</strong></p>
          <p style={{ whiteSpace: "pre-line" }}>{otherTerms.trim() || BLANK}</p>
          <p>{CONTRACT_STATUTORY_RIGHTS_LINE}</p>
          <hr />
          <p>Signed for the seller: {BLANK} Date: __________</p>
          <p>Signed by the buyer: {BLANK} Date: __________</p>
        </div>

        <button className="sn-btn sn-btn--gold" onClick={() => window.print()} style={{ marginTop: 16 }}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
