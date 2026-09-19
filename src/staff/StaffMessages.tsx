import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { loadTeam } from "@/jobs/jobStorage.web";
import type { TeamMember } from "@/jobs/jobTypes";
import { submitStaffMessage, fetchStaffMessages, type StaffMessage } from "@/lib/staffMessagesApi";
import {
  anyUploading,
  canSendMessage,
  readyPhotoIds,
  type PendingMessagePhoto,
} from "@/lib/messagePhotoAttachments";
import MessagePhotoAttachments from "@/components/MessagePhotoAttachments";
import MessagePhotoStrip from "@/components/MessagePhotoStrip";
import "@/staff/StaffDashboard.css";

// Distinct from "Team Message Board" (FeedbackBoard, visible to
// everyone at this dealership) — this is a real 1:1 channel to one
// specific teammate, same shape as the Contact FlipPilot Support
// feature (a message + a real notification to the recipient's own
// account), just scoped within one dealership instead of crossing
// into the platform admin's inbox.
export default function StaffMessages() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PendingMessagePhoto[]>([]);
  // The team list, the message list and a send can all land after the person
  // has left this screen; they're ignored then instead of touching state.
  const mountedRef = useRef(true);
  // Two quick clicks can both arrive before React shows `submitting`.
  const sendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    loadTeam().then(members => {
      if (mountedRef.current) setTeam(members.filter(m => m.id !== user?.id));
    });
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function load() {
    setLoading(true);
    const result = await fetchStaffMessages();
    if (!mountedRef.current) return;
    setLoading(false);
    if (result.ok) setMessages(result.messages);
  }

  const readyIds = readyPhotoIds(photos);
  const uploading = anyUploading(photos);
  // Words or a finished photo, a teammate, nothing still uploading, not already sending.
  const canSend = canSendMessage({ text: message, photos, hasRecipient: !!toUserId, sending: submitting });

  async function handleSend() {
    if (sendingRef.current || !canSend) return;
    sendingRef.current = true;
    setSubmitting(true);
    setError(null);
    let result: { ok: boolean; error?: string };
    try {
      result = await submitStaffMessage(toUserId, message.trim(), readyIds);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
    if (!mountedRef.current) return;
    if (!result.ok) {
      // Keep the words and the photos so it can be sent again as it was.
      setError(result.error ?? "Could not send that message — please try again.");
      return;
    }
    // The photos are part of the message now, so they're just let go of here
    // (not discarded on the server).
    setMessage("");
    setPhotos([]);
    load();
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Message a Teammate</h1>
          <p className="sn-hero__subtitle">
            A private message to one person, not the whole team — they'll get a real notification.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Send a Message</h2>
          <div className="sn-form" style={{ maxWidth: 640 }}>
            {team.length === 0 ? (
              <p className="text-white/50 text-sm">No other teammates on this account yet.</p>
            ) : (
              <>
                <select
                  className="sn-input"
                  value={toUserId}
                  onChange={e => setToUserId(e.target.value)}
                >
                  <option value="">Select a teammate…</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.staffRole ? `(${m.staffRole})` : m.role === "owner" ? "(Owner)" : ""}
                    </option>
                  ))}
                </select>
                <textarea
                  className="sn-input sn-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder={photos.length > 0 ? "Add a note to go with the photos (optional)" : "What's the message?"}
                />
                <MessagePhotoAttachments value={photos} onChange={setPhotos} disabled={submitting} />
                {error && <p style={{ color: "#ff8080", fontSize: 13 }}>{error}</p>}
                <div style={{ marginTop: 12 }}>
                  <button className="sn-btn sn-btn--gold" onClick={handleSend} disabled={!canSend}>
                    {submitting ? "Sending…" : uploading ? "Uploading photos…" : "Send Message"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Messages</h2>
          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="sn-empty">No messages yet.</p>
          ) : (
            <div className="sn-leave-list">
              {messages.map(m => {
                const sentByMe = m.fromUserId === user?.id;
                return (
                  <div key={m.id} className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="sn-recent-lead__name">
                        {sentByMe ? `You → ${m.toUserName}` : `${m.fromUserName} → You`}
                      </div>
                      {m.message?.trim() ? (
                        <p style={{ color: "#f5f7ff", fontSize: 13, margin: "4px 0", whiteSpace: "pre-wrap" }}>
                          {m.message}
                        </p>
                      ) : null}
                      <MessagePhotoStrip photos={m.photos} />
                      <div className="sn-recent-lead__status">{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                    {sentByMe && (
                      <span
                        className={`sn-timeclock__badge ${m.readAt ? "sn-timeclock__badge--in" : "sn-timeclock__badge--out"}`}
                      >
                        {m.readAt ? "Received" : "Sent"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
