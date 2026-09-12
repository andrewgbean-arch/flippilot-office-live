import React from "react";
import { Outlet, useLocation } from "react-router-dom";

import DealerSidebar from "../components/DealerSidebar";
import DealerRightSidebar from "../components/DealerRightSidebar";

import SupernovaDealerHUD from "../components/dealer/SupernovaDealerHUD";
import DashboardHeader from "../components/DashboardHeader";
import DashboardFooter from "../components/DashboardFooter";

export default function DealerLayout() {
  const { pathname } = useLocation();

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

      {/* LEFT SIDEBAR */}
      <aside className="w-60 h-screen fixed left-0 top-0 z-20 backdrop-blur-xl bg-black/40 border-r border-yellow-400/20">
        <DealerSidebar />
      </aside>

      {/* RIGHT SIDEBAR */}
      <aside className="w-60 h-screen fixed right-0 top-0 z-20 backdrop-blur-xl bg-black/40 border-l border-yellow-400/20">
        <DealerRightSidebar />
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 ml-60 mr-60 min-h-screen overflow-y-auto relative z-10">

        <DashboardHeader />

        {!hideHUD && (
          <>
            <div className="px-10 pt-6 relative z-30">
              <SupernovaDealerHUD
                aiSync="syncing"
                marketTrend="rising"
                brainMode="Pricing Brain"
                riskLevel="medium"
                flipScore={87}
                motHealth="watch"
              />
            </div>

            <div className="px-10 mt-6 relative z-30">
              <div className="bg-black/40 border border-yellow-400/30 rounded-xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(255,215,0,0.25)]">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                <p className="text-white/80 text-sm">
                  Supernova V14: Market volatility rising • Pricing Brain adjusting valuations.
                </p>
              </div>
            </div>
          </>
        )}

        {/* PAGE CONTENT */}
        <main className="p-10 pb-32 relative z-30">
          <div className="relative animate-fadeIn">
            <Outlet />
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