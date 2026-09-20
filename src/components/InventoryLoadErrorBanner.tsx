import { useInventory } from "@/context/InventoryProvider";

// Three things can be worth telling the dealer about their stock, and this says
// so plainly rather than showing invented cars or failing silently:
//
//  - It couldn't be LOADED. The list is empty in that state and nothing is
//    saved (a save would replace their real stock with the empty list).
//  - A change couldn't be SAVED (signed out, subscription ended, too big, no
//    connection...). The change is still on screen, kept for another try, but
//    the server doesn't have it yet. Not blocking: they can keep working, and
//    every further edit tries the save again.
//  - A change WAS dropped on purpose: they edited a car that someone else had
//    deleted in the meantime, so there was nothing to save the edit to. Not an
//    error (amber, not red) and nothing to retry, but they must get to read it,
//    so it stays until they press OK.
export default function InventoryLoadErrorBanner() {
  const { loadError, loading, refreshInventory, saveError, isSaving, retrySave, saveNotice, dismissSaveNotice } =
    useInventory();

  if (!loadError && !saveError && !saveNotice) return null;

  return (
    <>
      {loadError && (
        <div
          role="alert"
          className="px-10 py-2 text-sm text-center bg-red-500/20 text-red-200 border-b border-red-500/40"
        >
          We couldn't load your stock, so nothing you change right now can be saved.{" "}
          <button
            onClick={() => refreshInventory()}
            disabled={loading}
            className="underline font-semibold disabled:opacity-60"
          >
            {loading ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="px-10 py-2 text-sm text-center bg-red-500/20 text-red-200 border-b border-red-500/40"
        >
          {saveError} Your changes are still on this screen.{" "}
          <button
            onClick={() => retrySave()}
            disabled={isSaving}
            className="underline font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Try again"}
          </button>
        </div>
      )}
      {saveNotice && (
        <div
          role="status"
          className="px-10 py-2 text-sm text-center bg-amber-500/20 text-amber-100 border-b border-amber-500/40"
        >
          {saveNotice}{" "}
          <button onClick={() => dismissSaveNotice()} className="underline font-semibold">
            OK
          </button>
        </div>
      )}
    </>
  );
}
