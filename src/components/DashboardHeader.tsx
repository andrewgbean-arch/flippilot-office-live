import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";
import { computeDealerHudStats } from "@/lib/dealerHudStats";

export default function DashboardHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { vehicles, loading: inventoryLoading, refreshInventory } = useInventory();
  const { flipScores, riskScores, marketIntel, motHealth, loading: intelLoading } =
    useIntelligence();
  const [manualSyncing, setManualSyncing] = useState(false);

  const hud = computeDealerHudStats(
    vehicles,
    inventoryLoading || intelLoading,
    flipScores,
    riskScores,
    marketIntel,
    motHealth
  );

  const syncing = manualSyncing || inventoryLoading || intelLoading;

  // "Sync AI" used to be a button with no onClick at all — it looked
  // clickable but did nothing. This re-pulls inventory from the backend,
  // which is what the intelligence numbers across the HUD are computed
  // from, so it's a real refresh rather than a decorative spinner.
  async function handleSync() {
    if (syncing) return;
    setManualSyncing(true);
    try {
      await refreshInventory();
    } finally {
      setManualSyncing(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  if (isHome) return null; // ⭐ Hide header on HomeScreen

  return (
    <header
      className="
        w-full sticky top-0 z-50
        bg-black/40 backdrop-blur-xl
        border-b border-yellow-400/20
        shadow-[0_0_30px_rgba(255,215,0,0.25)]
        px-4 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-y-3
        animate-fadeIn
      "
    >

      {/* LEFT — BRAND */}
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-wide drop-shadow-lg">
          <span className="text-white">FlipPilot</span>
          <span className="text-yellow-300 ml-2">Dealer Hub</span>
        </h1>

        {/* GOLD COSMIC STRIP */}
        <div className="w-2 h-10 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
      </div>

      {/* RIGHT — STATUS + SYNC. flex-wrap so on a normal laptop-width
          screen (below ~1400px) these drop to a second line instead of
          overflowing off the right edge — they used to run past the
          viewport and get clipped by the layout's overflow-hidden,
          which made the Log Out button at the end completely
          unreachable on anything but a very wide window. */}
      <div className="flex flex-wrap items-center justify-end gap-3 lg:gap-5">

        {/* BRAIN MODE BADGE — decorative status, hidden below lg to give
            the essential controls (sync/user/logout) room to stay put */}
        <div className="
          hidden lg:block
          px-3 py-1 rounded-lg text-sm font-semibold
          bg-black/50 border border-yellow-400/30
          text-yellow-300 shadow-[0_0_12px_rgba(255,215,0,0.4)]
        ">
          Pricing Brain
        </div>

        {/* MARKET TREND BADGE — real fleet-wide demand trend, computed
            from IntelligenceProvider's per-vehicle market intel */}
        <div className={`
          hidden lg:block
          px-3 py-1 rounded-lg text-sm font-semibold border shadow-[0_0_12px_rgba(0,0,0,0.2)]
          ${hud.marketTrend === "rising"
            ? "bg-black/50 border-green-400/30 text-green-300 shadow-[0_0_12px_rgba(0,255,0,0.4)]"
            : hud.marketTrend === "falling"
            ? "bg-black/50 border-red-400/30 text-red-300 shadow-[0_0_12px_rgba(255,0,0,0.4)]"
            : "bg-black/50 border-white/20 text-white/70"}
        `}>
          Market {hud.marketTrend === "rising" ? "Rising" : hud.marketTrend === "falling" ? "Falling" : "Flat"}
        </div>

        {/* SYNC BUTTON — re-pulls inventory from the backend, which is
            what every number in this header/HUD is computed from */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`
            px-5 py-2 rounded-lg text-sm font-semibold
            bg-yellow-400 hover:bg-yellow-300 text-black
            flex items-center gap-2 transition
            shadow-[0_0_15px_rgba(255,215,0,0.5)]
            ${syncing ? "opacity-70 cursor-wait" : ""}
          `}
        >
          <span className={`w-2 h-2 rounded-full ${syncing ? "bg-yellow-700 animate-pulse" : "bg-green-400"}`} />
          {syncing ? "Syncing…" : "Sync AI"}
        </button>

        {/* USER + LOGOUT */}
        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-white/10">
            <span className="text-white/70 text-sm">{user.name}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/50 border border-white/20 text-white/70 hover:text-red-300 hover:border-red-400/40 transition"
            >
              Log Out
            </button>
          </div>
        )}
      </div>

      {/* ANIMATIONS */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
