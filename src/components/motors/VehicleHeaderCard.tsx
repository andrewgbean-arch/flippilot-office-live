import React from "react";
import { motion } from "framer-motion";

type Props = {
  year: string | number;
  make: string;
  model: string;
  reg: string;
  theme: any;
};

export default function VehicleHeaderCard({
  year,
  make,
  model,
  reg,
  theme,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 pb-2 border-b-2"
      style={{ borderColor: theme.goldDeep }}
    >
      <h1
        className="font-black mb-1"
        style={{
          fontSize: 30,
          color: theme.accent,
          textShadow: `0 0 10px ${theme.goldSoftGlow}`,
        }}
      >
        {year} {make} {model}
      </h1>

      <p
        className="font-semibold tracking-wide"
        style={{
          fontSize: 18,
          color: theme.text,
        }}
      >
        {reg}
      </p>
    </motion.div>
  );
}
