import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult | null;
  theme: any;
};

export default function MotAiVerdictCard({ ai, theme }: Props) {
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

  const verdict =
    ai.predictedPassChance >= 80
      ? "Highly likely to pass"
      : ai.predictedPassChance >= 60
      ? "Moderate chance of passing"
      : ai.predictedPassChance >= 40
      ? "Risky — may fail"
      : "High failure risk";

  const color =
    ai.predictedPassChance >= 80
      ? "#4CAF50"
      : ai.predictedPassChance >= 60
      ? "#FFC107"
      : ai.predictedPassChance >= 40
      ? "#FF9800"
      : "#F44336";

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
        🏁 MOT Verdict
      </p>

      <p
        style={{
          fontSize: 32,
          fontWeight: 800,
          color,
          marginBottom: 6,
        }}
      >
        {verdict}
      </p>

      <p style={{ color: theme.text }}>
        Based on AI analysis of mileage, advisories, failures, and vehicle health.
      </p>
    </div>
  );
}
