import { useEffect, useRef, useState } from "react";
import { useFeedback } from "@/context/FeedbackContext";
import { useAuth } from "@/context/AuthContext";
import { canManageStaff } from "@/lib/permissions";
import type { MessagePhoto } from "@/lib/messagePhotosApi";
import {
  anyUploading,
  canSendMessage,
  readyPhotoIds,
  type PendingMessagePhoto,
} from "@/lib/messagePhotoAttachments";
import MessagePhotoAttachments from "@/components/MessagePhotoAttachments";
import MessagePhotoStrip from "@/components/MessagePhotoStrip";
import type { FeedbackStatus } from "./feedbackTypes";
import "@/staff/StaffDashboard.css";

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  actioned: "Actioned",
};

export default function FeedbackBoard() {
  const { entries, loading, submit, decide, refresh } = useFeedback();
  const { user } = useAuth();
  const isManager = canManageStaff(user);

  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PendingMessagePhoto[]>([]);
  // A post can finish sending after the person has left this screen; that
  // late result is ignored instead of touching state.
  const mountedRef = useRef(true);
  // Two quick clicks can both arrive before React shows `submitting`.
  const sendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Opening the board fetches it again: the list is otherwise only loaded at
  // login, so other people's new posts wouldn't show, and photo links from a
  // board left open for a day would have expired. Runs once per visit.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyIds = readyPhotoIds(photos);
  const uploading = anyUploading(photos);
  // Words or a finished photo, nothing still uploading, not already sending.
  const canSubmit = canSendMessage({ text: message, photos, sending: submitting });

  async function handleSubmit() {
    if (sendingRef.current || !canSubmit) return;
    sendingRef.current = true;
    setSubmitting(true);
    setError(null);
    let err: string | null;
    try {
      err = await submit(message.trim(), anonymous, readyIds);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
    if (!mountedRef.current) return;
    if (err) {
      // Keep the words and the photos so it can be posted again as it was.
      setError(err);
      return;
    }
    // The photos are part of the post now, so they're just let go of here
    // (not discarded on the server).
    setMessage("");
    setAnonymous(false);
    setPhotos([]);
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Team Message Board</h1>
          <p className="sn-hero__subtitle">
            An internal space for your own team — anyone at this dealership can post here, visible to the rest of your staff. Post anonymously if you'd rather.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Post a Message</h2>
          <div className="sn-form" style={{ maxWidth: 640 }}>
            <textarea
              className="sn-input sn-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder={photos.length > 0 ? "Add a note to go with the photos (optional)" : "What's on your mind?"}
            />
            <MessagePhotoAttachments value={photos} onChange={setPhotos} disabled={submitting} />
            <label className="sn-checkbox-row">
              <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
              Post anonymously — your name won't be recorded against this at all
            </label>
            {anonymous && (
              <p style={{ color: "#a9b4ff", fontSize: 12, margin: 0 }}>
                Photos on an anonymous post don't record your name either.
              </p>
            )}
            {error && <p style={{ color: "#ff8080", fontSize: 13 }}>{error}</p>}
            <div style={{ marginTop: 12 }}>
              <button className="sn-btn sn-btn--gold" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? "Sending…" : uploading ? "Uploading photos…" : "Submit"}
              </button>
            </div>
          </div>
        </section>

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Messages</h2>
          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="sn-empty">Nothing posted yet — be the first.</p>
          ) : (
            <div className="sn-leave-list">
              {entries.map(entry => (
                <FeedbackRow key={entry.id} entry={entry} isManager={isManager} onDecide={decide} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FeedbackRow({
  entry,
  isManager,
  onDecide,
}: {
  entry: {
    id: string;
    userName: string | null;
    message: string;
    photos?: MessagePhoto[];
    status: FeedbackStatus;
    createdAt: string;
  };
  isManager: boolean;
  onDecide: (id: string, status: FeedbackStatus) => Promise<string | null>;
}) {
  const badgeClass =
    entry.status === "actioned"
      ? "sn-timeclock__badge--in"
      : entry.status === "reviewed"
        ? "sn-leave-badge--declined"
        : "sn-timeclock__badge--out";

  return (
    <div className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sn-recent-lead__name">{entry.userName ?? "Anonymous"}</div>
        {entry.message?.trim() ? (
          <p style={{ color: "#f5f7ff", fontSize: 13, margin: "4px 0" }}>{entry.message}</p>
        ) : null}
        <MessagePhotoStrip photos={entry.photos} />
        <div className="sn-recent-lead__status">{new Date(entry.createdAt).toLocaleString()}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span className={`sn-timeclock__badge ${badgeClass}`}>{STATUS_LABEL[entry.status]}</span>
        {isManager && entry.status !== "reviewed" && (
          <button className="sn-btn sn-btn--ghost" onClick={() => onDecide(entry.id, "reviewed")}>
            Mark Reviewed
          </button>
        )}
        {isManager && entry.status !== "actioned" && (
          <button className="sn-btn sn-btn--gold" onClick={() => onDecide(entry.id, "actioned")}>
            Mark Actioned
          </button>
        )}
      </div>
    </div>
  );
}
