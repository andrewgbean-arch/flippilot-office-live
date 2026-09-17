import { useEffect, useState } from "react";
import {
  fetchSupportMessages,
  updateSupportMessageStatus,
  type SupportMessage,
  type SupportMessageStatus,
} from "@/lib/supportApi";
import "@/staff/StaffDashboard.css";

// Server-side requirePlatformAdmin (support.ts) is the real gate — this
// page assumes it's only reachable by someone who already passed that,
// same as every admin-only view in this app never re-implements the
// access check client-side as anything more than UX.
export default function SupportInbox() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const result = await fetchSupportMessages();
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Could not load messages.");
      return;
    }
    setError(null);
    setMessages(result.messages);
  }

  async function handleStatusChange(id: string, status: SupportMessageStatus) {
    // Optimistic — this is a low-stakes triage flag, not a value worth
    // blocking the UI on a round-trip for.
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, status } : m)));
    const result = await updateSupportMessageStatus(id, status);
    if (!result.ok) load(); // real state wins if the write actually failed
  }

  const newCount = messages.filter(m => m.status === "new").length;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Support Inbox</h1>
          <p className="sn-hero__subtitle">
            Messages from every dealership using FlipPilot. {newCount > 0 ? `${newCount} new.` : "All caught up."}
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : error ? (
            <p style={{ color: "#ff8080", fontSize: 13 }}>{error}</p>
          ) : messages.length === 0 ? (
            <p className="sn-empty">No messages yet.</p>
          ) : (
            <div className="sn-leave-list">
              {messages.map(m => (
                <SupportRow key={m.id} entry={m} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SupportRow({
  entry,
  onStatusChange,
}: {
  entry: SupportMessage;
  onStatusChange: (id: string, status: SupportMessageStatus) => void;
}) {
  const badgeClass =
    entry.status === "resolved"
      ? "sn-timeclock__badge--in"
      : entry.status === "reviewed"
        ? "sn-leave-badge--declined"
        : "sn-timeclock__badge--out";

  return (
    <div className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div className="sn-recent-lead__name">
          {entry.dealershipName} — {entry.userName} ({entry.userEmail})
        </div>
        <p style={{ color: "#f5f7ff", fontSize: 13, margin: "4px 0", whiteSpace: "pre-wrap" }}>
          {entry.message}
        </p>
        <div className="sn-recent-lead__status">{new Date(entry.createdAt).toLocaleString()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <span className={`sn-timeclock__badge ${badgeClass}`}>{entry.status}</span>
        {entry.status !== "reviewed" && (
          <button className="sn-btn sn-btn--ghost" onClick={() => onStatusChange(entry.id, "reviewed")}>
            Mark Reviewed
          </button>
        )}
        {entry.status !== "resolved" && (
          <button className="sn-btn sn-btn--ghost" onClick={() => onStatusChange(entry.id, "resolved")}>
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  );
}
