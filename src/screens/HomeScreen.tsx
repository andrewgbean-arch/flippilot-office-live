// src/screens/HomeScreen.tsx

import React from "react";
import { useNavigate } from "react-router-dom";

/* -------------------------------------------------------
   ⭐ REUSABLE COMPONENTS
------------------------------------------------------- */

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        bg-[#0A1128]/80 
        border border-yellow-400 
        rounded-lg py-3 text-xs text-yellow-400 
        hover:bg-yellow-400 hover:text-black 
        transition shadow-[0_0_10px_rgba(250,204,21,0.4)]
      "
    >
      {label}
    </button>
  );
}

function PreviewTile({
  title,
  value,
  band,
  onClick,
}: {
  title: string;
  value: string | number;
  band?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full bg-[#0A1128]/80 
        border border-yellow-400 
        rounded-xl p-5 text-left 
        hover:bg-yellow-400 hover:text-black 
        transition shadow-[0_0_15px_rgba(250,204,21,0.4)]
      "
    >
      <p className="text-gray-300">{title}</p>
      <p className="text-yellow-400 text-3xl font-bold drop-shadow-lg">{value}</p>
      {band && <p className="text-gray-400">{band}</p>}
    </button>
  );
}

function ModuleTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        bg-[#0A1128]/80 
        border border-yellow-400 
        rounded-xl p-6 text-left 
        hover:bg-yellow-400 hover:text-black 
        transition shadow-[0_0_20px_rgba(250,204,21,0.4)]
      "
    >
      <p className="text-xl font-semibold">{label}</p>
    </button>
  );
}

/* -------------------------------------------------------
   ⭐ MAIN SUPERnova HOME SCREEN
------------------------------------------------------- */

export default function HomeScreen() {
  const nav = useNavigate();

  return (
    <div
      className="
        min-h-screen 
        w-full 
        relative 
        overflow-x-hidden 
        overflow-y-auto 
        bg-gradient-to-br from-[#050816] via-[#0A1128] to-black
        px-6 py-10 
        text-white 
        space-y-12
      "
    >
      {/* ⭐ STARFIELD BACKGROUND */}
      <div
        className="
          absolute inset-0 
          bg-[url('/stars.png')] 
          bg-cover bg-center 
          opacity-30 
          pointer-events-none
        "
      />

      {/* ⭐ HERO */}
      <div className="relative p-8 bg-[#0A1128]/80 border border-yellow-400/30 rounded-xl shadow-xl">
        <h1 className="text-5xl font-extrabold text-yellow-400 drop-shadow-lg">
          FlipPilot OS
        </h1>
        <p className="text-gray-300 mt-2 text-lg">
          Supernova Dealer Intelligence • V12
        </p>
      </div>

      {/* ⭐ QUICK ACTIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 relative">
  <QuickAction label="Add Flip" onClick={() => nav("/new-flip")} />
  <QuickAction label="Scan MOT" onClick={() => nav("/mot-scanner")} />
  <QuickAction label="Sales Hub" onClick={() => nav("/dealer/sales")} />
  <QuickAction label="Marketplace" onClick={() => nav("/marketplace")} />
  <QuickAction label="AI Tools" onClick={() => nav("/dealer/intelligence/market")} />
</div>


      {/* ⭐ INTELLIGENCE PREVIEW */}
      <div className="space-y-6 relative">
        <PreviewTile
          title="Dealership Score"
          value="82"
          band="Strong"
          onClick={() => nav("/dealer-dashboard")}
        />
        <PreviewTile
          title="Market Heat"
          value="12 sold"
          band="High"
          onClick={() => nav("/dealer-dashboard")}
        />
        <PreviewTile
          title="Risk Radar"
          value="3 risks"
          band="Medium"
          onClick={() => nav("/dealer-dashboard")}
        />
      </div>

      {/* ⭐ MODULE GRID */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
  <ModuleTile label="Dealer Dashboard" onClick={() => nav("/dealer-dashboard")} />
  <ModuleTile label="Sales Hub" onClick={() => nav("/dealer/sales")} />
  <ModuleTile label="Fleet Intelligence" onClick={() => nav("/dealer/intelligence/motors")} />
  <ModuleTile label="Vehicle Intelligence" onClick={() => nav("/dealer/intelligence/market")} />
  <ModuleTile label="CRM Intelligence" onClick={() => nav("/dealer/intelligence/crm")} />
  <ModuleTile label="Marketing Intelligence" onClick={() => nav("/dealer/marketing")} />
  <ModuleTile label="Sourcing AI" onClick={() => nav("/dealer/workflow/finance")} />
  <ModuleTile label="Strategy Engine" onClick={() => nav("/dealer/intelligence/pricing")} />
  <ModuleTile label="Marketplace" onClick={() => nav("/marketplace")} />
  <ModuleTile label="Tools" onClick={() => nav("/dealer/tools")} />
</div>

    </div>
  );
}


