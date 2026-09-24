import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";

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
  const [manualSyncing, setManualSyncing] = useState(false);
  // Log Out lives in a small account menu, not beside Refresh, where it was
  // one mis-tap away on a phone.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [accountOpen]);
  useEffect(() => setAccountOpen(false), [pathname]);

  const syncing = manualSyncing || inventoryLoading;

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

        {/* The brand, not a heading: each page carries its own h1. */}
        {/* Same brand as the FlipPilot app: the logo's swirly gold script,
            then the product name in gold, widely spaced capitals. */}
        <p className="min-w-0 truncate flex items-baseline gap-3">
          <span className="brand-script text-[2.1rem] sm:text-[2.6rem] lg:text-[3rem]" data-text="FlipPilot">FlipPilot</span>
          <span className="brand-caps hidden sm:inline text-xs lg:text-sm">DEALER OS</span>
        </p>

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
          <div ref={accountRef} className="relative sm:pl-4 sm:border-l border-white/10">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={`Account menu for ${user.name}`}
              className="min-h-[40px] flex items-center gap-2 rounded-lg px-1.5 sm:px-2 hover:bg-white/5 transition"
            >
              <span className="grid place-items-center h-9 w-9 rounded-full bg-yellow-400/15 border border-yellow-400/50 text-yellow-300 text-sm font-bold">
                {initials(user.name)}
              </span>
              <span className="hidden md:inline max-w-[12rem] truncate text-white/80 text-sm">{user.name}</span>
            </button>
            {accountOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-yellow-400/30 bg-[#0b1230] shadow-2xl p-2 z-50">
                <p className="px-3 py-2 text-sm text-white font-semibold truncate">{user.name}</p>
                <p className="px-3 pb-2 text-xs text-white/50 truncate border-b border-white/10">{user.email}</p>
                <Link role="menuitem" to="/dealer/settings" className="block mt-1 px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-yellow-300">Settings</Link>
                <Link role="menuitem" to="/billing" className="block px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-yellow-300">Billing</Link>
                <button role="menuitem" type="button" onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10">
                  Log out
                </button>
              </div>
            )}
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "");
  return letters.toUpperCase() || "?";
}
