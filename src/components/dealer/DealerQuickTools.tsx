import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function DealerQuickTools() {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 left-6 flex flex-col gap-3">

      {/* Quick Add Vehicle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="
          px-4 py-2 rounded-lg
          bg-[#0A1128]
          text-white font-semibold
          shadow-lg shadow-blue-500/40
          border border-white/10
        "
        onClick={() => navigate("/dealer/inventory/add")}
      >
        + New Vehicle
      </motion.button>

      {/* Quick Leads */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="
          px-4 py-2 rounded-lg
          bg-[#0A1128]
          text-white font-semibold
          shadow-lg shadow-blue-500/40
          border border-white/10
        "
        onClick={() => navigate("/dealer/sales/add")}
      >
        Leads
      </motion.button>

      {/* Quick Tools Hub */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="
          px-4 py-2 rounded-lg
          bg-[#0A1128]
          text-white font-semibold
          shadow-lg shadow-blue-500/40
          border border-white/10
        "
        onClick={() => navigate("/dealer/tools")}
      >
        Tools Hub
      </motion.button>

    </div>
  );
}

