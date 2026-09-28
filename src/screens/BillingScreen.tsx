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

type CreditTransaction = {
  id: string;
  at: string;
  kind: "grant" | "spend" | "topup" | "refund";
  amountPence: number;
  description: string;
};

type CreditSummary = {
  balancePence: number;
  rateCardPence: { webLookup: number; voiceReply: number };
  monthlyGrantPence: number;
  recentTransactions: CreditTransaction[];
};

// The two real plans (routes/billing.ts's PlanId) — prices shown here are
// what the dealer is actually charged; the server is the real source of
// truth for whether each one can currently be bought (billing/options).
type PlanId = "core" | "core_pilot_brain";
const PLANS: { id: PlanId; name: string; settling: number; standard: number; blurb: string }[] = [
  {
    id: "core",
    name: "Dealer OS",
    settling: 99,
    standard: 149,
    blurb: "Stock, leads, the books, staff and rota, your public store — everything except Pilot Brain.",
  },
  {
    id: "core_pilot_brain",
    name: "Dealer OS + Pilot Brain",
    settling: 249,
    standard: 299,
    blurb:
      "Everything in Dealer OS, plus Pilot Brain — your always-on business companion, watching, explaining, and checking the market for a fraction of the cost of a part-time member of staff. Includes £30/month of usage credit for her voice and live web lookups.",
  },
];

type BillingOptions = {
  plans: Record<PlanId, boolean>;
  settlingMonths: number;
  subscribedAt: string | null;
};

const TOPUP_AMOUNTS_PENCE = [1000, 2500, 5000] as const;
const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function BillingScreen() {
  const [params] = useSearchParams();
  const [dealership, setDealership] = useState<Dealership | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("core_pilot_brain");
  // Which plans checkout can really start (both the plan's real Stripe
  // Prices are configured), when this dealership's current subscription
  // began, and how many months the settling-in price runs for. Until we
  // know, or when a plan isn't available, it isn't offered: picking it used
  // to change nothing, and the dealer believed they'd bought it.
  const [options, setOptions] = useState<BillingOptions | null>(null);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/billing/options`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setOptions(data?.ok ? data : null))
      .catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    fetch(`${BASE_URL}/pilot-brain/credit`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setCredit(data?.ok ? data : null))
      .catch(() => setCredit(null));
  }, [params]);

  async function handleTopUp(amountPence: number) {
    setTopUpLoading(amountPence);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/pilot-brain/credit/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amountPence }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn't start top-up checkout");
        setTopUpLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server");
      setTopUpLoading(null);
    }
  }

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
        body: JSON.stringify({ plan: selectedPlan }),
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

  const currentPlan = PLANS.find(p => p.id === (dealership.pilotBrainEnabled ? "core_pilot_brain" : "core"))!;
  const offeredPlans = PLANS.filter(p => options?.plans?.[p.id]);

  // A price rise only means anything while it's still ahead — a dealership
  // subscribed well over settlingMonths ago is already on the standard
  // price, and saying otherwise would just be wrong.
  let priceRiseDate: Date | null = null;
  if (dealership.subscriptionStatus === "active" && options?.subscribedAt) {
    const rise = new Date(options.subscribedAt);
    rise.setMonth(rise.getMonth() + options.settlingMonths);
    if (rise.getTime() > Date.now()) priceRiseDate = rise;
  }

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
      {params.get("topupSuccess") === "true" && (
        <p className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm">
          Top-up confirmed — thank you! Your usage credit below may take a few seconds to update.
        </p>
      )}
      {params.get("topupCanceled") === "true" && (
        <p className="text-white/60 bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-sm">
          Top-up canceled — no charge was made.
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
            <span className="text-white/70">Plan</span>
            <span className="text-yellow-300 font-semibold text-sm">{currentPlan.name}</span>
          </div>
        )}
        {priceRiseDate && (
          <p className="text-white/40 text-xs">
            Your settling-in price runs until {formatDate(priceRiseDate.toISOString())}, then it rises to {money(currentPlan.standard * 100)}/month.
          </p>
        )}

        {error && (
          <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {dealership.subscriptionStatus === "active" ? (
          <button
            onClick={handleManageBilling}
            disabled={actionLoading}
            className="w-full py-2.5 rounded-lg bg-black/50 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-black/70 transition disabled:opacity-50"
          >
            {actionLoading ? "Opening…" : "Manage Billing"}
          </button>
        ) : offeredPlans.length === 0 ? (
          <p className="text-white/50 text-sm">
            Subscribing isn't set up on this server yet — contact support.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {offeredPlans.map(plan => (
                <label
                  key={plan.id}
                  className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer border ${
                    selectedPlan === plan.id ? "bg-yellow-500/10 border-yellow-400/60" : "bg-black/30 border-white/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    checked={selectedPlan === plan.id}
                    onChange={() => setSelectedPlan(plan.id)}
                    className="mt-1"
                  />
                  <span className="text-sm text-white/80">
                    <span className="font-semibold text-yellow-300">
                      {plan.name} — {money(plan.settling * 100)}/month for the first {options?.settlingMonths ?? 6} months, then {money(plan.standard * 100)}/month
                    </span>
                    <br />
                    {plan.blurb}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-white/40 text-xs">
              Prices exclude VAT; we are not currently VAT registered so none is added. The price rise after the settling-in period is shown here, in the terms, and on this page as it approaches.
            </p>
            <button
              onClick={handleSubscribe}
              disabled={actionLoading || !offeredPlans.some(p => p.id === selectedPlan)}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {actionLoading ? "Starting checkout…" : "Subscribe Now"}
            </button>
          </>
        )}
      </div>

      {credit && (
        <div className="bg-black/40 border border-yellow-400/20 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-yellow-300">Pilot Brain usage credit</h2>
            <p className="text-white/50 text-sm mt-1">
              Pays for a live web lookup ({money(credit.rateCardPence.webLookup)} each) and a spoken reply ({money(credit.rateCardPence.voiceReply)} each) — figures are estimates until real costs are measured, and will be adjusted. Ordinary text chat with Pilot Brain isn't metered here.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/70">Credit remaining</span>
            <span className={`text-lg font-bold ${credit.balancePence > 0 ? "text-emerald-300" : "text-red-300"}`}>
              {money(credit.balancePence)}
            </span>
          </div>

          {credit.monthlyGrantPence > 0 && (
            <p className="text-white/40 text-xs">Renews with {money(credit.monthlyGrantPence)} on the 1st of each month.</p>
          )}
          {credit.monthlyGrantPence === 0 && (
            <p className="text-white/40 text-xs">
              No monthly credit yet — that starts once Pilot Brain is a paid part of your subscription. Top up below to try voice or a web lookup now.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {TOPUP_AMOUNTS_PENCE.map(amountPence => (
              <button
                key={amountPence}
                onClick={() => handleTopUp(amountPence)}
                disabled={topUpLoading !== null}
                className="px-4 py-2 rounded-lg bg-black/50 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-black/70 transition disabled:opacity-50"
              >
                {topUpLoading === amountPence ? "Starting…" : `Top up ${money(amountPence)}`}
              </button>
            ))}
          </div>

          {credit.recentTransactions.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <p className="text-white/50 text-xs uppercase tracking-wide">Recent activity</p>
              {credit.recentTransactions.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{t.description}</span>
                  <span className={t.amountPence < 0 ? "text-white/60" : "text-emerald-300"}>
                    {t.amountPence < 0 ? "-" : "+"}
                    {money(Math.abs(t.amountPence))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
