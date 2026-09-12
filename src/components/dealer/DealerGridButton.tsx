import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

type DealerGridButtonProps = {
  label: string;
  href: string;
};

export default function DealerGridButton({ label, href }: DealerGridButtonProps) {
  const navigate = useNavigate();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="
        w-full
        px-4 py-3
        rounded-xl
        bg-[#0A1128]
        text-white font-semibold
        shadow-lg shadow-blue-500/40
        border border-white/10
        text-left
      "
      onClick={() => navigate(href)}
    >
      {label}
    </motion.button>
  );
}
