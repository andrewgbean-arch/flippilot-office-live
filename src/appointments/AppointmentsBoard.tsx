import { useState } from "react";
import { useAppointments } from "@/context/AppointmentsContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";
import AppointmentReviewModal from "./AppointmentReviewModal";
import "@/staff/StaffDashboard.css";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  completed: "Completed",
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
          <h1 className="sn-hero__title">Viewing &amp; Test Drive Requests</h1>
          <p className="sn-hero__subtitle">Real bookings submitted through your public booking page.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Your Booking Link</h2>
          <p className="sn-timeclock__subtitle">
            Share this with customers — on your website, listings, or social media. Anyone can book a viewing or
            test drive from your current stock without an account.
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
          {appointment.customerName} — {appointment.type === "test_drive" ? "Test Drive" : "Viewing"}
        </div>
        <div className="sn-recent-lead__status">
          {appointment.vehicleLabel} · {appointment.requestedDate} {appointment.requestedTime}
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
