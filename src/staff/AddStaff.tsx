import { useState } from "react";
import { StaffRecord, StaffRole } from "./staffTypes";
import { useStaff } from "./StaffContext";
import "./StaffDashboard.css";

export default function AddStaff() {
  const { addStaff } = useStaff();

  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [branch, setBranch] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;

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

    await addStaff(newStaff);

    setName("");
    setRole("staff");
    setBranch("");
    setEmail("");
    setPhone("");
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

        <button className="sn-btn sn-btn--gold" onClick={handleAdd}>
          Add Staff
        </button>

        <p className="sn-form-note">
          You can add NI number, address, skills, and notes after creating the staff member.
        </p>
      </div>
    </div>
  );
}