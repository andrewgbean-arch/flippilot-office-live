import React from "react";
import { motion } from "framer-motion";
import { affordabilityEngine, BuyerProfile } from "@/features/dealer-ai/AffordabilityEngine";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { formatMoney } from "@/lib/formatMoney";

type Props = {
  vehicle: FlipRecord;
  buyer: BuyerProfile;
  theme: any;
};

export default function AffordabilitySummaryCard({ vehicle, buyer, theme }: Props) {
  const score = affordabilityEngine.affordabilityScore(vehicle, buyer);
  const band = affordabilityEngine.matchBand(score);
  const recommendedDeposit = affordabilityEngine.recommendedDeposit(vehicle, buyer);

  return (
    <motion.div
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      className="relative p-6 rounded-xl border mb-6"
      style={{
        backgroundColor: theme.card,
        borderColor: theme.goldSoftGlow,
        boxShadow: `0 0 20px ${theme.accent}55`,
      }}
    >
      {/* Shimmer overlay */}
      <motion.div
        initial={{ opacity: 0.15 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse" }}
        className="absolute inset-0"
        style={{
          backgroundColor: theme.goldSoftGlow,
          pointerEvents: "none",
        }}
      />

      {/* Title Row */}
      <div className="flex items-center gap-3 relative">
        <span className="text-2xl">💷</span>

        <span
          style={{
            color: theme.accent,
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          Buyer Affordability
        </span>

        <div
          className="ml-auto px-3 py-1 rounded-md"
          style={{ backgroundColor: theme.accent }}
        >
          <span
            style={{
              color: theme.background,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            ESTIMATE
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-3"
        style={{
          height: 1,
          backgroundColor: theme.cardElevated,
          opacity: 0.4,
        }}
      />

      {/* Content */}
      <div className="relative">
        <div style={{ color: theme.white, fontSize: 16, marginTop: 10 }}>
          Affordability Score: {score}/100
        </div>

        <div style={{ color: theme.secondary, fontSize: 16 }}>
          Match Band: {band}
        </div>

        <div style={{ color: theme.white, marginTop: 10 }}>
          Recommended Deposit: {formatMoney(recommendedDeposit)}
        </div>

        <div style={{ color: theme.muted, marginTop: 6 }}>
          A rough guide from the figures entered, not a lender's decision. Higher is easier to finance.
        </div>

        <div
          style={{
            height: 3,
            marginTop: 14,
            borderRadius: 3,
            backgroundColor: theme.goldSoftGlow,
            opacity: 0.55,
          }}
        />
      </div>
    </motion.div>
  );
}
