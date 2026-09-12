type Props = {
  aiValuation: {
    estimatedValue?: number | null;
    confidence?: number | null;
    notes?: string | null;
  } | null | undefined;
  theme: any;
};

export default function AiValuationSummary({ aiValuation, theme }: Props) {
  // Null guard (safe fallback)
  if (!aiValuation) {
    return (
      <div
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: 14,
        }}
      >
        <p style={{ opacity: 0.6 }}>AI valuation unavailable</p>
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
        🤖 AI Valuation Summary
      </p>

      <p
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: theme.accent,
        }}
      >
        £{(aiValuation.estimatedValue ?? 0).toLocaleString()}
      </p>

      <p style={{ color: theme.text, marginTop: 6 }}>
        Confidence: {aiValuation.confidence ?? 0}%
      </p>

      {aiValuation.notes && (
        <p style={{ color: theme.text, marginTop: 6 }}>
          {aiValuation.notes}
        </p>
      )}
    </div>
  );
}
