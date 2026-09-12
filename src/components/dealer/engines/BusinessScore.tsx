import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type BusinessScoreProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function BusinessScore({ vehicles, theme }: BusinessScoreProps) {
  const count = vehicles.length;

  const score =
    count === 0
      ? 0
      : Math.round(
          vehicles.reduce((acc: number, v: FlipRecord) => {
            const mot = v.mot ?? {};

            const failures = mot.failures ?? [];
            const advisories = mot.advisories ?? [];
            const status = mot.motStatus ?? "pass";

            let s = 100;

            if ((v.sellPrice ?? 0) < (v.buyPrice ?? 0)) s -= 20;
            if (status === "fail") s -= 15;

            s -= advisories.length * 3;
            s -= failures.length * 10;

            return acc + s;
          }, 0) / count
        );

  const message =
    score >= 80
      ? "🏆 Excellent dealership performance."
      : score >= 50
      ? "📊 Moderate performance — room to improve."
      : "⚠️ Weak performance — review sourcing and pricing.";

  return (
    <div className="flex flex-col">
      <p
        className="font-extrabold"
        style={{ color: theme.white, fontSize: 22 }}
      >
        Business Score: {score}%
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
