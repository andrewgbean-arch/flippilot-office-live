import React from "react";

interface Props {
  id?: string;
  year?: string | number;
  make?: string;
  model?: string;
  reg?: string;
  price?: number;
  mileage?: number | null;
  thumbnail?: string | null;
  theme?: any;
  onPress?: (id: string) => void;
}

export default function MarketplaceListingCard({
  id = "",
  year = "",
  make = "",
  model = "",
  reg = "",
  price = 0,
  mileage = null,
  thumbnail = null,
  theme = {},
  onPress = () => {},
}: Props) {
  return (
    <div
      onClick={() => onPress(id)}
      style={{
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: theme.goldDeep ?? "#FFD700",
        backgroundColor: theme.card ?? "#111",
        overflow: "hidden",
        marginBottom: 20,
        cursor: "pointer",
      }}
    >
      {/* IMAGE */}
      {thumbnail ? (
        <img
          src={thumbnail}
          style={{
            width: "100%",
            height: 160,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 160,
            backgroundColor: theme.blackSoft ?? "#222",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <p style={{ color: theme.text ?? "#fff" }}>No Image</p>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ padding: 14 }}>
        <p
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: theme.accent ?? "#FFD700",
            marginBottom: 4,
            textShadow: `0 0 6px ${theme.goldSoftGlow ?? "rgba(255,215,0,0.5)"}`,
          }}
        >
          {year} {make} {model}
        </p>

        <p
          style={{
            fontSize: 14,
            color: theme.text ?? "#ccc",
            marginBottom: 10,
          }}
        >
          {reg}
        </p>

        <p style={{ color: theme.text ?? "#ccc" }}>
          📍 Mileage:{" "}
          <span style={{ color: theme.accent ?? "#FFD700" }}>
            {mileage ?? "Unknown"}
          </span>
        </p>

        <p style={{ color: theme.text ?? "#ccc" }}>
          💷 Price:{" "}
          <span style={{ color: theme.accent ?? "#FFD700" }}>
            £{price.toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}
