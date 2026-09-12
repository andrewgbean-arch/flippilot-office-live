import React from "react";
import { FiCpu, FiActivity, FiTrendingUp, FiZap, FiShield } from "react-icons/fi";

export default function SupernovaDealerHeader() {
  return (
    <div className="
      w-full 
      bg-black/40 
      border border-yellow-400/20 
      rounded-2xl 
      p-5 
      backdrop-blur-xl 
      shadow-[0_0_25px_rgba(255,215,0,0.25)]
      flex 
      items-center 
      justify-between
      animate-fadeIn
    ">
      
      <div>
        <h1 className="text-2xl font-bold text-yellow-300 tracking-wide">
          Dealer OS • Supernova V14 Cosmic
        </h1>
        <p className="text-white/60 text-sm">Operational Intelligence Layer</p>
      </div>

      <div className="flex items-center gap-6 text-white/80">

        <div className="flex items-center gap-2">
          <FiCpu className="text-yellow-300" />
          <span>AI Engine: <strong className="text-yellow-300">Online</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <FiZap className="text-blue-300" />
          <span>Dealer Mode: <strong className="text-blue-300">Active</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <FiActivity className="text-green-300" />
          <span>Sync: <strong className="text-green-300">Stable</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <FiTrendingUp className="text-purple-300" />
          <span>Market: <strong className="text-purple-300">Rising</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <FiShield className="text-red-300" />
          <span>Risk: <strong className="text-red-300">Medium</strong></span>
        </div>

      </div>
    </div>
  );
}
