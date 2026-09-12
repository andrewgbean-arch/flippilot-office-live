import React from "react";
import { motion } from "framer-motion";

type DealerFabProps = {
  vehicleId?: string | number;
};

export default function DealerFab({ vehicleId }: DealerFabProps) {
  return (
    <motion.button
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="
        fixed bottom-6 right-6
        px-5 py-3
        rounded-full
        bg-[#0A1128]
        text-white font-semibold
        shadow-lg shadow-blue-500/40
        border border-white/10
      "
      onClick={() => {
        window.location.href = `/dealer/workflow/finance?id=${vehicleId ?? ""}`;
      }}
    >
      Dealer V9
    </motion.button>
  );
}
