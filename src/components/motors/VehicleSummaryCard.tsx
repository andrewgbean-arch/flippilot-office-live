import React from "react";

export default function VehicleSummaryCard({
  year,
  make,
  model,
  reg,
  mileage,
  motExpiry,
  motHealth,
  expiryDays,
  isExpired,
  isExpiringSoon,
  theme,
}: {
  year: string | number;
  make: string;
  model: string;
  reg: string;
  mileage?: number | string | null;
  motExpiry?: string | null;
  motHealth?: number | null;
  expiryDays?: number | null;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  theme: any;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: theme.goldDeep,
        backgroundColor: theme.card,
        marginBottom: 20,
      }}
    >
      {/* VEHICLE TITLE */}
      <h2
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: theme.accent,
          textShadow: `0 0 8px ${theme.goldSoftGlow}`,
          marginBottom: 4,
        }}
      >
        {year} {make} {model}
      </h2>

      {/* REG */}
      <p
        style={{
          fontSize: 16,
          color: theme.text,
          marginBottom: 12,
        }}
      >
        {reg}
      </p>

      {/* DETAILS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ color: theme.text }}>
          📍 Mileage:{" "}
          <span style={{ color: theme.accent }}>
            {mileage ?? "Unknown"}
          </span>
        </p>

        {/* MOT EXPIRY STATUS */}
        <p style={{ color: theme.text }}>
          ⏳ MOT Expiry:{" "}
          <span
            style={{
              color: isExpired
                ? "#FF4D4D"
                : isExpiringSoon
                ? "#FFD966"
                : theme.accent,
              fontWeight: 700,
            }}
          >
            {motExpiry ?? "Unknown"}
          </span>
        </p>

        {/* EXPIRY WARNING */}
        {isExpired && (
          <p style={{ color: "#FF4D4D", fontWeight: 700 }}>
            ❌ MOT expired
          </p>
        )}

        {isExpiringSoon && (
          <p style={{ color: "#FFD966", fontWeight: 700 }}>
            ⚠ MOT expires in {expiryDays} days
          </p>
        )}

        {/* MOT HEALTH */}
        <p style={{ color: theme.text }}>
          ❤️ MOT Health:{" "}
          <span style={{ color: theme.accent }}>
            {motHealth ?? "N/A"}/100
          </span>
        </p>
      </div>
    </div>
  );
}
