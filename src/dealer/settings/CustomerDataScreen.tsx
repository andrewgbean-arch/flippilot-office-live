import { useState, type FormEvent } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { useAuth } from "@/context/AuthContext";
import {
  downloadCustomerData,
  eraseCustomerData,
  searchCustomerData,
  type CustomerDataResult,
  type CustomerRecord,
} from "@/lib/customerDataApi";

// A short line naming each record found, from whichever fields it has.
function describe(record: CustomerRecord): string {
  const r = (record.record as CustomerRecord | undefined) ?? record;
  const name = r.name ?? r.customerName ?? r.buyer ?? "Unnamed";
  const what = r.vehicleLabel ?? r.vehicleInterest ?? r.invoiceNumber ?? [r.make, r.model].filter(Boolean).join(" ");
  return [name, what].filter(Boolean).join(" · ");
}

// When a customer asks what the dealership holds about them, or asks to be
// deleted (UK GDPR). Search by the email or phone they gave, download what is
// found to send them, and erase it. Sales stay, because the law says so.
// Owner and managers only, as on the server.
export default function CustomerDataScreen() {
  const { user } = useAuth();
  const allowed = user?.role === "owner" || user?.staffRole === "manager";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<CustomerDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const who = () => ({ ...(email.trim() ? { email: email.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) });

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    setConfirming(false);
    const res = await searchCustomerData(who());
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      return setError(res.error);
    }
    setResult(res);
  }

  async function erase() {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    setBusy(true);
    setError(null);
    const res = await eraseCustomerData(who());
    setBusy(false);
    if (!res.ok) return setError(res.error);
    const total = Object.values(res.erased).reduce((a, b) => a + b, 0);
    setNote(
      `Erased ${total} record${total === 1 ? "" : "s"}.` +
        (res.keptSales > 0
          ? ` ${res.keptSales === 1 ? "The 1 sale stays" : `The ${res.keptSales} sales stay`}, because the law requires a business to keep its sales and invoice records (six years for HMRC).`
          : "")
    );
    setResult(null);
  }

  const found = result ? result.places.reduce((n, p) => n + p.records.length, 0) + result.recentlyDeleted.length : 0;

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-3xl mx-auto">
      <SupernovaHeroHeader title="Customer data requests" subtitle="When someone asks what you hold about them, or asks you to delete it" />

      {!allowed ? (
        <SupernovaGlowCard>
          <p className="text-white/70">Only the owner or a manager can handle a customer's data request. Pass it on to one of them.</p>
        </SupernovaGlowCard>
      ) : (
        <>
          <SupernovaGlowCard className="mb-6">
            <p className="text-white/70 text-sm mb-4">
              Search with the email address or phone number the person gave you. Names aren't used, because two people can share a
              name and erasing the wrong customer can't be undone. You have one month to answer a request.
            </p>
            <form onSubmit={search} className="flex flex-col gap-3">
              <label className="text-sm text-white/80">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full p-2 rounded bg-black/40 border border-white/10 text-white"
                  autoComplete="off"
                />
              </label>
              <label className="text-sm text-white/80">
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full p-2 rounded bg-black/40 border border-white/10 text-white"
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="self-start px-5 py-2 min-h-[44px] rounded-full bg-yellow-400 text-black font-bold text-sm disabled:opacity-50"
              >
                {busy && !result ? "Searching…" : "Search"}
              </button>
            </form>
          </SupernovaGlowCard>

          {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
          {note && <p className="text-green-400 text-sm mb-4" role="status">{note}</p>}

          {result && (
            <SupernovaGlowCard>
              <h2 className="text-yellow-300 font-bold text-xl mb-3">
                {found + result.keptSales.length === 0 ? "Nothing found" : "What we hold"}
              </h2>

              {found + result.keptSales.length === 0 ? (
                <p className="text-white/70 text-sm">No records match that email or phone number.</p>
              ) : (
                <>
                  <ul className="text-sm space-y-3 mb-4">
                    {result.places
                      .filter((p) => p.records.length > 0)
                      .map((p) => (
                        <li key={p.key}>
                          <p className="text-white font-semibold">{p.label} ({p.records.length})</p>
                          {p.records.map((r) => (
                            <p key={r.id} className="text-white/60 text-xs">{describe(r)}</p>
                          ))}
                        </li>
                      ))}
                    {result.recentlyDeleted.length > 0 && (
                      <li>
                        <p className="text-white font-semibold">Recently deleted ({result.recentlyDeleted.length})</p>
                        {result.recentlyDeleted.map((r) => (
                          <p key={r.id} className="text-white/60 text-xs">{describe(r)}</p>
                        ))}
                      </li>
                    )}
                    {result.keptSales.length > 0 && (
                      <li>
                        <p className="text-white font-semibold">Sales ({result.keptSales.length}), kept</p>
                        {result.keptSales.map((r) => (
                          <p key={r.id} className="text-white/60 text-xs">{describe(r)}</p>
                        ))}
                        <p className="text-white/50 text-xs mt-1">{result.keptNote}</p>
                      </li>
                    )}
                  </ul>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => downloadCustomerData(result)}
                      className="px-4 py-2 min-h-[44px] rounded-full bg-yellow-400 text-black font-bold text-sm"
                    >
                      Download to send them
                    </button>
                    {found > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={erase}
                        onBlur={() => setConfirming(false)}
                        className="px-4 py-2 min-h-[44px] rounded-full border border-red-400/60 text-red-300 text-sm disabled:opacity-50"
                      >
                        {busy ? "Erasing…" : confirming ? `Click again to erase ${found} record${found === 1 ? "" : "s"} for good` : "Erase everything except sales"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </SupernovaGlowCard>
          )}
        </>
      )}
    </div>
  );
}
