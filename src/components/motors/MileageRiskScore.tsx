import React from "react";
import { motion } from "framer-motion";

export default function MileageRiskScore({ listing }: { listing: any }) {
  const mileage = listing?.mileage || 0;

  let risk = 50;

  // Mileage tiers
  if (mileage > 180000) risk += 30;
  else if (mileage > 150000) risk += 25;
  else if (mileage > 120000) risk += 20;
  else if (mileage > 100000) risk += 15;
  else if (mileage > 80000) risk += 10;
  else if (mileage > 60000) risk += 5;
  else risk -= 10;

  // Age synergy
  const year = listing?.vehicle?.year || 2010;
  const age = new Date().getFullYear() - year;

  if (age > 12 && mileage > 120000) risk += 10;
  if (age > 15 && mileage > 150000) risk += 15;

  // Service history mitigation
  if (listing?.serviceHistory === "full") risk -= 15;
  else if (listing?.serviceHistory === "partial") risk -= 5;

  // Cap risk
  risk = Math.min(100, Math.max(0, risk));

  const getColor = () => {
    if (risk <= 40) return "#4CAF50"; // low
    if (risk <= 70) return "#FFD700"; // medium
    return "#FF5252"; // high
  };

  const getLabel = () => {
    if (risk <= 40) return "Low Mileage Risk";
    if (risk <= 70) return "Medium Mileage Risk";
    return "High Mileage Risk";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-4 bg-[#0A0F1F] p-5 rounded-xl border border-gold shadow-xl"
    >
      <h3 className="text-gold font-bold text-lg mb-2">
        Mileage Risk Score
      </h3>

      <p
        className="font-bold text-xl"
        style={{ color: getColor() }}
      >
        {getLabel()} ({risk}/100)
      </p>

      <p className="text-white/70 mt-3">
        This score reflects mileage, age, and service history.
      </p>
    </motion.div>
  );
}
