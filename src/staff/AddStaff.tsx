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
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      active: true,
      joinedAt: new Date().toISOString(),
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
        <h2 className="sn-panel__title">Add Staff Member</h2>
        <p className="sn-form-note">
          Your account role ({user?.staffRole ?? "general"}) can view the team but not add or
          manage staff — that needs the Manager role.
        </p>
      </div>
    );
  }

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Add Staff Member</h2>

      <div className="sn-form">
        <label>Name</label>
        <input
          className="sn-input"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <label>Role</label>
        <select
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

        <label>Branch</label>
        <input
          className="sn-input"
          value={branch}
          onChange={e => setBranch(e.target.value)}
        />

        <label>Email</label>
        <input
          className="sn-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label>Phone</label>
        <input
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