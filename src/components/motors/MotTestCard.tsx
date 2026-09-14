import React from "react";

// One MOT test result, laid out like the real GOV.UK MOT History
// Checker's own result card (Date tested / PASS-FAIL / Mileage / MOT
// test number / what was found) — the single shared layout every MOT
// screen in this app uses for a test entry, whether it's a failure
// summary or the full chronological list, so a dealer sees the same
// thing everywhere.
export interface MotTestCardEntry {
  date?: string | null;
  year?: number | null;
  result?: string;
  mileage?: number | null;
  testNumber?: string | null;
  failures?: string[] | null;
  advisories?: string[] | null;
}

// DVSA's own response already comes back most-test-first, but sorting
// explicitly here means the display is always correct regardless of
// API ordering quirks — the most recent test (pass OR fail) belongs at
// the top, not whatever order the source happened to return.
export function sortMotHistoryDesc<T extends { date?: string | null; year?: number | null }>(history: T[]): T[] {
  return [...history].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : a.year ? Date.UTC(a.year, 0, 1) : -Infinity;
    const bTime = b.date ? new Date(b.date).getTime() : b.year ? Date.UTC(b.year, 0, 1) : -Infinity;
    return bTime - aTime;
  });
}

export default function MotTestCard({ h }: { h: MotTestCardEntry }) {
  const isFail = h.result?.toUpperCase() === "FAIL";
  return (
    <div className="pb-4 mb-4 last:pb-0 last:mb-0 border-b border-white/10 last:border-0">
      <p className="text-white/50 text-xs">Date tested</p>
      <p className="text-white text-sm font-semibold mb-2">
        {h.date
          ? new Date(h.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
          : h.year
            ? String(h.year)
            : "Unknown date"}
      </p>

      <span
        className={`inline-block px-3 py-1 rounded text-xs font-bold mb-2 ${
          isFail ? "bg-red-600 text-white" : "bg-green-600 text-white"
        }`}
      >
        {h.result?.toUpperCase() ?? "UNKNOWN"}
      </span>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
        {h.mileage != null && (
          <div>
            <p className="text-white/50 text-xs">Mileage</p>
            <p className="text-white/90">{h.mileage.toLocaleString()} mi</p>
          </div>
        )}
        {h.testNumber && (
          <div>
            <p className="text-white/50 text-xs">MOT test number</p>
            <p className="text-white/90">{h.testNumber}</p>
          </div>
        )}
      </div>

      {(h.failures?.length ?? 0) > 0 && (
        <>
          <p className="text-white/50 text-xs mt-3 mb-1">Failed on</p>
          <ul className="ml-4 list-disc text-red-400 text-sm">
            {(h.failures ?? []).map((f, fi) => (
              <li key={fi}>{f}</li>
            ))}
          </ul>
        </>
      )}
      {(h.advisories?.length ?? 0) > 0 && (
        <>
          <p className="text-white/50 text-xs mt-3 mb-1">Advisories</p>
          <ul className="ml-4 list-disc text-yellow-300/80 text-sm">
            {(h.advisories ?? []).map((a, ai) => (
              <li key={ai}>{a}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
