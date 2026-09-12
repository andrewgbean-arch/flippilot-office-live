import React from "react";
import { motion } from "framer-motion";

interface AnimatedHeroHeaderProps {
  title: string;
  className?: string;
}

export default function AnimatedHeroHeader({
  title,
  className = "",
}: AnimatedHeroHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`px-5 pt-2 pb-5 ${className}`}
    >
      <h1 className="text-[32px] font-black text-white">
        {title}
      </h1>
    </motion.div>
  );
}
