import React from "react";
import { motAiEngine, MotAiResult } from "@/engines/motAiEngine";




type Props = {
  ai: MotAiResult;
  theme: any;
};



export default function MotAiRadarChart({ ai, theme }: Props) {
  const items = [
    { label: "Health", value: ai.healthScore },
    { label: "Mileage", value: ai.mileageRisk },
    { label: "Advisories", value: ai.advisorySeverity },
    { label: "Failures", value: ai.failureSeverity },
    { label: "Pass Chance", value: ai.predictedPassChance },
  ];

  return (
    <div
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        🧭 MOT AI Radar Chart
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div
            style={{
              color: theme.text,
              marginBottom: 4,
              fontWeight: "600",
            }}
          >
            {item.label}
          </div>

          <div
            style={{
              height: 10,
              backgroundColor: theme.blackSoft,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${item.value}%`,
                height: "100%",
                backgroundColor: theme.accent,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
