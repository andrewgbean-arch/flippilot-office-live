import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

type Dealership = {
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: string;
};

// The backend already blocks inventory/leads/staff once a trial ends
// (402 Payment Required) — this banner is the frontend half, so that
// shows up as a clear message instead of a cryptic failed API call.
export default function TrialBanner() {
  const [dealership, setDealership] = useState<Dealership | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/dealership/me`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.ok) setDealership(data.dealership);
      })
      .catch(() => {});
  }, []);

  if (!dealership || dealership.subscriptionStatus === "active") return null;

  const daysLeft = Math.ceil(
    (new Date(dealership.trialEndsAt).getTime() - Date.now()) / 86400000
  );

  if (dealership.subscriptionStatus === "trialing" && daysLeft > 3) return null;

  const expired = daysLeft <= 0 || dealership.subscriptionStatus !== "trialing";

  return (
    <div
      className={`px-10 py-2 text-sm text-center ${
        expired
          ? "bg-red-500/20 text-red-200 border-b border-red-500/40"
          : "bg-yellow-500/20 text-yellow-200 border-b border-yellow-500/40"
      }`}
    >
      {expired ? (
        <>Your trial has ended — data access is paused. </>
      ) : (
        <>Your trial ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}. </>
      )}
      <Link to="/billing" className="underline font-semibold">
        Subscribe now
      </Link>
    </div>
  );
}
