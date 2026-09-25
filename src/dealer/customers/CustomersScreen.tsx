import { useEffect, useState } from "react";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
  type ConsentStatus,
} from "@/lib/customersApi";
import "@/staff/StaffDashboard.css";
import { useAuth } from "@/context/AuthContext";
import { canManageStaff } from "@/lib/permissions";

const CONSENT_LABEL: Record<ConsentStatus, string> = {
  not_asked: "Not asked",
  opted_in: "Opted in",
  opted_out: "Opted out",
};

const CONSENT_STYLE: Record<ConsentStatus, string> = {
  not_asked: "border-white/20 bg-white/5 text-white/50",
  opted_in: "border-green-400/40 bg-green-500/10 text-green-200",
  opted_out: "border-red-400/40 bg-red-500/10 text-red-200",
};

function ConsentBadge({ status }: { status: ConsentStatus }) {
  return (
    <span className={`px-2 py-1 rounded text-xs border ${CONSENT_STYLE[status]}`}>
      {CONSENT_LABEL[status]}
    </span>
  );
}

// Real customer database with real, recorded marketing consent per
// channel. There is deliberately no "Send" button anywhere on this
// page — no email/WhatsApp vendor is connected yet, and consent
// tracking has to exist before that's even legally sendable. This is
// the foundation a future stock-alert/dealer-list feature would build
// on top of, not that feature itself.
export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [methodDrafts, setMethodDrafts] = useState<Record<string, { email: string; whatsapp: string }>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleInterests, setVehicleInterests] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const result = await fetchCustomers();
    if (result.ok) {
      setCustomers(result.items);
      setMethodDrafts(prev => {
        const next = { ...prev };
        for (const c of result.items) {
          if (!next[c.id]) {
            next[c.id] = { email: c.emailConsent.method ?? "", whatsapp: c.whatsappConsent.method ?? "" };
          }
        }
        return next;
      });
    } else {
      setError(result.error ?? "Couldn't load customers");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError("Name and at least one of email or phone are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createCustomer({
      name: name.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(vehicleInterests.trim() ? { vehicleInterests: vehicleInterests.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that customer.");
      return;
    }
    setName(""); setEmail(""); setPhone(""); setVehicleInterests(""); setNotes("");
    setShowAdd(false);
    await load();
  }

  // The "how did they consent?" note is saved when you leave the box, as well
  // as with a change of status: a note typed for someone already Opted in used
  // to be lost, because only the drop-down saved.
  async function saveConsentNote(customer: Customer, channel: "emailConsent" | "whatsappConsent") {
    const draft = (channel === "emailConsent" ? methodDrafts[customer.id]?.email : methodDrafts[customer.id]?.whatsapp) ?? "";
    if (draft.trim() === (customer[channel].method ?? "").trim()) return;
    await handleConsentChange(customer, channel, customer[channel].status);
  }

  async function handleConsentChange(customer: Customer, channel: "emailConsent" | "whatsappConsent", status: ConsentStatus) {
    const method = channel === "emailConsent" ? methodDrafts[customer.id]?.email : methodDrafts[customer.id]?.whatsapp;
    await updateCustomer(customer.id, { [channel]: { status, method: method?.trim() || undefined } });
    await load();
  }

  const { user } = useAuth();
  const canRemove = canManageStaff(user);

  async function handleDelete(id: string) {
    const result = await deleteCustomer(id);
    if (!result.ok) window.alert(result.error ?? "That customer couldn't be removed. Try again.");
    await load();
  }

  const filtered = customers.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.email, c.phone, c.vehicleInterests].some(f => f?.toLowerCase().includes(q));
  });

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Customers</h1>
          <p className="sn-hero__subtitle">
            Your real customer database, with real recorded marketing consent per channel — separate from your sales
            pipeline and supplier contacts.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">
              {customers.length} customer{customers.length === 1 ? "" : "s"}
            </h2>
            <button className="sn-btn sn-btn--gold" onClick={() => setShowAdd(v => !v)}>
              {showAdd ? "Cancel" : "Add Customer"}
            </button>
          </div>

          {error && <p style={{ color: "#ff8080", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          {showAdd && (
            <div className="sn-recent-lead" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="sn-input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <input className="sn-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <input className="sn-input" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              </div>
              <input className="sn-input" placeholder="Vehicle interests (free text)" value={vehicleInterests} onChange={e => setVehicleInterests(e.target.value)} />
              <input className="sn-input" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
              <div>
                <button className="sn-btn sn-btn--gold" onClick={handleAdd} disabled={saving} style={{ fontSize: 13, padding: "6px 14px" }}>
                  {saving ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </div>
          )}

          <input
            className="sn-input"
            placeholder="Search by name, email, phone, or vehicle interest…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 16, width: "100%" }}
          />

          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="sn-empty">No customers saved yet.</p>
          ) : filtered.length === 0 ? (
            <p className="sn-empty">No customers match that search.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(c => (
                <div key={c.id} className="sn-recent-lead" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="sn-recent-lead__name">{c.name}</div>
                      <div className="sn-empty" style={{ fontSize: 13, marginTop: 2 }}>
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details on file"}
                      </div>
                      {c.vehicleInterests && <div className="sn-empty" style={{ fontSize: 12, marginTop: 2 }}>Interested in: {c.vehicleInterests}</div>}
                      {c.notes && <div className="sn-empty" style={{ fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{c.notes}</div>}
                    </div>
                    {/* Removing (erasing) a customer is for the owner and managers. */}
                    {canRemove && (
                      <button className="sn-btn sn-btn--danger" style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }} onClick={() => { if (window.confirm(`Remove ${c.name || "this customer"} and their consent record? This can't be undone.`)) void handleDelete(c.id); }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#f5f7ff80" }}>Email:</span>
                      <ConsentBadge status={c.emailConsent.status} />
                      <select
                        value={c.emailConsent.status}
                        onChange={e => handleConsentChange(c, "emailConsent", e.target.value as ConsentStatus)}
                        className="sn-input"
                        style={{ fontSize: 12, padding: "2px 6px" }}
                      >
                        <option value="not_asked">Not asked</option>
                        <option value="opted_in">Opted in</option>
                        <option value="opted_out">Opted out</option>
                      </select>
                      <input
                        placeholder="how did they consent?"
                        value={methodDrafts[c.id]?.email ?? ""}
                        onChange={e => setMethodDrafts(prev => ({ ...prev, [c.id]: { ...prev[c.id], email: e.target.value, whatsapp: prev[c.id]?.whatsapp ?? "" } }))}
                        onBlur={() => void saveConsentNote(c, "emailConsent")}
                        className="sn-input"
                        style={{ fontSize: 12, padding: "2px 6px", width: 160 }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#f5f7ff80" }}>WhatsApp:</span>
                      <ConsentBadge status={c.whatsappConsent.status} />
                      <select
                        value={c.whatsappConsent.status}
                        onChange={e => handleConsentChange(c, "whatsappConsent", e.target.value as ConsentStatus)}
                        className="sn-input"
                        style={{ fontSize: 12, padding: "2px 6px" }}
                      >
                        <option value="not_asked">Not asked</option>
                        <option value="opted_in">Opted in</option>
                        <option value="opted_out">Opted out</option>
                      </select>
                      <input
                        placeholder="how did they consent?"
                        value={methodDrafts[c.id]?.whatsapp ?? ""}
                        onChange={e => setMethodDrafts(prev => ({ ...prev, [c.id]: { ...prev[c.id], whatsapp: e.target.value, email: prev[c.id]?.email ?? "" } }))}
                        onBlur={() => void saveConsentNote(c, "whatsappConsent")}
                        className="sn-input"
                        style={{ fontSize: 12, padding: "2px 6px", width: 160 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
