import { useLocation } from "react-router-dom";

export default function DealerRightSidebar() {
  const { pathname } = useLocation();

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  return (
    <aside
      className="
        w-60 h-screen fixed right-0 top-0
        bg-black/40 backdrop-blur-xl
        border-l border-yellow-400/20
        shadow-[0_0_40px_rgba(255,215,0,0.25)]
        p-6 flex flex-col relative overflow-hidden
        animate-fadeIn
      "
    >

      {/* GOLD COSMIC EDGE */}
      <div
        className="
          absolute left-0 top-0 h-full w-[3px]
          bg-yellow-400 opacity-90
          shadow-[0_0_25px_rgba(255,215,0,0.9)]
        "
      />

      {/* PARTICLE FIELD */}
      <div
        className="
          absolute inset-0 pointer-events-none opacity-20
          bg-[radial-gradient(circle_at_30%_20%,rgba(255,215,0,0.25),transparent_45%)]
          animate-pulse
        "
      />

      {/* ⭐ HIDE SYSTEM STATUS ON HOMESCREEN */}
      {!isHome && (
        <>
          {/* HEADER */}
          <h2 className="text-yellow-300 font-bold text-xl mb-6 tracking-wider drop-shadow-[0_0_6px_rgba(255,215,0,0.6)]">
            System Status
          </h2>

          {/* STATUS BLOCK */}
          <div className="text-white/80 space-y-4 text-sm">

            {/* AI ENGINE */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <p className="hover:text-yellow-300 transition">AI Engine: Online</p>
            </div>

            {/* DEALER MODE */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full" />
              <p className="hover:text-yellow-300 transition">Dealer Mode: Active</p>
            </div>

            {/* SYNC STATUS */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <p className="hover:text-yellow-300 transition">Sync Status: Syncing</p>
            </div>

            {/* SUPERNOVA CORE */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full" />
              <p className="hover:text-yellow-300 transition">Supernova Core: Stable</p>
            </div>

            {/* BRAIN MODE */}
            <div className="mt-4 p-3 bg-black/30 border border-yellow-400/20 rounded-lg">
              <p className="text-yellow-300 font-semibold">Brain Mode</p>
              <p className="text-white/70 text-sm">Pricing Brain</p>
            </div>

          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="mt-auto pt-10 text-white/40 text-xs">
        FlipPilot © 2026
      </div>

      {/* ANIMATIONS */}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
