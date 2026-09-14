import { useState, useEffect } from "react";
import { useAppointments } from "@/context/AppointmentsContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";
import AppointmentReviewModal from "./AppointmentReviewModal";
import { loadBookingSettings, saveBookingSettings, type BookingSettings, type WeekDay } from "./bookingSettingsStorage.web";
import "@/staff/StaffDashboard.css";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  completed: "Completed",
};

const TYPE_LABEL: Record<Appointment["type"], string> = {
  viewing: "Viewing",
  test_drive: "Test Drive",
  mot: "MOT",
};

export default function AppointmentsBoard() {
  const { appointments, loading, update } = useAppointments();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [reviewing, setReviewing] = useState<Appointment | null>(null);

  const bookingUrl = user?.dealershipId ? `${window.location.origin}/book/${user.dealershipId}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the
      // link is still shown in plain text either way, so nothing else
      // to do here.
    }
  }

  const pending = appointments.filter(a => a.status === "pending");
  const decided = appointments
    .filter(a => a.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Booking Requests</h1>
          <p className="sn-hero__subtitle">Viewings, test drives and MOT bookings submitted through your public booking page.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Your Booking Link</h2>
          <p className="sn-timeclock__subtitle">
            Share this with customers — on your website, listings, or social media. Anyone can book a viewing, test
            drive or MOT without an account.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 13, color: "#c7d0ff" }}>
              {bookingUrl}
            </code>
            <button className="sn-btn sn-btn--gold" onClick={copyLink}>
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </section>

        <AvailabilitySettings canEdit={user?.role === "owner" || user?.staffRole === "manager"} />

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Pending{pending.length > 0 ? ` — ${pending.length}` : ""}</h2>
          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="sn-empty">No pending requests.</p>
          ) : (
            <div className="sn-leave-list">
              {pending.map(a => (
                <AppointmentRow key={a.id} appointment={a} onReview={setReviewing} onQuickAction={update} navigate={navigate} />
              ))}
            </div>
          )}
        </section>

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">History</h2>
          {decided.length === 0 ? (
            <p className="sn-empty">Nothing decided yet.</p>
          ) : (
            <div className="sn-leave-list">
              {decided.map(a => (
                <AppointmentRow key={a.id} appointment={a} onReview={setReviewing} onQuickAction={update} navigate={navigate} />
              ))}
            </div>
          )}
        </section>
      </main>

      {reviewing && <AppointmentReviewModal appointment={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

const WEEKDAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Governs what the public booking page offers as bookable slots — see
// publicBooking.ts's availableSlotsFor(). Any staff member can see the
// current settings; only a manager/owner can change them, matching the
// backend's requireStaffRole("manager") gate on the PUT route.
function AvailabilitySettings({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setSettings(await loadBookingSettings());
      setLoading(false);
    })();
  }, []);

  function toggleDay(day: WeekDay) {
    if (!settings) return;
    const openDays = settings.openDays.includes(day)
      ? settings.openDays.filter(d => d !== day)
      : [...settings.openDays, day];
    setSettings({ ...settings, openDays });
    setSaved(false);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const res = await saveBookingSettings(settings);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save availability");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Availability</h2>
      <p className="sn-timeclock__subtitle">Which days and hours customers can request a booking for on your public page.</p>
      {loading || !settings ? (
        <p className="sn-empty">{loading ? "Loading…" : "Could not load availability settings."}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {WEEKDAYS.map(d => (
              <button
                key={d.key}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleDay(d.key)}
                className={`sn-btn ${settings.openDays.includes(d.key) ? "sn-btn--gold" : "sn-btn--ghost"}`}
                style={{ padding: "6px 12px", fontSize: 13 }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: "#9aa5c9" }}>
              Open Time
              <br />
              <input
                type="time"
                value={settings.openTime}
                disabled={!canEdit}
                onChange={e => { setSettings({ ...settings, openTime: e.target.value }); setSaved(false); }}
                style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e6ebff", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 13, color: "#9aa5c9" }}>
              Close Time
              <br />
              <input
                type="time"
                value={settings.closeTime}
                disabled={!canEdit}
                onChange={e => { setSettings({ ...settings, closeTime: e.target.value }); setSaved(false); }}
                style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e6ebff", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 13, color: "#9aa5c9" }}>
              Slot Length (mins)
              <br />
              <input
                type="number"
                min={5}
                step={5}
                value={settings.slotMinutes}
                disabled={!canEdit}
                onChange={e => { setSettings({ ...settings, slotMinutes: Number(e.target.value) }); setSaved(false); }}
                style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e6ebff", marginTop: 4, width: 90 }}
              />
            </label>
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          {canEdit ? (
            <button className="sn-btn sn-btn--gold" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved!" : "Save Availability"}
            </button>
          ) : (
            <p style={{ fontSize: 12, color: "#6b7591" }}>Only a manager or owner can change availability.</p>
          )}
        </>
      )}
    </section>
  );
}

function AppointmentRow({
  appointment,
  onReview,
  onQuickAction,
  navigate,
}: {
  appointment: Appointment;
  onReview: (appointment: Appointment) => void;
  onQuickAction: (id: string, patch: { status: AppointmentStatus }) => Promise<string | null>;
  navigate: (path: string) => void;
}) {
  const badgeClass =
    appointment.status === "confirmed" || appointment.status === "completed"
      ? "sn-timeclock__badge--in"
      : appointment.status === "declined"
        ? "sn-leave-badge--declined"
        : "sn-timeclock__badge--out";

  return (
    <div className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
      <div>
        <div className="sn-recent-lead__name">
          {appointment.customerName} — {TYPE_LABEL[appointment.type]}
        </div>
        <div className="sn-recent-lead__status">
          {appointment.type === "mot" ? `Reg: ${appointment.vehicleLabel}` : appointment.vehicleLabel} ·{" "}
          {appointment.requestedDate} {appointment.requestedTime}
        </div>
        <div className="sn-recent-lead__status">
          {appointment.customerPhone ?? appointment.customerEmail ?? "No contact given"}
          {appointment.notes ? ` · ${appointment.notes}` : ""}
        </div>
        {appointment.leadId && (
          <button
            className="sn-btn sn-btn--ghost"
            style={{ marginTop: 6, padding: "4px 10px", fontSize: 12 }}
            onClick={() => navigate(`/dealer/sales/leads/${appointment.leadId}`)}
          >
            View Lead →
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span className={`sn-timeclock__badge ${badgeClass}`}>{STATUS_LABEL[appointment.status]}</span>
        {(appointment.status === "pending" || appointment.status === "confirmed") && (
          <button className="sn-btn sn-btn--gold" onClick={() => onReview(appointment)}>
            {appointment.status === "pending" ? "Review" : "Change"}
          </button>
        )}
        {appointment.status === "confirmed" && (
          <button className="sn-btn sn-btn--ghost" onClick={() => onQuickAction(appointment.id, { status: "completed" })}>
            Mark Completed
          </button>
        )}
      </div>
    </div>
  );
}
