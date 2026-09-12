type Props = {
  valuation: number | null | undefined;
  aiPriceMin: number | null | undefined;
  aiPriceMax: number | null | undefined;
  theme: any;
};

export default function MarketplacePricingPanel({
  valuation,
  aiPriceMin,
  aiPriceMax,
  theme,
}: Props) {
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
        🛒 Marketplace Pricing
      </p>

      <p style={{ color: theme.text }}>
        Valuation: £{(valuation ?? 0).toLocaleString()}
      </p>

      <p style={{ color: theme.text }}>
        AI Price Range: £{aiPriceMin ?? 0} – £{aiPriceMax ?? 0}
      </p>

      <p style={{ color: theme.text, marginTop: 6 }}>
        Suggested Listing Price: £{Math.round((valuation ?? 0) * 1.05)}
      </p>
    </div>
  );
}
