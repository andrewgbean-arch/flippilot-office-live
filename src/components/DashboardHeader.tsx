import { useLocation } from "react-router-dom";

export default function DashboardHeader() {
  const { pathname } = useLocation();

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
        px-10 py-6 flex items-center justify-between
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

      {/* RIGHT — STATUS + SYNC */}
      <div className="flex items-center gap-5">

        {/* BRAIN MODE BADGE */}
        <div className="
          px-3 py-1 rounded-lg text-sm font-semibold
          bg-black/50 border border-yellow-400/30
          text-yellow-300 shadow-[0_0_12px_rgba(255,215,0,0.4)]
        ">
          Pricing Brain
        </div>

        {/* MARKET TREND BADGE */}
        <div className="
          px-3 py-1 rounded-lg text-sm font-semibold
          bg-black/50 border border-green-400/30
          text-green-300 shadow-[0_0_12px_rgba(0,255,0,0.4)]
        ">
          Market Rising
        </div>

        {/* SYNC BUTTON */}
        <button
          className="
            px-5 py-2 rounded-lg text-sm font-semibold
            bg-yellow-400 hover:bg-yellow-300 text-black
            flex items-center gap-2 transition
            shadow-[0_0_15px_rgba(255,215,0,0.5)]
          "
        >
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Sync AI
        </button>
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
