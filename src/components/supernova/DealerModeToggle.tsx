import React, { useState } from "react";

export default function DealerModeToggle() {
  const [mode, setMode] = useState("Dealer");

  return (
    <div className="
      bg-black/40 
      border border-yellow-400/20 
      rounded-xl 
      p-4 
      backdrop-blur-xl 
      flex 
      items-center 
      justify-between
      mt-6
    ">
      <span className="text-white/80 font-semibold">Mode: {mode}</span>

      <button
        onClick={() => setMode(mode === "Dealer" ? "Admin" : "Dealer")}
        className="
          px-4 
          py-2 
          bg-yellow-500 
          text-black 
          font-bold 
          rounded-lg 
          hover:bg-yellow-400 
          transition
        "
      >
        Switch
      </button>
    </div>
  );
}
