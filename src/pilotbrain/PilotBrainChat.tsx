import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiVolume2, FiVolumeX } from "react-icons/fi";
import { fetchPilotBrainMessages, sendPilotBrainMessage, type PilotBrainMessage } from "@/lib/pilotBrainApi";
import "@/staff/StaffDashboard.css";

// Real browser speech APIs, no bundled asset or third-party service —
// same "synthesize, don't ship an asset" approach as the notification
// chime (playNotificationSound.ts). Only Chrome/Edge support
// SpeechRecognition (still webkit-prefixed everywhere), so the mic
// button only appears when it's actually available rather than
// showing a button that silently does nothing in Firefox/Safari.
const SpeechRecognitionCtor: typeof window.SpeechRecognition | undefined =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined;

const VOICE_OUTPUT_KEY = "flippilot_pilot_brain_voice_output";

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

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognitionCtor>> | null>(null);

  // A per-viewer convenience (like a remembered tab), not app state —
  // fine to lose in a private window, never shared between viewers.
  const [voiceOutput, setVoiceOutput] = useState(() => {
    try {
      return localStorage.getItem(VOICE_OUTPUT_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetchPilotBrainMessages().then(result => {
      setLoading(false);
      if (result.ok) setMessages(result.messages);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Stop any in-progress speech the moment the toggle goes off or the
  // page is left — a reply still being read aloud after Boss switched
  // it off would be more annoying than the feature is worth.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleVoiceOutput() {
    const next = !voiceOutput;
    setVoiceOutput(next);
    try {
      localStorage.setItem(VOICE_OUTPUT_KEY, String(next));
    } catch {}
    if (!next) window.speechSynthesis?.cancel();
  }

  function speak(text: string) {
    if (!voiceOutput || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // don't stack replies if one's still talking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (!SpeechRecognitionCtor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        // Appends rather than replaces — dictating a second time adds
        // to what's already typed instead of wiping it out.
        setInput(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

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
    speak(result.message.content);
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
        <div className="sn-hero__content" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="sn-hero__title">Pilot Brain</h1>
            <p className="sn-hero__subtitle">Your business companion. Ask it anything about how things are going.</p>
          </div>

          {window.speechSynthesis && (
            <button
              onClick={toggleVoiceOutput}
              title={voiceOutput ? "Replies are read aloud — click to turn off" : "Turn on reading replies aloud"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999,
                background: voiceOutput ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${voiceOutput ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.15)"}`,
                color: voiceOutput ? "#ffd700" : "#f5f7ff99",
                fontSize: 13, cursor: "pointer", flexShrink: 0,
              }}
            >
              {voiceOutput ? <FiVolume2 /> : <FiVolumeX />}
              {voiceOutput ? "Voice on" : "Voice off"}
            </button>
          )}
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
        {listening && <p style={{ color: "#ffd700", fontSize: 13, marginBottom: 8 }}>Listening…</p>}
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
          {SpeechRecognitionCtor && (
            <button
              onClick={toggleListening}
              title={listening ? "Stop dictating" : "Speak your message"}
              className="sn-btn"
              style={{
                alignSelf: "flex-end",
                background: listening ? "rgba(255,80,80,0.2)" : undefined,
                borderColor: listening ? "rgba(255,80,80,0.5)" : undefined,
                color: listening ? "#ff8080" : undefined,
              }}
            >
              {listening ? <FiMicOff /> : <FiMic />}
            </button>
          )}
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
