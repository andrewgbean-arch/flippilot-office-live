import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLeads } from "@/context/LeadsContext";
import { useInventory } from "@/context/InventoryProvider";
import type { Lead, LeadStatus } from "./leadTypes";
import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";
import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import type { BuyerProfile } from "@/features/dealer-ai/AffordabilityEngine";
import "@/staff/StaffDashboard.css";

const AFFORDABILITY_THEME = {
  card: "#0A0F1F",
  cardElevated: "#131A2E",
  background: "#0A0F1F",
  accent: "#FFD700",
  goldSoftGlow: "#FFD70055",
  white: "#FFFFFF",
  secondary: "#AAB4C3",
  muted: "#7A8598",
};

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "contacted",
  "viewing_booked",
  "test_drive",
  "negotiating",
  "won",
  "lost",
];

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, updateLead } = useLeads();
  const { vehicles } = useInventory();

  const existing = leads.find(l => l.id === id);

  const [form, setForm] = useState<Lead | null>(existing ?? null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing?.id]);

  if (!form) {
    return (
      <div className="sn-panel sn-panel--full">
        <h2 className="sn-panel__title">Lead Not Found</h2>
        <button className="sn-btn sn-btn--gold" onClick={() => navigate("/dealer/sales/leads")}>
          Back to Leads Dashboard
        </button>
      </div>
    );
  }

  function update<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function updateNumber(key: keyof Lead, raw: string) {
    update(key, (raw.trim() === "" ? undefined : Number(raw)) as never);
  }

  async function handleSave() {
    if (!form) return;
    const ok = await updateLead(form);
    if (ok) setSaved(true);
  }

  const interestedVehicle = form.interestedVehicleId
    ? vehicles.find(v => v.id === form.interestedVehicleId)
    : null;

  // AffordabilityEngine works against FlipRecord — map the real
  // inventory vehicle across using the same field mapping AIInsights.tsx
  // already uses (priceTrade → buyPrice, priceRetail → sellPrice/valuation).
  const flipRecordForCard: FlipRecord | null = interestedVehicle
    ? {
        id: interestedVehicle.id,
        title: `${interestedVehicle.make} ${interestedVehicle.model}`,
        buyPrice: interestedVehicle.priceTrade ?? 0,
        sellPrice: interestedVehicle.priceRetail ?? null,
        valuation: interestedVehicle.priceRetail ?? null,
        timestamp: new Date().toISOString(),
      }
    : null;

  const buyerProfile: BuyerProfile = {
    ...(form.income != null ? { income: form.income } : {}),
    ...(form.expenses != null ? { expenses: form.expenses } : {}),
    ...(form.deposit != null ? { deposit: form.deposit } : {}),
    ...(form.creditScore != null ? { creditScore: form.creditScore } : {}),
    ...(form.savings != null ? { savings: form.savings } : {}),
    ...(form.employmentStability != null ? { employmentStability: form.employmentStability } : {}),
  };

  // Only show a computed score once real income data exists — otherwise
  // AffordabilityEngine would return a confident-looking "0/100" for a
  // buyer nobody has actually assessed yet, which reads as a real result
  // rather than "no data collected".
  const hasBuyerData = (form.income ?? 0) > 0;

  return (
    <div className="sn-panel sn-panel--full">
      <div className="sn-detail-header">
        <h2 className="sn-panel__title">{form.name || "Lead"}</h2>
        <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/dealer/sales/leads")}>
          Back
        </button>
      </div>

      <div className="sn-form">
        <label>Full Name</label>
        <input
          className="sn-input"
          value={form.name}
          onChange={e => update("name", e.target.value)}
        />

        <label>Lead Source</label>
        <input
          className="sn-input"
          value={form.source}
          onChange={e => update("source", e.target.value)}
        />

        <label>Phone Number</label>
        <input
          className="sn-input"
          value={form.phone ?? ""}
          onChange={e => update("phone", e.target.value)}
        />

        <label>Email Address</label>
        <input
          className="sn-input"
          value={form.email ?? ""}
          onChange={e => update("email", e.target.value)}
        />

        <label>Interested Vehicle</label>
        <input
          className="sn-input"
          value={form.vehicleInterest ?? ""}
          onChange={e => update("vehicleInterest", e.target.value)}
        />

        <label>Vehicle of Interest (real stock — for affordability check)</label>
        <select
          className="sn-input"
          value={form.interestedVehicleId ?? ""}
          onChange={e => update("interestedVehicleId", e.target.value || undefined)}
        >
          <option value="">— None selected —</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.make} {v.model} — £{(v.priceRetail ?? 0).toLocaleString()}
            </option>
          ))}
        </select>

        <label>Status</label>
        <select
          className="sn-input"
          value={form.status}
          onChange={e => update("status", e.target.value as LeadStatus)}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>

        <label>Notes</label>
        <textarea
          className="sn-input sn-textarea"
          value={form.notes ?? ""}
          onChange={e => update("notes", e.target.value)}
          rows={4}
        />

        <h3 className="sn-panel__title" style={{ fontSize: 18, marginTop: 24 }}>
          Affordability Check
        </h3>
        <p style={{ color: "#AAB4C3", fontSize: 13, marginBottom: 8 }}>
          Enter what the buyer's told you during a finance conversation. Leave blank if you haven't discussed it yet — nothing is calculated until income is filled in.
        </p>

        <label>Monthly Income (£)</label>
        <input
          className="sn-input"
          type="number"
          value={form.income ?? ""}
          onChange={e => updateNumber("income", e.target.value)}
        />

        <label>Monthly Expenses (£)</label>
        <input
          className="sn-input"
          type="number"
          value={form.expenses ?? ""}
          onChange={e => updateNumber("expenses", e.target.value)}
        />

        <label>Deposit Available (£)</label>
        <input
          className="sn-input"
          type="number"
          value={form.deposit ?? ""}
          onChange={e => updateNumber("deposit", e.target.value)}
        />

        <label>Credit Score (0–1000)</label>
        <input
          className="sn-input"
          type="number"
          value={form.creditScore ?? ""}
          onChange={e => updateNumber("creditScore", e.target.value)}
        />

        <label>Savings (£)</label>
        <input
          className="sn-input"
          type="number"
          value={form.savings ?? ""}
          onChange={e => updateNumber("savings", e.target.value)}
        />

        <label>Employment Stability (0–100)</label>
        <input
          className="sn-input"
          type="number"
          value={form.employmentStability ?? ""}
          onChange={e => updateNumber("employmentStability", e.target.value)}
        />

        {!form.interestedVehicleId && hasBuyerData && (
          <p style={{ color: "#f1c40f", fontSize: 13 }}>
            Select a real vehicle above to run the affordability check against.
          </p>
        )}

        {flipRecordForCard && hasBuyerData && (
          <AffordabilitySummaryCard
            vehicle={flipRecordForCard}
            buyer={buyerProfile}
            theme={AFFORDABILITY_THEME}
          />
        )}

        <div className="sn-detail-actions">
          <button className="sn-btn sn-btn--gold" onClick={handleSave}>
            Save Changes
          </button>
          {saved && <span className="sn-saved-note">Saved</span>}
        </div>
      </div>
    </div>
  );
}