import { useState } from "react";
import { submitSupportMessage } from "@/lib/supportApi";
import "@/staff/StaffDashboard.css";

// Distinct from FeedbackBoard.tsx ("What Can We Do Better?") — that
// one is a per-dealership internal board (a dealer's own staff leaving
// suggestions for their manager). This is the one channel that leaves
// a dealer's own account and reaches whoever actually runs FlipPilot,
// for real bugs/issues with the platform itself.
export default function ContactSupport() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
      </main>
    </div>
  );
}
