import React from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type MotHealthIndexProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function MotHealthIndex({ vehicles, theme }: MotHealthIndexProps) {
  const score = vehicles.reduce((acc: number, v: FlipRecord) => {
    const mot = v.mot ?? {};

    const failures = mot.failures ?? [];
    const advisories = mot.advisories ?? [];
    const status = mot.motStatus ?? "pass";

    let s = 100;

    s -= advisories.length * 5;
    s -= failures.length * 15;
    if (status === "fail") s -= 25;

    return acc + s;
  }, 0);

  const avg = vehicles.length ? Math.round(score / vehicles.length) : 0;

  const message =
    avg >= 80
      ? "🟢 Excellent MOT condition."
      : avg >= 50
      ? "🟡 Mixed MOT condition."
      : "🔴 Poor MOT condition — many advisories/failures.";

  return (
    <div className="flex flex-col">
      <p
        className="font-bold"
        style={{ color: theme.white, fontSize: 18 }}
      >
        MOT Health: {avg}%
      </p>

      <p className="mt-2" style={{ color: theme.muted }}>
        {message}
      </p>
    </div>
  );
}
