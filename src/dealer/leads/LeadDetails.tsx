import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLeads } from "@/context/LeadsContext";
import type { Lead, LeadStatus } from "./leadTypes";
import "@/staff/StaffDashboard.css";

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

  async function handleSave() {
    if (!form) return;
    await updateLead(form);
    setSaved(true);
  }

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