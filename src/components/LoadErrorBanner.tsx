import { useState, useSyncExternalStore } from "react";
import { getLoadFailures, listLabels, subscribeToLoadFailures } from "@/lib/loadFailures";

// Shown when some of the dealer's data couldn't be loaded. That data is
// empty on screen and changes to it are held back (a save would replace
// their real records with the empty list), so this says so plainly and
// offers a retry, instead of an empty list that looks like "you have
// none". One banner covers every provider that reported a failure.
export default function LoadErrorBanner() {
  const failures = useSyncExternalStore(subscribeToLoadFailures, getLoadFailures);
  const [retrying, setRetrying] = useState(false);

  if (failures.length === 0) return null;

  async function retry() {
    setRetrying(true);
    await Promise.all(failures.map(f => f.retry()));
    setRetrying(false);
  }

  return (
    <div
      role="alert"
      className="px-10 py-2 text-sm text-center bg-red-500/20 text-red-200 border-b border-red-500/40"
    >
      We couldn't load your {listLabels(failures.map(f => f.label))}, so changes to{" "}
      {failures.length === 1 ? "it" : "them"} are paused to protect what's already saved.{" "}
      <button
        onClick={retry}
        disabled={retrying}
        className="underline font-semibold disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
