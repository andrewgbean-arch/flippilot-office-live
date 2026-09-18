import { useEffect, useRef, useState } from "react";
import { fetchPilotBrainMessages, sendPilotBrainMessage, type PilotBrainMessage } from "@/lib/pilotBrainApi";
import "@/staff/StaffDashboard.css";

// V1 (Companion) — natural conversation + memory + business awareness
// only. No monitoring, no forecasting, no market research yet (later
// versions) — the backend's own system prompt tells the model the
// same thing, so it won't pretend to do more than this version does.
export default function PilotBrainChat() {
  const [messages, setMessages] = useState<PilotBrainMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPilotBrainMessages().then(result => {
      setLoading(false);
      if (result.ok) setMessages(result.messages);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput("");
    // Optimistic — shows Boss's own message immediately rather than
    // waiting on a real API round-trip just to echo back what they
    // already know they typed.
    const optimisticUser: PilotBrainMessage = {
      id: `pending-${Date.now()}`,
      userId: "me",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);
    setSending(true);

    const result = await sendPilotBrainMessage(text);
    setSending(false);

    if (!result.ok || !result.message) {
      setError(result.error ?? "Pilot Brain couldn't reply — please try again.");
      return;
    }
    setMessages(prev => [...prev, result.message!]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="sn-hero" style={{ flexShrink: 0 }}>
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pilot Brain</h1>
          <p className="sn-hero__subtitle">Your business companion. Ask it anything about how things are going.</p>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px", maxWidth: 800, width: "100%", margin: "0 auto" }}>
        {loading ? (
          <p className="sn-empty">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="sn-empty">Say hello — Pilot Brain is ready when you are.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  background: m.role === "user" ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${m.role === "user" ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  color: "#f5f7ff",
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "80%",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "#f5f7ff80",
                }}
              >
                Pilot Brain is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: 16, maxWidth: 800, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {error && <p style={{ color: "#ff8080", fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            className="sn-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Talk to Pilot Brain… (Enter to send, Shift+Enter for a new line)"
            style={{ flex: 1, resize: "none" }}
          />
          <button
            className="sn-btn sn-btn--gold"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{ alignSelf: "flex-end" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
