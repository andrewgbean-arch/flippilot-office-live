import { useState } from "react";
import type { Customer } from "@/lib/customersApi";

// Correcting a customer's details: a mistyped number, a new email address, what
// they're after now. Customers could only be added or removed before, so a typo
// meant deleting them (and their consent record) and starting again; and people
// have a right to have wrong details about them put right.

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  vehicleInterests: string;
  notes: string;
}

/** Why the details can't be saved, or null. Same rule as adding a customer. */
export function detailsProblem(d: CustomerDetails): string | null {
  if (!d.name.trim()) return "Their name can't be empty.";
  if (!d.email.trim() && !d.phone.trim()) return "Keep an email address or a phone number for them.";
  return null;
}

const field = (label: string, value: string, set: (v: string) => void, opts: { wide?: boolean; type?: string } = {}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: "#f5f7ffa0", flex: opts.wide ? "1 1 100%" : "1 1 160px" }}>
    {label}
    <input className="sn-input" type={opts.type ?? "text"} value={value} onChange={(e) => set(e.target.value)} />
  </label>
);

export default function EditCustomerForm({
  customer,
  onSave,
  onCancel,
}: {
  customer: Customer;
  // Resolves to an error message to show, or null once saved.
  onSave: (details: CustomerDetails) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<CustomerDetails>({
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    vehicleInterests: customer.vehicleInterests ?? "",
    notes: customer.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof CustomerDetails) => (v: string) => setD((prev) => ({ ...prev, [key]: v }));

  async function save() {
    const problem = detailsProblem(d);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    const failed = await onSave(d);
    setSaving(false);
    if (failed) setError(failed);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-label={`Edit ${customer.name || "customer"}`} role="group">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {field("Name", d.name, set("name"))}
        {field("Email", d.email, set("email"), { type: "email" })}
        {field("Phone", d.phone, set("phone"), { type: "tel" })}
        {field("Interested in", d.vehicleInterests, set("vehicleInterests"), { wide: true })}
        {field("Notes", d.notes, set("notes"), { wide: true })}
      </div>
      {error && (
        <p role="alert" style={{ color: "#ff8080", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="sn-btn sn-btn--gold" onClick={save} disabled={saving} style={{ fontSize: 13, padding: "6px 14px" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button className="sn-btn" onClick={onCancel} disabled={saving} style={{ fontSize: 13, padding: "6px 14px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
