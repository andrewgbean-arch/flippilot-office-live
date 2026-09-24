import { useState } from "react";
import { useContacts } from "@/context/ContactsContext";
import { mailtoHref } from "@/lib/mailto";
import AddContactModal from "./AddContactModal";
import type { Contact, ContactCategory } from "./contactTypes";
import { CONTACT_CATEGORY_LABELS } from "./contactTypes";
import "@/staff/StaffDashboard.css";

const CATEGORY_ORDER: ContactCategory[] = ["parts_supplier", "auction_house", "transport", "valeting", "other"];

export default function ContactsBoard() {
  const { contacts, loading, removeContact } = useContacts();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [filter, setFilter] = useState<ContactCategory | "all">("all");

  const filtered = filter === "all" ? contacts : contacts.filter(c => c.category === filter);

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: filtered.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Contacts</h1>
          <p className="sn-hero__subtitle">Your regular suppliers, auction houses, and other business contacts.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">
              {contacts.length} contact{contacts.length === 1 ? "" : "s"}
            </h2>
            <button className="sn-btn sn-btn--gold" onClick={() => setShowAdd(true)}>
              Add Contact
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button
              className={filter === "all" ? "sn-btn sn-btn--gold" : "sn-btn sn-btn--ghost"}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            {CATEGORY_ORDER.map(cat => (
              <button
                key={cat}
                className={filter === cat ? "sn-btn sn-btn--gold" : "sn-btn sn-btn--ghost"}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setFilter(cat)}
              >
                {CONTACT_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="sn-empty">No contacts saved yet.</p>
          ) : filtered.length === 0 ? (
            <p className="sn-empty">No contacts in this category.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {grouped.map(group => (
                <div key={group.category}>
                  <h3 className="sn-panel__title" style={{ fontSize: 14, marginBottom: 8, opacity: 0.7 }}>
                    {CONTACT_CATEGORY_LABELS[group.category]}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {group.items.map(c => (
                      <div
                        key={c.id}
                        className="sn-recent-lead"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                      >
                        <div>
                          <div className="sn-recent-lead__name">{c.name}</div>
                          <div className="sn-empty" style={{ fontSize: 13, marginTop: 2 }}>
                            {[c.contactName, c.phone, c.email].filter(Boolean).join(" · ") || "No contact details on file"}
                          </div>
                          {c.address && <div className="sn-empty" style={{ fontSize: 12, marginTop: 2 }}>{c.address}</div>}
                          {c.notes && <div className="sn-empty" style={{ fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{c.notes}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          {c.email && (
                            <a href={mailtoHref(c.email)} className="sn-btn sn-btn--ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
                              Email
                            </a>
                          )}
                          <button
                            className="sn-btn sn-btn--ghost"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => setEditing(c)}
                          >
                            Edit
                          </button>
                          <button
                            className="sn-btn sn-btn--danger"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => { if (window.confirm(`Remove ${c.name || "this contact"}? This can't be undone.`)) void removeContact(c.id); }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
      {editing && <AddContactModal existing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
