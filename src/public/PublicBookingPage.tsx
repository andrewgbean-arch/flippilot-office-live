import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  loadPublicDealerName,
  loadPublicVehicles,
  loadAvailableSlots,
  submitBooking,
  type PublicVehicle,
} from "./publicBookingApi";

type BookingType = "viewing" | "test_drive" | "mot";

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
  const [customerVehicleReg, setCustomerVehicleReg] = useState("");
  const [type, setType] = useState<BookingType>("viewing");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
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

  // Real bookable times for the chosen date — closed days/outside-hours
  // times and anything already taken never appear at all, rather than
  // letting the customer pick a time the dealer then has to reject.
  useEffect(() => {
    if (!dealershipId || !date) {
      setSlots([]);
      return;
    }
    setTime("");
    setSlotsLoading(true);
    loadAvailableSlots(dealershipId, date).then(s => {
      setSlots(s);
      setSlotsLoading(false);
    });
  }, [dealershipId, date]);

  const vehicleReady = type === "mot" ? customerVehicleReg.trim().length > 0 : vehicleId.length > 0;

  async function handleSubmit() {
    if (!dealershipId || !vehicleReady || !name.trim() || !date || !time) return;
    if (!phone.trim() && !email.trim()) {
      setError("Please provide a phone number or email so we can confirm your booking.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitBooking(dealershipId, {
      ...(type === "mot" ? { customerVehicleReg: customerVehicleReg.trim() } : { vehicleId }),
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

  const typeCopy = type === "test_drive" ? "test drive" : type === "mot" ? "MOT" : "viewing";

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
            Thanks — {dealerName} will be in touch to confirm your {typeCopy}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-yellow-300 mb-1">{dealerName}</h1>
        <p className="text-white/60 mb-6">Book a viewing, test drive or MOT</p>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-sm">I'd like to</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as BookingType)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
            >
              <option value="viewing">View a vehicle</option>
              <option value="test_drive">Book a test drive</option>
              <option value="mot">Book an MOT</option>
            </select>
          </div>

          {type === "mot" ? (
            <div>
              <label className="text-white/60 text-sm">Your Vehicle Registration</label>
              <input
                type="text"
                value={customerVehicleReg}
                onChange={e => setCustomerVehicleReg(e.target.value.toUpperCase())}
                placeholder="e.g. AB12 CDE"
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1"
              />
            </div>
          ) : vehicles.length === 0 ? (
            <p className="text-white/60">No vehicles are available to book at the moment.</p>
          ) : (
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
          )}

          {type === "mot" || vehicles.length > 0 ? (
            <>
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
                  <select
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    disabled={!date || slotsLoading}
                    className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1 disabled:opacity-50"
                  >
                    <option value="">
                      {!date ? "Pick a date first" : slotsLoading ? "Loading…" : slots.length === 0 ? "No times available" : "Select a time…"}
                    </option>
                    {slots.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
                disabled={submitting || !vehicleReady || !name.trim() || !date || !time}
                className="w-full py-3 rounded-lg font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
              >
                {submitting ? "Sending…" : "Request Booking"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
