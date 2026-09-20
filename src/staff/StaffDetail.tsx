import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStaff } from "./StaffContext";
import type { StaffRecord, StaffRole } from "./staffTypes";
import "./StaffDashboard.css";

export default function StaffDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { staff, updateStaff } = useStaff();

  const existing = staff.find(s => s.id === id);

  const [form, setForm] = useState<StaffRecord | null>(existing ?? null);
  const [skillsInput, setSkillsInput] = useState(existing?.skills?.join(", ") ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm(existing);
      setSkillsInput(existing.skills?.join(", ") ?? "");
    }
  }, [existing?.id]);

  if (!form) {
    return (
      <div className="sn-panel sn-panel--full">
        <h2 className="sn-panel__title">Staff Member Not Found</h2>
        <button className="sn-btn sn-btn--gold" onClick={() => navigate("/dealer/staff")}>
          Back to Staff Dashboard
        </button>
      </div>
    );
  }

  function update<K extends keyof StaffRecord>(key: K, value: StaffRecord[K]) {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!form) return;

    const updatedRecord: StaffRecord = {
      ...form,
      skills: skillsInput
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
    };

    const saveError = await updateStaff(updatedRecord);
    if (saveError) {
      setError(saveError);
      return;
    }
    setError(null);
    setSaved(true);
  }

  return (
    <div className="sn-panel sn-panel--full">
      <div className="sn-detail-header">
        <h2 className="sn-panel__title">{form.name || "Staff Member"}</h2>
        <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/dealer/staff")}>
          Back
        </button>
      </div>

      <div className="sn-form">
        <label htmlFor="staffdetail-name">Name</label>
        <input id="staffdetail-name"
          className="sn-input"
          value={form.name}
          onChange={e => update("name", e.target.value)}
        />

        <label htmlFor="staffdetail-role">Role</label>
        <select id="staffdetail-role"
          className="sn-input"
          value={form.role}
          onChange={e => update("role", e.target.value as StaffRole)}
        >
          <option value="manager">Manager</option>
          <option value="sales">Sales</option>
          <option value="admin">Admin</option>
          <option value="trainee">Trainee</option>
          <option value="cleaner">Cleaner</option>
          <option value="office">Office Staff</option>
          <option value="mot_tester">MOT Tester / Inspector</option>
          <option value="staff">Other / General Staff</option>
        </select>

        <label htmlFor="staffdetail-branch">Branch</label>
        <input id="staffdetail-branch"
          className="sn-input"
          value={form.branch ?? ""}
          onChange={e => update("branch", e.target.value)}
        />

        <label htmlFor="staffdetail-email">Email</label>
        <input id="staffdetail-email"
          className="sn-input"
          value={form.email ?? ""}
          onChange={e => update("email", e.target.value)}
        />

        <label htmlFor="staffdetail-phone">Phone</label>
        <input id="staffdetail-phone"
          className="sn-input"
          value={form.phone ?? ""}
          onChange={e => update("phone", e.target.value)}
        />

        <label htmlFor="staffdetail-national-insurance-number">National Insurance Number</label>
        <input id="staffdetail-national-insurance-number"
          className="sn-input"
          value={form.nationalInsurance ?? ""}
          onChange={e => update("nationalInsurance", e.target.value)}
          placeholder="e.g. QQ123456C"
        />

        <label htmlFor="staffdetail-address">Address</label>
        <textarea id="staffdetail-address"
          className="sn-input sn-textarea"
          value={form.address ?? ""}
          onChange={e => update("address", e.target.value)}
          rows={3}
        />

        <label htmlFor="staffdetail-skills-comma-separated">Skills (comma separated)</label>
        <input id="staffdetail-skills-comma-separated"
          className="sn-input"
          value={skillsInput}
          onChange={e => setSkillsInput(e.target.value)}
          placeholder="e.g. Valuations, Finance, MOT prep"
        />

        <label htmlFor="staffdetail-notes">Notes</label>
        <textarea id="staffdetail-notes"
          className="sn-input sn-textarea"
          value={form.notes ?? ""}
          onChange={e => update("notes", e.target.value)}
          rows={3}
        />

        {error && <p className="sn-form-note" style={{ color: "#ff8080" }}>{error}</p>}

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