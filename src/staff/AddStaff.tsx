import { useState } from "react";
import { StaffRecord, StaffRole } from "./staffTypes";
import { useStaff } from "./StaffContext";
import { useAuth } from "@/context/AuthContext";
import { canManageStaff } from "@/lib/permissions";
import "./StaffDashboard.css";

export default function AddStaff() {
  const { addStaff } = useStaff();
  const { user } = useAuth();
  const canWrite = canManageStaff(user);

  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [branch, setBranch] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleAdd() {
    if (!name.trim()) {
      setError("Enter the staff member's name before saving.");
      return;
    }
    setError(null);

    const newStaff: StaffRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role,
      branch,
      active: true,
      joinedAt: new Date().toISOString(),
      // exactOptionalPropertyTypes means these optional fields must be
      // left out entirely when blank, not explicitly set to undefined.
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };

    const saveError = await addStaff(newStaff);
    if (saveError) {
      setError(saveError);
      return;
    }

    setName("");
    setRole("staff");
    setBranch("");
    setEmail("");
    setPhone("");

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!canWrite) {
    return (
      <div className="sn-panel sn-panel--full">
        <h1 className="sn-panel__title">Add Staff Member</h1>
        <p className="sn-form-note">
          Your account role ({user?.staffRole ?? "general"}) can view the team but not add or
          manage staff — that needs the Manager role.
        </p>
      </div>
    );
  }

  return (
    <div className="sn-panel sn-panel--full">
      <h1 className="sn-panel__title">Add Staff Member</h1>

      <div className="sn-form">
        <label htmlFor="addstaff-name">Name</label>
        <input id="addstaff-name"
          className="sn-input"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <label htmlFor="addstaff-role">Role</label>
        <select id="addstaff-role"
          className="sn-input"
          value={role}
          onChange={e => setRole(e.target.value as StaffRole)}
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

        <label htmlFor="addstaff-branch">Branch</label>
        <input id="addstaff-branch"
          className="sn-input"
          value={branch}
          onChange={e => setBranch(e.target.value)}
        />

        <label htmlFor="addstaff-email">Email</label>
        <input id="addstaff-email"
          className="sn-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label htmlFor="addstaff-phone">Phone</label>
        <input id="addstaff-phone"
          className="sn-input"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />

        {error && <p className="sn-form-note" style={{ color: "#ff8080" }}>{error}</p>}

        <div className="sn-detail-actions">
          <button className="sn-btn sn-btn--gold" onClick={handleAdd}>
            Add Staff
          </button>
          {saved && <span className="sn-saved-note">Staff member added</span>}
        </div>

        <p className="sn-form-note">
          You can add NI number, address, skills, and notes after creating the staff member.
        </p>
      </div>
    </div>
  );
}