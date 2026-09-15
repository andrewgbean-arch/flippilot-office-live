import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import PublicDealerPage from "@/public/PublicDealerPage";

// This used to be its own fully separate implementation, pulling from
// the logged-in dealer's authenticated data (useInventory/useDealer)
// rather than the real public endpoints — meaning what a dealer saw
// here as a "preview" could silently differ from what the actual
// /public/:dealershipId/* routes exposed. Now it renders the exact
// same component the real public page uses, just pointed at your own
// dealershipId, so this genuinely IS the preview — no drift possible.
export default function DealerPublicPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const storeUrl = user?.dealershipId ? `${window.location.origin}/store/${user.dealershipId}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the
      // link is still shown in plain text either way.
    }
  }

  return (
    <div>
      <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-6 py-4">
        <p className="text-yellow-300 font-semibold mb-2">This is your real public page — anyone can view it, no login needed.</p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="px-3 py-2 bg-black/40 rounded text-sm text-white/80">{storeUrl}</code>
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {user?.dealershipId && <PublicDealerPage dealershipIdOverride={user.dealershipId} />}
    </div>
  );
}
