import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FiX } from "react-icons/fi";

import DealerSidebar from "../components/DealerSidebar";
import DealerRightSidebar from "../components/DealerRightSidebar";

import SupernovaDealerHUD from "../components/dealer/SupernovaDealerHUD";
import DashboardHeader from "../components/DashboardHeader";
import DashboardFooter from "../components/DashboardFooter";
import ErrorBoundary from "../components/ErrorBoundary";
import LoadErrorBanner from "../components/LoadErrorBanner";
import TrialBanner from "../components/TrialBanner";
import InventoryLoadErrorBanner from "../components/InventoryLoadErrorBanner";

import { useInventory } from "@/context/InventoryProvider";
import { computeDealerHudStats } from "@/lib/dealerHudStats";
import PageAccessGate from "@/components/PageAccessGate";
import PageHelp from "@/tour/PageHelp";

export default function DealerLayout() {
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { vehicles, loading: inventoryLoading } = useInventory();

  // Counted straight from the stock on every render (a few dozen cars), so a
  // car marked sold or given an MOT date shows up at once.
  const hud = computeDealerHudStats(vehicles, new Date());
  // Only the very first fetch says "loading"; a refresh keeps the last figures on screen.
  const stockLoading = inventoryLoading && vehicles.length === 0;

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  const hideHUD = isHome;

  return (
    <div className="min-h-screen w-full flex bg-[#050505] text-white relative overflow-hidden">

      {/* COSMIC BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0A0A14] to-[#1A1A2A] opacity-80 pointer-events-none z-0" />
      <div className="absolute inset-0 sn-stars pointer-events-none z-0" />

      {/* MOBILE MENU — the fixed 240px+240px sidebars below don't fit a
          phone/narrow window at all (they were overlapping the whole
          viewport and squeezing content to nothing), so both sidebars are
          hidden below the lg breakpoint and the header's menu button opens
          the left one as a full-height drawer instead. The button lives in
          the header (see DashboardHeader) rather than floating over it, where
          it used to sit on top of the title. */}

      {/* LEFT SIDEBAR — desktop */}
      <aside className="hidden lg:block w-60 h-screen fixed left-0 top-0 z-20 backdrop-blur-xl bg-black/40 border-r border-yellow-400/20">
        <DealerSidebar />
      </aside>

      {/* LEFT SIDEBAR — mobile drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 h-screen bg-black/95 backdrop-blur-xl border-r border-yellow-400/20 overflow-y-auto">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 grid place-items-center h-11 w-11 rounded-lg bg-black/60 border border-yellow-400/30 text-yellow-300"
              aria-label="Close menu"
            >
              <FiX size={20} />
            </button>
            <DealerSidebar />
          </div>
          <div
            className="flex-1 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      {/* RIGHT SIDEBAR — desktop only; secondary status info, not worth
          a second mobile drawer */}
      <aside className="hidden lg:block w-60 h-screen fixed right-0 top-0 z-20 backdrop-blur-xl bg-black/40 border-l border-yellow-400/20">
        <DealerRightSidebar />
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 lg:ml-60 lg:mr-60 min-h-screen overflow-y-auto relative z-10">

        <DashboardHeader onOpenMenu={() => setMobileNavOpen(true)} />
        <LoadErrorBanner />
        <TrialBanner />
        <InventoryLoadErrorBanner />

        {/* The snapshot bar is one slim strip of counts from the dealer's own
            stock. A second banner used to sit under it repeating an invented
            market/risk/FlipScore line, which pushed every page's own content
            further down. */}
        {!hideHUD && (
          <div className="px-3 sm:px-6 lg:px-10 pt-3 lg:pt-4 relative z-30">
            <SupernovaDealerHUD loading={stockLoading} stats={hud} />
          </div>
        )}

        {/* PAGE CONTENT. Padding steps up with the screen: it was a flat 40px
            on every side, which on a 375px phone left about 295px for the page. */}
        <main className="px-3 pt-4 pb-28 sm:px-6 sm:pt-6 lg:p-10 lg:pb-32 relative z-30">
          <div className="relative animate-fadeIn">
            {/* key=pathname remounts the boundary on navigation, so
                leaving a crashed page clears its error state instead of
                it sticking around; the sidebar/header stay up either
                way since they're outside this boundary. */}
            <ErrorBoundary key={pathname} fullScreen={false}>
              <PageAccessGate>
                <Outlet />
              </PageAccessGate>
            </ErrorBoundary>
            <PageHelp />
          </div>
        </main>

      </div>

      {/* STARFIELD CSS */}
      <style>{`
        .sn-stars {
          background-image: radial-gradient(white 1px, transparent 1px),
                            radial-gradient(white 1px, transparent 1px);
          background-size: 3px 3px, 2px 2px;
          background-position: 0 0, 20px 20px;
          opacity: 0.15;
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <DashboardFooter />

    </div>
  );
}