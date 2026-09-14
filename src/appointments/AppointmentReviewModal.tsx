import { useState } from "react";
import { useAppointments } from "@/context/AppointmentsContext";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";

interface AppointmentReviewModalProps {
  appointment: Appointment;
  onClose: () => void;
}

// The customer's requested slot often doesn't suit the dealer — this
// lets staff adjust the date/time (not just accept-as-is or decline
// outright) before confirming, and offers a real mailto to let the
// customer know the actual agreed time if it changed.
export default function AppointmentReviewModal({ appointment, onClose }: AppointmentReviewModalProps) {
  const { update } = useAppointments();
  const [date, setDate] = useState(appointment.requestedDate);
  const [time, setTime] = useState(appointment.requestedTime);
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<AppointmentStatus | null>(null);

  const timeChanged = date !== appointment.requestedDate || time !== appointment.requestedTime;

  async function handleSave(status?: AppointmentStatus) {
    setSaving(true);
    setError(null);
    const err = await update(appointment.id, {
      requestedDate: date,
      requestedTime: time,
      notes,
      ...(status ? { status } : {}),
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setSavedStatus(status ?? appointment.status);
  }

  if (savedStatus) {
    const mailto = appointment.customerEmail
      ? `mailto:${appointment.customerEmail}?subject=${encodeURIComponent(
          `Your ${appointment.type === "test_drive" ? "test drive" : "viewing"} — ${appointment.vehicleLabel}`
        )}&body=${encodeURIComponent(
          [
            `Hi ${appointment.customerName},`,
            ``,
            savedStatus === "confirmed"
              ? timeChanged
                ? `We'd like to confirm your ${appointment.type === "test_drive" ? "test drive" : "viewing"} for ${date} at ${time} (your original request was ${appointment.requestedDate} at ${appointment.requestedTime}). Let us know if that works.`
                : `Your ${appointment.type === "test_drive" ? "test drive" : "viewing"} is confirmed for ${date} at ${time}.`
              : `Unfortunately we're unable to confirm your requested slot — please get in touch and we'll find a time that works.`,
            ``,
            `Thanks,`,
          ].join("\n")
        )}`
      : null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-sm">
          <h2 className="text-white/80 text-xl font-semibold mb-3">
            {savedStatus === "confirmed" ? "Confirmed" : savedStatus === "declined" ? "Declined" : "Saved"}
          </h2>
          {mailto ? (
            <>
              <p className="text-white/60 text-sm mb-4">Let the customer know by email:</p>
              <a
                href={mailto}
                className="block text-center px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 mb-4"
              >
                Email Customer
              </a>
            </>
          ) : (
            <p className="text-white/60 text-sm mb-4">
              No email on file — {appointment.customerPhone ? `call ${appointment.customerPhone}` : "no contact details"} to let them know.
            </p>
          )}
          <button onClick={onClose} className="w-full px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-sm">
        <h2 className="text-white/80 text-xl font-semibold mb-1">{appointment.customerName}</h2>
        <p className="text-white/50 text-sm mb-4">
          {appointment.vehicleLabel} · {appointment.type === "test_drive" ? "Test Drive" : "Viewing"}
        </p>

        <label className="text-white/60 text-sm">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-3"
        />

        <label className="text-white/60 text-sm">Time</label>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-3"
        />

        {timeChanged && (
          <p className="text-yellow-300/80 text-xs mb-3">
            Changed from the customer's request ({appointment.requestedDate} at {appointment.requestedTime}).
          </p>
        )}

        <label className="text-white/60 text-sm">Internal Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleSave("confirmed")}
            disabled={saving}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400"
          >
            {timeChanged ? "Confirm New Time" : "Confirm"}
          </button>
          {timeChanged && (
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
            >
              Save Time Change Only (still pending)
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave("declined")}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
