import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authHeaders } from "@/lib/authToken";

import { BASE_URL } from "@/lib/apiBaseUrl";

type Dealership = {
  id: string;
  name: string;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: string;
  stripeCustomerId?: string;
  pilotBrainEnabled?: boolean;
};

export default function BillingScreen() {
  const [params] = useSearchParams();
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults on — Pilot Brain is the premium pitch, opt-out rather
  // than opt-in reads better for conversion, and it's still a real,
  // visible, unchecked-if-they-want choice, not a dark pattern (no
  // pre-ticked box hidden below the fold — it's right here).
  const [includePilotBrain, setIncludePilotBrain] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/dealership/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.ok) setDealership(data.dealership);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubscribe() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/billing/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ includePilotBrain }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't start checkout");
        setActionLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server");
      setActionLoading(false);
    }
  }

  async function handleManageBilling() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/billing/portal`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't open billing portal");
        setActionLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server");
      setActionLoading(false);
    }
  }

  if (loading) {
    return <p className="text-white/60 p-10">Loading billing info…</p>;
  }

  if (!dealership) {
    return <p className="text-white/60 p-10">Couldn't load your dealership.</p>;
  }

  const trialDaysLeft = Math.max(
    0,
    Math.ceil((new Date(dealership.trialEndsAt).getTime() - Date.now()) / 86400000)
  );
  const trialActive = dealership.subscriptionStatus === "trialing" && trialDaysLeft > 0;

  const statusLabel =
    dealership.subscriptionStatus === "active"
      ? "Active"
      : trialActive
      ? `Trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
      : dealership.subscriptionStatus === "past_due"
      ? "Payment failed"
      : dealership.subscriptionStatus === "trialing"
      ? "Trial ended"
      : "Canceled";

  const statusColor =
    dealership.subscriptionStatus === "active"
      ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/60"
      : trialActive
      ? "text-yellow-300 bg-yellow-500/20 border-yellow-500/60"
      : "text-red-300 bg-red-500/20 border-red-500/60";

  return (
    <div className="px-6 py-10 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-yellow-300">Billing</h1>
        <p className="text-white/60 mt-1">{dealership.name}</p>
      </div>

      {params.get("success") === "true" && (
        <p className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm">
          Subscription confirmed — thank you! It may take a few seconds to
          fully activate.
        </p>
      )}
      {params.get("canceled") === "true" && (
        <p className="text-white/60 bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-sm">
          Checkout was canceled — no charge was made.
        </p>
      )}

      <div className="bg-black/40 border border-yellow-400/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-white/70">Plan status</span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {dealership.subscriptionStatus === "active" && (
          <div className="flex items-center justify-between">
            <span className="text-white/70">Pilot Brain add-on</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
              dealership.pilotBrainEnabled
                ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/60"
                : "text-white/50 bg-white/5 border-white/20"
            }`}>
              {dealership.pilotBrainEnabled ? "Active" : "Not added"}
            </span>
          </div>
        )}

        {error && (
          <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {dealership.subscriptionStatus === "active" ? (
          <>
            {!dealership.pilotBrainEnabled && (
              <p className="text-white/50 text-sm">
                Want Pilot Brain — your always-on business companion, watching, explaining, and checking the market for a fraction of the cost of a part-time member of staff? Add it from the billing portal below.
              </p>
            )}
            <button
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-lg bg-black/50 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-black/70 transition disabled:opacity-50"
            >
              {actionLoading ? "Opening…" : "Manage Billing"}
            </button>
          </>
        ) : (
          <>
            <label className="flex items-start gap-3 bg-black/30 border border-white/10 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePilotBrain}
                onChange={e => setIncludePilotBrain(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-white/80">
                <span className="font-semibold text-yellow-300">Include Pilot Brain</span> — your always-on business companion.
                Watches your leads and stock, explains what's happening and why, and can compare your prices with dealer listings. A fraction of the cost of a part-time member of staff.
              </span>
            </label>
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {actionLoading ? "Starting checkout…" : "Subscribe Now"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
