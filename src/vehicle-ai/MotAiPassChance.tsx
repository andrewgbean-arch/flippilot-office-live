import { MotAiResult } from "@/engines/motAiEngine";

type Props = {
  ai: MotAiResult | null;
  theme: any;
};

export default function MotAiPassChance({ ai, theme }: Props) {
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
          marginBottom: 6,
        }}
      >
        📈 Predicted MOT Pass Chance
      </p>

      <p
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: theme.accent,
        }}
      >
        {ai.predictedPassChance}%
      </p>

      <p style={{ color: theme.text, marginTop: 6 }}>
        {ai.nextTestRisk}
      </p>
    </div>
  );
}
