import { useInventory } from "@/context/InventoryProvider";

// Shown when the dealer's stock couldn't be loaded. The list is empty in
// that state and nothing is saved (a save would replace their real
// stock with the empty list), so this says so plainly and offers a
// retry rather than showing invented cars or failing silently.
export default function InventoryLoadErrorBanner() {
  const { loadError, loading, refreshInventory } = useInventory();

  if (!loadError) return null;

  return (
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
  );
}
