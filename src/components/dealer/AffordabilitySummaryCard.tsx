import React from "react";
import { motion } from "framer-motion";
import { affordabilityEngine, BuyerProfile } from "@/features/dealer-ai/AffordabilityEngine";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { formatMoney } from "@/lib/formatMoney";
import ScoreGauge, { type BandEdges } from "@/components/ScoreGauge";

// Its own Match Band (Green from 75, Yellow from 45) sits right under the gauge, so the
// gauge's Good starts where Green does and the two never disagree.
const AFFORDABILITY_EDGES: BandEdges = [25, 45, 75, 90];

type Props = {
  vehicle: FlipRecord;
  buyer: BuyerProfile;
  theme: any;
};

export default function AffordabilitySummaryCard({ vehicle, buyer, theme }: Props) {
  const score = affordabilityEngine.affordabilityScore(vehicle, buyer);
  const band = affordabilityEngine.matchBand(score);
  const depositAdvice = affordabilityEngine.depositAdvice(vehicle, buyer);

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
        <div className="flex justify-center" style={{ marginTop: 10 }}>
          <ScoreGauge score={score} label="Affordability score" edges={AFFORDABILITY_EDGES} />
        </div>

        <div style={{ color: theme.secondary, fontSize: 16 }}>
          Match Band: {band}
        </div>

        <div style={{ color: theme.white, marginTop: 10 }}>
          {depositAdvice === null ? (
            <>Deposit guide: add the buyer's income and a price for the car to see one.</>
          ) : (
            <>
              Deposit to keep the monthly payment within 15% of income: {formatMoney(depositAdvice.needed)}
              {depositAdvice.short && (
                <span style={{ color: theme.muted }}>
                  {" "}— more than the {formatMoney(depositAdvice.have)} entered as deposit and savings
                </span>
              )}
            </>
          )}
        </div>

        <div style={{ color: theme.muted, marginTop: 6 }}>
          A rough guide from the figures entered (48 months at about 8-19% APR depending on the buyer), not a lender's decision. A higher score is easier to finance.
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
