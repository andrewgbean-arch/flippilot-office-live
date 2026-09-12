import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult | null;
  theme: any;
};

export default function MotAiBuyerConfidence({ ai, theme }: Props) {
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

  const score =
    ai.healthScore * 0.5 +
    ai.predictedPassChance * 0.3 -
    ai.failureSeverity * 0.2;

  const rounded = Math.max(0, Math.min(100, Math.round(score)));

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
          fontSize: 22,
          fontWeight: 800,
          color: theme.accent,
          marginBottom: 12,
        }}
      >
        ⭐ Buyer Confidence Score
      </p>

      <p
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: 800,
        }}
      >
        {rounded} / 100
      </p>

      <p style={{ color: theme.text, marginTop: 6 }}>
        Higher score = easier to sell, stronger buyer trust.
      </p>
    </div>
  );
}
