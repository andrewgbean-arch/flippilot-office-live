import { useState } from "react";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDealer } from "@/context/DealerContext";
import { AUTO_SIGN_OUT_CHOICES, autoSignOutMinutes } from "@/lib/idleSignOut";

// How long Dealer OS can sit unused before it signs out (components/IdleSignOut.tsx).
// The owner chooses, for everyone in the dealership; everyone else sees what it is.

export function choiceLabel(minutes: number): string {
  if (minutes === 0) return "Never";
  if (minutes === 60) return "1 hour";
  return minutes === 15 ? "15 minutes (recommended)" : `${minutes} minutes`;
}

export function AutoSignOutCardView({
  current,
  canChange,
  saving,
  error,
  onChoose,
}: {
  current: number | null;
  canChange: boolean;
  saving: boolean;
  error: string | null;
  onChoose: (minutes: number) => void;
}) {
  return (
    <SupernovaGlowCard>
      <h2 className="text-yellow-300 font-bold text-xl mb-3">Automatic Sign-Out</h2>
      <p className="text-white/70 mb-4">
        Signs everyone out when Dealer OS hasn't been used for a while, so a computer left signed in on the showroom
        floor or in the workshop can't be used by whoever walks up to it. A minute before, it asks if you're still
        there.
      </p>

      {canChange ? (
        <>
          <label htmlFor="auto-sign-out" className="text-white/60 text-sm block mb-1">
            Sign out when nobody's used it
          </label>
          <select
            id="auto-sign-out"
            value={current ?? 0}
            disabled={saving}
            onChange={(e) => onChoose(Number(e.target.value))}
            className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
          >
            {AUTO_SIGN_OUT_CHOICES.map((m) => (
              <option key={m} value={m}>
                {choiceLabel(m)}
              </option>
            ))}
          </select>
          {current === null && (
            <p className="text-white/50 text-xs mt-2">
              Only choose Never if every computer is somewhere nobody else can get to it.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-white/60">
          {current === null
            ? "Turned off by the owner."
            : `Dealer OS signs out after ${current} minutes with nobody using it.`}{" "}
          Only the owner can change this.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-400 text-sm mt-3">
          {error}
        </p>
      )}
    </SupernovaGlowCard>
  );
}

export default function AutoSignOutCard() {
  const { user } = useAuth();
  const { dealer, updateDealer } = useDealer();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(minutes: number) {
    setSaving(true);
    setError(null);
    try {
      await updateDealer({ autoSignOutMinutes: minutes });
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AutoSignOutCardView
      current={autoSignOutMinutes(dealer?.autoSignOutMinutes)}
      canChange={user?.role === "owner"}
      saving={saving}
      error={error}
      onChoose={choose}
    />
  );
}
