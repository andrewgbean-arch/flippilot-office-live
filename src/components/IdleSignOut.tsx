import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDealer } from "@/context/DealerContext";
import { autoSignOutMinutes, createIdleWatcher, rememberIdleSignOut } from "@/lib/idleSignOut";

// Signs out of Dealer OS after the owner's chosen quiet time (Settings,
// 15 minutes unless changed, can be turned off), so a computer left signed in
// can't be used by whoever walks up to it. Asks "Still there?" a minute before;
// any mouse, keyboard or touch keeps you in. The rules are in lib/idleSignOut.ts.
// Mounted by ProtectedRoute, so it runs on every signed-in page and nowhere else.

const USE_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

export default function IdleSignOut() {
  const { user, logout } = useAuth();
  const { dealer, loading } = useDealer();
  // Only this dealership's own setting counts (not one left over from an account
  // used earlier in the same tab); if it couldn't be loaded, the default applies.
  const minutes = autoSignOutMinutes(dealer && dealer.id === user?.dealershipId ? dealer.autoSignOutMinutes : undefined);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // logout is a new function on every render of AuthProvider; the timer must
  // not restart because of that.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    // Wait for the dealership's own setting: a longer time or "never" must not
    // be overruled by the default while it loads.
    if (!user || loading || minutes === null) {
      setSecondsLeft(null);
      return;
    }
    const watcher = createIdleWatcher(minutes * 60_000);
    const onUse = () => watcher.use();
    for (const e of USE_EVENTS) window.addEventListener(e, onUse, { capture: true, passive: true });

    const tick = () => {
      const now = watcher.check();
      if (now.state === "sign-out") {
        rememberIdleSignOut(minutes);
        setSecondsLeft(null);
        logoutRef.current();
      } else {
        setSecondsLeft(now.state === "warning" ? Math.ceil(now.msLeft / 1000) : null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
      for (const e of USE_EVENTS) window.removeEventListener(e, onUse, { capture: true });
    };
  }, [user, loading, minutes]);

  if (secondsLeft === null || minutes === null) return null;
  return <StillThereCard minutes={minutes} secondsLeft={secondsLeft} />;
}

// Clicking the button is itself a use (pointerdown above), which is what keeps
// you signed in; the button is there so it's obvious what to do.
export function StillThereCard({ minutes, secondsLeft }: { minutes: number; secondsLeft: number }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div
        role="alertdialog"
        aria-labelledby="still-there-title"
        aria-describedby="still-there-text"
        className="bg-black/90 border border-yellow-400/40 p-6 rounded-xl w-full max-w-md"
      >
        <h2 id="still-there-title" className="text-yellow-300 text-xl font-semibold mb-2">
          Still there?
        </h2>
        <p id="still-there-text" className="text-white/70 text-sm mb-4">
          Dealer OS hasn't been used for {minutes - 1} minutes, so for security it will sign out in{" "}
          <span className="text-white font-semibold">{secondsLeft} seconds</span>. Anything you haven't saved will be
          lost.
        </p>
        <div className="flex justify-end">
          <button type="button" className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300">
            I'm still here
          </button>
        </div>
      </div>
    </div>
  );
}
