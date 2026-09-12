import React from "react";
import AnimatedPressable from "@/components/ui/AnimatedPressable.web";

import { Wrench, Gauge, FileText } from "lucide-react";

export default function VehicleActionsRow() {
  return (
    <div className="flex gap-4 mt-6">

      <AnimatedPressable
        className="px-4 py-3 rounded-xl bg-black/40 border border-yellow-400/30 shadow-md hover:bg-black/60 transition-all"
        onClick={() => console.log("AI Pricing")}
      >
        <div className="flex items-center gap-2">
          <Gauge size={18} color="#FFD700" />
          <span className="font-semibold text-white">AI Pricing</span>
        </div>
      </AnimatedPressable>

      <AnimatedPressable
        className="px-4 py-3 rounded-xl bg-black/40 border border-yellow-400/30 shadow-md hover:bg-black/60 transition-all"
        onClick={() => console.log("MOT History")}
      >
        <div className="flex items-center gap-2">
          <FileText size={18} color="#FFD700" />
          <span className="font-semibold text-white">MOT History</span>
        </div>
      </AnimatedPressable>

      <AnimatedPressable
        className="px-4 py-3 rounded-xl bg-black/40 border border-yellow-400/30 shadow-md hover:bg-black/60 transition-all"
        onClick={() => console.log("Recon Workflow")}
      >
        <div className="flex items-center gap-2">
          <Wrench size={18} color="#FFD700" />
          <span className="font-semibold text-white">Recon Plan</span>
        </div>
      </AnimatedPressable>

    </div>
  );
}
