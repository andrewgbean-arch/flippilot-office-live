import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsibleProps {
  title: string;
  onOpen?: () => void;
  scrollTo?: () => void;
  children: React.ReactNode;
}

export default function Collapsible({
  title,
  onOpen,
  scrollTo,
  children,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);

    if (next && onOpen) onOpen();
    if (next && scrollTo) scrollTo();
  };

  return (
    <div className="mb-3">
      {/* HEADER */}
      <button
        onClick={toggle}
        className="flex items-center gap-2 py-2 group"
      >
        {/* Reactor Button */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-5 h-5 rounded-md flex items-center justify-center"
        >
          <motion.div
            className="w-[22px] h-[22px] rounded-full border-2 border-[#FFD700] flex items-center justify-center"
            animate={{
              boxShadow: isOpen
                ? "0px 0px 20px rgba(255,215,0,0.6)"
                : "0px 0px 0px rgba(255,215,0,0)",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-[10px] h-[10px] rounded-full bg-[#00A8FF]" />
          </motion.div>
        </motion.div>

        <span className="text-[15px] font-bold text-white">
          {title}
        </span>
      </button>

      {/* CONTENT */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden"
          >
            <motion.div
              className="relative rounded-xl p-4 bg-white/5 border border-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Particle Burst */}
              <motion.div
                className="absolute w-2 h-2 rounded-full bg-white/40"
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, x: 10, y: -10 }}
                transition={{ duration: 0.4 }}
              />

              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
