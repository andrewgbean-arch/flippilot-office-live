import { useState } from "react";
import type { Lead, LeadStatus } from "./leadTypes";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function AddLead() {
  const { addLead } = useLeads();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [vehicleInterest, setVehicleInterest] = useState("");
  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) {
      setError("Enter the lead's name before saving.");
      return;
    }
    setError(null);

    const newLead: Lead = {
      id: crypto.randomUUID(),
      name: name.trim(),
      source: source.trim(),
      status,
      createdAt: new Date().toISOString(),
      // exactOptionalPropertyTypes means these optional fields must be
      // left out entirely when blank, not explicitly set to undefined.
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(vehicleInterest.trim() ? { vehicleInterest: vehicleInterest.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    const ok = await addLead(newLead);
    if (!ok) {
      setError("Couldn't save this lead because your leads couldn't be loaded. Nothing was changed — try again shortly.");
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setSource("");
    setVehicleInterest("");
    setStatus("new");
    setNotes("");

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Add New Lead</h2>
      <p className="sn-form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Create a new customer lead and track it through your sales pipeline.
      </p>

      <div className="sn-form">
        <label>Full Name</label>
        <input
          className="sn-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter lead name"
        />

        <label>Lead Source</label>
        <input
          className="sn-input"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="AutoTrader, Facebook Ads, Walk-In..."
        />

        <label>Phone Number</label>
        <input
          className="sn-input"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="07..."
        />

        <label>Email Address</label>
        <input
          className="sn-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="example@email.com"
        />

        <label>Interested Vehicle</label>
        <input
          className="sn-input"
          value={vehicleInterest}
          onChange={e => setVehicleInterest(e.target.value)}
          placeholder="e.g. BMW M2 Competition"
        />

        <label>Status</label>
        <select
          className="sn-input"
          value={status}
          onChange={e => setStatus(e.target.value as LeadStatus)}
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="viewing_booked">Viewing Booked</option>
          <option value="test_drive">Test Drive</option>
          <option value="negotiating">Negotiating</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>

        <label>Notes</label>
        <textarea
          className="sn-input sn-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
        />

        {error && <p className="sn-form-note" style={{ color: "#ff8080" }}>{error}</p>}

        <div className="sn-detail-actions">
          <button className="sn-btn sn-btn--gold" onClick={handleAdd}>
            Add Lead
          </button>
          {saved && <span className="sn-saved-note">Lead added</span>}
        </div>
      </div>
    </div>
  );
}