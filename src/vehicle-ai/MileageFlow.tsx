type Props = {
  history: { date: string; mileage: number }[];
  theme: any;
};

export default function MileageFlow({ history, theme }: Props) {
  return (
    <div
      style={{
        display: "flex",
        overflowX: "auto",
        padding: "10px 0",
        marginBottom: 24,
        gap: 24,
      }}
    >
      {history.map((entry, idx) => {
        const isLast = idx === history.length - 1;

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              {/* GOLD DOT */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: theme.goldDeep,
                  boxShadow: `0 0 8px ${theme.goldSoftGlow}`,
                  margin: "0 auto",
                }}
              />

              {/* DATE */}
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: theme.text,
                }}
              >
                {entry.date}
              </p>

              {/* MILEAGE */}
              <p
                style={{
                  fontSize: 14,
                  color: theme.text,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {entry.mileage} mi
              </p>
            </div>

            {/* CONNECTOR LINE */}
            {!isLast && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  backgroundColor: theme.goldDeep,
                  marginLeft: 8,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
