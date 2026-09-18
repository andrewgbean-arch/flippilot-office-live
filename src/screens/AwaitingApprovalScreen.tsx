import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

// Shown instead of the whole app while a brand-new dealership is
// waiting on a platform admin's approval. Every business route on the
// backend returns 403 for a pending dealership, so rendering the real
// dashboard here would just be a wall of failed requests — this gives
// the person an honest explanation and a way to re-check without
// logging out and back in.
export default function AwaitingApprovalScreen() {
  const { user, logout, refreshApprovalStatus } = useAuth();
  const [checking, setChecking] = useState(false);

  async function handleCheckAgain() {
    setChecking(true);
    await refreshApprovalStatus();
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-md">
        <SupernovaGlowCard>
          <h1 className="text-yellow-300 font-bold text-2xl mb-3">Almost there{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="text-white/70 mb-3">
            Your dealership account has been created and is waiting for approval. We check every new
            dealership before it goes live — as soon as yours has been reviewed, you'll be able to get
            straight in.
          </p>
          <p className="text-white/50 text-sm mb-6">
            Nothing's wrong and there's nothing you need to do. Check back shortly.
          </p>

          <div className="flex flex-wrap gap-3">
            <SupernovaGlowButton label={checking ? "Checking…" : "Check Again"} onClick={handleCheckAgain} disabled={checking} />
            <button
              onClick={logout}
              className="px-5 py-3 rounded-xl bg-white/10 text-white/70 hover:bg-white/20"
            >
              Log Out
            </button>
          </div>
        </SupernovaGlowCard>
      </div>
    </div>
  );
}
