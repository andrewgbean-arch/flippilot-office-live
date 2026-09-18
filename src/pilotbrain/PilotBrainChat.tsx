import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiVolume2, FiVolumeX } from "react-icons/fi";
import { fetchPilotBrainMessages, sendPilotBrainMessage, fetchSpeech, fetchMorningBriefing, fetchPerformanceReview, fetchTodaysPriorities, clearPilotBrainConversation, OPENAI_VOICES, type OpenAiVoice, type PilotBrainMessage, type ReviewPeriod } from "@/lib/pilotBrainApi";
import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";
import "@/staff/StaffDashboard.css";

// MediaSource lets audio start playing as soon as enough of the stream
// has arrived, instead of waiting for the whole file — real fix for
// the multi-second gap on a longer reply. Not universally supported
// for audio/mpeg (patchy on Firefox/Safari), so this is feature-
// detected and falls back to the simpler full-download approach
// (fetchSpeech) when it isn't available.
const canStreamMp3 =
  typeof window !== "undefined" &&
  "MediaSource" in window &&
  MediaSource.isTypeSupported("audio/mpeg");

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
const VOICE_CHOICE_KEY = "flippilot_pilot_brain_voice_choice";
const DEFAULT_VOICE: OpenAiVoice = "fable";

// Voices differ per OS/browser and there's no reliable "gender" field
// on the Web Speech API — just a name. This matches against common
// real female voice names across Windows/Chrome/macOS rather than
// guessing at a fixed index, and falls back to the browser's own
// default (undefined) if none of them are installed, so it never
// crashes or picks something arbitrary on an unfamiliar system.
const FEMALE_VOICE_HINTS = [
  "female", "hazel", "susan", "samantha", "zira", "victoria",
  "karen", "moira", "tessa", "fiona", "aria", "libby", "sonia",
];

function pickFemaleVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
  const pool = englishVoices.length > 0 ? englishVoices : voices;
  return pool.find(v => FEMALE_VOICE_HINTS.some(hint => v.name.toLowerCase().includes(hint)));
}

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
  // Chrome silently drops speech if the SpeechSynthesisUtterance has no
  // surviving reference — it can get garbage-collected before it fires.
  // Keeping it here (not just as a local variable in speak()) is what
  // actually makes voice output work, not just what "looks tidier".
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // The real AI voice (OpenAI tts-1) — tracked so a new reply can stop
  // whichever one's still playing, and so its object URL gets revoked
  // instead of leaking.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // A per-viewer convenience (like a remembered tab), not app state —
  // fine to lose in a private window, never shared between viewers.
  const [voiceOutput, setVoiceOutput] = useState(() => {
    try {
      return localStorage.getItem(VOICE_OUTPUT_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [voiceChoice, setVoiceChoice] = useState<OpenAiVoice>(() => {
    try {
      const saved = localStorage.getItem(VOICE_CHOICE_KEY);
      return (OPENAI_VOICES as readonly string[]).includes(saved ?? "") ? (saved as OpenAiVoice) : DEFAULT_VOICE;
    } catch {
      return DEFAULT_VOICE;
    }
  });

  function changeVoice(next: OpenAiVoice) {
    setVoiceChoice(next);
    try {
      localStorage.setItem(VOICE_CHOICE_KEY, next);
    } catch {}
  }

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
      stopAiAudio();
    };
  }, []);

  function stopAiAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
  }

  function toggleVoiceOutput() {
    const next = !voiceOutput;
    setVoiceOutput(next);
    try {
      localStorage.setItem(VOICE_OUTPUT_KEY, String(next));
    } catch {}
    if (!next) {
      window.speechSynthesis?.cancel();
      stopAiAudio();
    }
  }

  // Free browser voice — used as the fallback when the real AI voice
  // (OpenAI) isn't configured or its call fails, so voice output never
  // just goes silent.
  function speakWithBrowserVoice(text: string) {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    const utterance = new SpeechSynthesisUtterance(text);
    // Default rate/pitch (both 1) reads flat and sluggish on most
    // synthetic voices — a bit brisker and a touch brighter sounds far
    // more natural and upbeat without tipping into chipmunk territory.
    utterance.rate = 1.15;
    utterance.pitch = 1.1;
    utterance.voice = pickFemaleVoice(synth) ?? null;
    utteranceRef.current = utterance; // keep alive — see the ref's own comment

    // Cancelling and immediately speaking in the same tick races in
    // Chrome and can drop the new utterance entirely — only cancel if
    // something is actually mid-speech, and let that cancellation
    // settle on the next tick before starting the new one.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(() => synth.speak(utterance), 50);
    } else {
      synth.speak(utterance);
    }
  }

  // Plays as the response streams in rather than waiting for the whole
  // MP3 to finish generating — cuts the "time before anything plays"
  // for a longer reply down to roughly the first chunk's worth of
  // audio instead of the full file. Falls back to the simpler
  // buffered path on any error (unsupported codec quirk, network
  // hiccup, etc.) rather than leaving Wendy silent.
  async function speakStreaming(text: string, voice: OpenAiVoice): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/pilot-brain/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok || !res.body) return false;

      const mediaSource = new MediaSource();
      const audio = new Audio();
      audio.src = URL.createObjectURL(mediaSource);
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener("sourceopen", async () => {
          try {
            const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
            const reader = res.body!.getReader();

            // A SourceBuffer can only handle one appendBuffer() at a
            // time — each chunk has to wait for the previous one's
            // "updateend" before the next can be appended.
            const waitForUpdateEnd = () =>
              new Promise<void>(r => sourceBuffer.addEventListener("updateend", () => r(), { once: true }));

            audio.play().catch(() => {}); // starts once enough is buffered; browser handles the wait

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              sourceBuffer.appendBuffer(value);
              await waitForUpdateEnd();
            }
            mediaSource.endOfStream();
            resolve();
          } catch (err) {
            reject(err);
          }
        }, { once: true });
      });

      audio.onended = () => URL.revokeObjectURL(audio.src);
      return true;
    } catch (err) {
      console.error("speakStreaming failed, falling back", err);
      return false;
    }
  }

  // Full-download fallback — used when the browser can't stream MP3
  // via MediaSource, or when streaming playback itself fails.
  async function speakBuffered(text: string, voice: OpenAiVoice) {
    const audioUrl = await fetchSpeech(text, voice);
    if (!audioUrl) {
      speakWithBrowserVoice(text); // real AI voice unavailable/failed — don't go silent
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      speakWithBrowserVoice(text);
    };
    audio.play().catch(() => speakWithBrowserVoice(text));
  }

  async function speak(text: string, voiceOverride?: OpenAiVoice) {
    if (!voiceOutput && !voiceOverride) return; // voiceOverride lets the "try this voice" preview bypass the toggle

    stopAiAudio();
    const voice = voiceOverride ?? voiceChoice;

    if (canStreamMp3) {
      const streamed = await speakStreaming(text, voice);
      if (streamed) return;
    }
    await speakBuffered(text, voice);
  }

  const [previewing, setPreviewing] = useState<OpenAiVoice | null>(null);
  async function previewVoice(voice: OpenAiVoice) {
    setPreviewing(voice);
    await speak(`Hello Boss, this is the ${voice} voice.`, voice);
    setPreviewing(null);
  }

  // Morning Briefing (V1) and Performance Review (V3) — both existed
  // as real backend endpoints already, but neither had ever been wired
  // to a button; a dealer had no way to actually trigger them. Shown
  // in the thread as a normal assistant message (not persisted to
  // history — same "not cached, always a fresh real request" scope as
  // the briefing endpoint always had) so it reads naturally and gets
  // read aloud too if Wendy's on.
  const [reportLoading, setReportLoading] = useState<"briefing" | "review" | "priorities" | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("weekly");

  async function runBriefing() {
    setReportLoading("briefing");
    const result = await fetchMorningBriefing();
    setReportLoading(null);
    if (!result.ok || !result.briefing) {
      setError(result.error ?? "Couldn't generate a briefing right now.");
      return;
    }
    const msg: PilotBrainMessage = {
      id: `briefing-${Date.now()}`, userId: "pilot-brain", role: "assistant",
      content: result.briefing, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    speak(result.briefing);
  }

  async function runReview() {
    setReportLoading("review");
    const result = await fetchPerformanceReview(reviewPeriod);
    setReportLoading(null);
    if (!result.ok || !result.review) {
      setError(result.error ?? "Couldn't generate a review right now.");
      return;
    }
    const msg: PilotBrainMessage = {
      id: `review-${Date.now()}`, userId: "pilot-brain", role: "assistant",
      content: result.review, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    speak(result.review);
  }

  // V5 (Super Brain), Chief of Staff Mode — real ranked data, no
  // Claude call needed to display it (unlike Briefing/Review, which
  // are AI-written prose), so this is instant and free.
  async function runPriorities() {
    setReportLoading("priorities");
    const result = await fetchTodaysPriorities();
    setReportLoading(null);
    if (!result.ok) {
      setError(result.error ?? "Couldn't load priorities right now.");
      return;
    }
    const content = result.priorities.length === 0
      ? "Nothing urgent stands out right now, Boss — everything's on track."
      : result.priorities.map(p => `${p.rank}. ${p.title} — ${p.detail}`).join("\n");
    const msg: PilotBrainMessage = {
      id: `priorities-${Date.now()}`, userId: "pilot-brain", role: "assistant",
      content, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    speak(content);
  }

  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // A wrong reply sitting in the recent-history window can keep
  // getting echoed back turn after turn even after the underlying
  // issue's fixed — a real incident this session, not a hypothetical.
  // Two-step (click once to arm, click again to confirm) rather than a
  // native confirm() dialog, matching this app's existing two-click
  // delete pattern elsewhere.
  async function handleClearConversation() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setClearing(true);
    setConfirmingClear(false);
    const result = await clearPilotBrainConversation();
    setClearing(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't clear the conversation.");
      return;
    }
    setMessages([]);
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
              title={voiceOutput ? "Wendy reads replies aloud — click to turn off" : "Turn on Wendy reading replies aloud"}
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
              {voiceOutput ? "Wendy: On" : "Wendy: Off"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <label htmlFor="pilot-brain-voice-choice" style={{ color: "#f5f7ff80", fontSize: 12 }}>
            Voice:
          </label>
          <select
            id="pilot-brain-voice-choice"
            value={voiceChoice}
            onChange={e => changeVoice(e.target.value as OpenAiVoice)}
            style={{
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, color: "#f5f7ff", fontSize: 12, padding: "4px 8px",
            }}
          >
            {OPENAI_VOICES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button
            onClick={() => previewVoice(voiceChoice)}
            disabled={previewing !== null}
            className="sn-btn"
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            {previewing === voiceChoice ? "Playing…" : "Try this voice"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={runBriefing}
            disabled={reportLoading !== null}
            className="sn-btn"
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            {reportLoading === "briefing" ? "Thinking…" : "Morning Briefing"}
          </button>

          <label htmlFor="pilot-brain-review-period" style={{ color: "#f5f7ff80", fontSize: 12, marginLeft: 8 }}>
            Review:
          </label>
          <select
            id="pilot-brain-review-period"
            value={reviewPeriod}
            onChange={e => setReviewPeriod(e.target.value as ReviewPeriod)}
            style={{
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, color: "#f5f7ff", fontSize: 12, padding: "4px 8px",
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button
            onClick={runReview}
            disabled={reportLoading !== null}
            className="sn-btn"
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            {reportLoading === "review" ? "Investigating…" : "Get Review"}
          </button>

          <button
            onClick={runPriorities}
            disabled={reportLoading !== null}
            className="sn-btn"
            style={{ fontSize: 12, padding: "4px 10px", marginLeft: 8 }}
          >
            {reportLoading === "priorities" ? "Thinking…" : "Today's Priorities"}
          </button>

          {messages.length > 0 && (
            <button
              onClick={handleClearConversation}
              onBlur={() => setConfirmingClear(false)}
              disabled={clearing}
              className="sn-btn"
              style={{
                fontSize: 12, padding: "4px 10px", marginLeft: 8,
                background: confirmingClear ? "rgba(255,80,80,0.2)" : undefined,
                borderColor: confirmingClear ? "rgba(255,80,80,0.5)" : undefined,
                color: confirmingClear ? "#ff8080" : undefined,
              }}
            >
              {clearing ? "Clearing…" : confirmingClear ? "Click again to confirm" : "Clear Conversation"}
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
