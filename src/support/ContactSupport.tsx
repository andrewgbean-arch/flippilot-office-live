import { useEffect, useState } from "react";
import { submitSupportMessage, fetchMySupportMessages, type SupportMessage } from "@/lib/supportApi";
import "@/staff/StaffDashboard.css";

// Distinct from FeedbackBoard.tsx ("Team Message Board") — that one is
// a per-dealership internal board (a dealer's own staff leaving
// suggestions for their manager). This is the one channel that leaves
// a dealer's own account and reaches whoever actually runs FlipPilot,
// for real bugs/issues with the platform itself.
export default function ContactSupport() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<SupportMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    const result = await fetchMySupportMessages();
    setLoadingHistory(false);
    if (result.ok) setHistory(result.messages);
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await submitSupportMessage(message.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not send your message — please try again.");
      return;
    }
    setMessage("");
    setSent(true);
    loadHistory();
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Contact FlipPilot Support</h1>
          <p className="sn-hero__subtitle">
            Found a bug, or something not working right? Tell us what happened — the more detail, the faster we can sort it.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Send a Message</h2>
          <div className="sn-form" style={{ maxWidth: 640 }}>
            {sent && (
              <p style={{ color: "#8fe38f", fontSize: 13 }}>
                Sent — thanks, we'll take a look.
              </p>
            )}
            <textarea
              className="sn-input sn-textarea"
              value={message}
              onChange={e => {
                setMessage(e.target.value);
                setSent(false);
              }}
              rows={5}
              placeholder="What went wrong, and what were you trying to do?"
            />
            {error && <p style={{ color: "#ff8080", fontSize: 13 }}>{error}</p>}
            <div style={{ marginTop: 12 }}>
              <button
                className="sn-btn sn-btn--gold"
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </div>
          </div>
        </section>

        {!loadingHistory && history.length > 0 && (
          <section className="sn-panel sn-panel--full">
            <h2 className="sn-panel__title">Your Messages</h2>
            <div className="sn-leave-list">
              {history.map(entry => (
                <div key={entry.id} className="sn-recent-lead" style={{ alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
                  <div>
                    <p style={{ color: "#f5f7ff", fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>
                      {entry.message}
                    </p>
                    <div className="sn-recent-lead__status">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                  {entry.adminReply && (
                    <div
                      style={{
                        width: "100%",
                        marginLeft: 16,
                        paddingLeft: 12,
                        borderLeft: "2px solid rgba(255,215,0,0.4)",
                      }}
                    >
                      <p style={{ color: "#ffe27a", fontSize: 12, fontWeight: 600, margin: 0 }}>
                        FlipPilot Support replied
                        {entry.adminReplyAt ? ` — ${new Date(entry.adminReplyAt).toLocaleString()}` : ""}
                      </p>
                      <p style={{ color: "#f5f7ff", fontSize: 13, margin: "4px 0", whiteSpace: "pre-wrap" }}>
                        {entry.adminReply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
