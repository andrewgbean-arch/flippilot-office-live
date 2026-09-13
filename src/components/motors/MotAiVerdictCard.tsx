import React from "react";
import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiVerdictCard({ ai, theme }: Props) {
  return (
    <div
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: theme.goldSoftGlow,
      }}
    >
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: theme.accent,
          marginBottom: 6,
        }}
      >
        🤖 MOT AI Verdict
      </h3>

      <p
        style={{
          color: theme.text,
          fontSize: 16,
        }}
      >
        {ai.verdict}
      </p>
    </div>
  );
}
