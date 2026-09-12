import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult | null;
  theme: any;
};

export default function MotAiRiskGauge({ ai, theme }: Props) {
  // Null guard
  if (!ai) {
    return (
      <div
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: 14,
        }}
      >
        <p style={{ opacity: 0.6 }}>AI data unavailable</p>
      </div>
    );
  }

  const colors: Record<"low" | "medium" | "high", string> = {
    low: "#4CAF50",
    medium: "#FFC107",
    high: "#F44336",
  };

  return (
    <div
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <p
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        ⚠️ MOT Risk Gauge
      </p>

      <div
        style={{
          height: 12,
          backgroundColor: theme.blackSoft,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${ai.healthScore}%`,
            height: "100%",
            backgroundColor: colors[ai.riskLevel],
          }}
        />
      </div>

      <p
        style={{
          marginTop: 10,
          color: colors[ai.riskLevel],
          fontWeight: 700,
        }}
      >
        {ai.riskLevel.toUpperCase()} RISK
      </p>
    </div>
  );
}
