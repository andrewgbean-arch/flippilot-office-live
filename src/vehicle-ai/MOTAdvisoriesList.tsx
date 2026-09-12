const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

type Props = {
  advisories?: string[] | null;
};

export default function MOTAdvisoriesList({ advisories }: Props) {
  if (!advisories || advisories.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "#111827",
        borderRadius: 12,
        padding: 12,
        border: `1px solid ${GOLD}`,
        marginTop: 12,
      }}
    >
      <p
        style={{
          color: GOLD,
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Advisories
      </p>

      {advisories.map((a, i) => (
        <p
          key={i}
          style={{
            color: SILVER,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          • {a}
        </p>
      ))}
    </div>
  );
}
