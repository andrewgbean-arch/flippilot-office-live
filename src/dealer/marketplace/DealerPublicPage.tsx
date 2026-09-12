import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A1128] flex flex-col items-center justify-center text-white">
      
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-gold drop-shadow-lg">
          FlipPilot Dealer OS
        </h1>
        <p className="text-lg opacity-80 mt-2">
          Premium Intelligence • Gold Piping • Supernova V2 Glow
        </p>
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-3xl px-6">
        <Link
          to="/dealer/dashboard"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          Dashboard
        </Link>

        <Link
          to="/dealer/inventory"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          Inventory
        </Link>

        <Link
          to="/dealer/risk"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          Risk Analysis
        </Link>

        <Link
          to="/dealer/ai"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          AI Insights
        </Link>

        <Link
          to="/dealer/analytics"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          Analytics
        </Link>

        <Link
          to="/dealer/tools"
          className="bg-black/40 border border-gold rounded-xl p-6 text-center hover:bg-black/60 transition"
        >
          Tools
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-16 opacity-60 text-sm">
        FlipPilot OS • Supernova V2 • Gold Piping Edition
      </div>
    </div>
  );
}
