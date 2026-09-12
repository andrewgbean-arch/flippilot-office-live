import React from "react";

export default function SupernovaFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-flipDark text-white">

      <div
        className="
          w-full
          bg-flipGlass 
          rounded-xl 
          border border-gold/20 
          shadow-goldGlow 
          backdrop-blur-xl
          p-8
        "
      >
        {children}
      </div>

    </div>
  );
}
