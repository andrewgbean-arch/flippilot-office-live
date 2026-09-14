import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { loadPublicDealerName, loadPublicVehicles, submitBooking, type PublicVehicle } from "./publicBookingApi";

// The one page in this app a customer reaches with no account at all.
// Deliberately its own simple layout, not the dealer admin shell —
// nothing here should assume the visitor is logged in, because they
// never are.
export default function PublicBookingPage() {
  const { dealershipId } = useParams();
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState<"viewing" | "test_drive">("viewing");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [dName, vList] = await Promise.all([loadPublicDealerName(dealershipId), loadPublicVehicles(dealershipId)]);
      setDealerName(dName);
      setVehicles(vList);
      setLoading(false);
    })();
  }, [dealershipId]);

  async function handleSubmit() {
    if (!dealershipId || !vehicleId || !name.trim() || !date || !time) return;
    if (!phone.trim() && !email.trim()) {
      setError("Please provide a phone number or email so we can confirm your booking.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitBooking(dealershipId, {
      vehicleId,
      customerName: name.trim(),
      ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
      ...(email.trim() ? { customerEmail: email.trim() } : {}),
      type,
      requestedDate: date,
      requestedTime: time,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong — please try again.");
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1128] text-white flex items-center justify-center p-6">
        <p className="text-white/60">Loading…</p>
      </div>
    );
  }

  if (!dealerName) {
    return (
      <div className="min-h-screen bg-[#0A1128] text-white flex items-center justify-center p-6">
        <p className="text-white/60">This booking page isn't available.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0A1128] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-yellow-300 mb-3">Request Sent</h1>
          <p className="text-white/70">
            Thanks — {dealerName} will be in touch to confirm your {type === "test_drive" ? "test drive" : "viewing"}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-yellow-300 mb-1">{dealerName}</h1>
        <p className="text-white/60 mb-6">Book a viewing or test drive</p>

        {vehicles.length === 0 ? (
          <p className="text-white/60">No vehicles are available to book at the moment.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-white/60 text-sm">Vehicle</label>
              <select
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
              >
                <option value="">Select a vehicle…</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.reg ? `${v.reg} — ` : ""}
                    {v.make} {v.model}
                    {v.year ? `, ${v.year}` : ""}
                    {v.priceRetail ? ` — £${v.priceRetail.toLocaleString()}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-white/60 text-sm">I'd like to</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as "viewing" | "test_drive")}
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
              >
                <option value="viewing">View the vehicle</option>
                <option value="test_drive">Book a test drive</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-sm">Preferred Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm">Preferred Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-white/60 text-sm">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-sm">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
                />
              </div>
            </div>
            <p className="text-white/40 text-xs -mt-2">At least one of phone or email is needed so we can confirm.</p>

            <div>
              <label className="text-white/60 text-sm">Anything else? (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !vehicleId || !name.trim() || !date || !time}
              className="w-full py-3 rounded-lg font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
            >
              {submitting ? "Sending…" : "Request Booking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
