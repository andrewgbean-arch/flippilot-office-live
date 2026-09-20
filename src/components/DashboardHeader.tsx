import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { useIntelligence } from "@/context/IntelligenceProvider";

interface DashboardHeaderProps {
  // Opens the navigation drawer on phones and narrow windows, where the
  // sidebars are hidden. The button lives INSIDE this bar (not floating over
  // it) so it can never sit on top of the title.
  onOpenMenu?: () => void;
}

export default function DashboardHeader({ onOpenMenu }: DashboardHeaderProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { loading: inventoryLoading, refreshInventory } = useInventory();
  const { loading: intelLoading } = useIntelligence();
  const [manualSyncing, setManualSyncing] = useState(false);

  const syncing = manualSyncing || inventoryLoading || intelLoading;

  // This button used to be labelled "Sync AI" and had no onClick at all: it
  // looked clickable but did nothing. It now re-pulls the stock from the
  // server, which is what the insight numbers in the HUD below are computed
  // from, so it's a real refresh and says so.
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
        bg-black/70 backdrop-blur-xl
        border-b border-yellow-400/20
        shadow-[0_0_30px_rgba(255,215,0,0.25)]
        px-3 sm:px-6 lg:px-10 py-2.5 sm:py-3
        flex items-center justify-between gap-3
        animate-fadeIn
      "
    >
      {/* LEFT — MENU (small screens) + BRAND. min-w-0 lets the title shrink
          and truncate instead of pushing the buttons off the screen. */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="lg:hidden shrink-0 grid place-items-center h-11 w-11 rounded-lg bg-black/60 border border-yellow-400/30 text-yellow-300"
          >
            <FiMenu size={22} />
          </button>
        )}

        <h1 className="min-w-0 truncate text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-wide drop-shadow-lg">
          <span className="text-white">FlipPilot</span>
          <span className="text-yellow-300 ml-2 hidden sm:inline">Dealer Hub</span>
        </h1>

        {/* GOLD COSMIC STRIP */}
        <div className="hidden sm:block shrink-0 w-1.5 h-8 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
      </div>

      {/* RIGHT — REFRESH + USER. The Pricing Brain and Market badges that used
          to sit here are gone: the HUD directly below shows both, so a dealer
          saw the same two signals twice. */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          title="Reload your stock from the server and recalculate the insights"
          className={`
            min-h-[40px] px-3 sm:px-5 rounded-lg text-sm font-semibold
            bg-yellow-400 hover:bg-yellow-300 text-black
            flex items-center gap-2 transition
            shadow-[0_0_15px_rgba(255,215,0,0.5)]
            ${syncing ? "opacity-70 cursor-wait" : ""}
          `}
        >
          <span className={`w-2 h-2 rounded-full ${syncing ? "bg-yellow-700 animate-pulse" : "bg-green-700"}`} />
          {syncing ? "Refreshing…" : "Refresh"}
        </button>

        {user && (
          <div className="flex items-center gap-2 sm:gap-3 sm:pl-4 sm:border-l border-white/10">
            <span className="hidden md:inline max-w-[12rem] truncate text-white/70 text-sm">{user.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-black/50 border border-white/20 text-white/80 hover:text-red-300 hover:border-red-400/40 transition"
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
