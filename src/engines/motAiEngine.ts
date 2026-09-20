// A rule-of-thumb read of a vehicle's recorded MOT data. It is NOT a model
// and NOT a prediction: it counts what is on record and turns the counts
// into a score with fixed weights, so a dealer can follow every step.
//
// What it used to get wrong (kept here so nobody reintroduces it):
//  - failures were read from `mot.failures`, a field stored MOT records do
//    not have (failures live inside `history[].failures`), so they were
//    always 0 and a car with five recorded failure items scored 95%;
//  - "latest mileage" was `history[history.length - 1]`, but DVSA returns
//    history NEWEST first, so it used the OLDEST test's mileage;
//  - a car with no MOT data at all scored 96 to 99% "healthy, no critical
//    issues detected", because no bad news was treated as good news.

export type MotRiskLevel = "low" | "medium" | "high" | "unknown";

/** A coarse band. The old "predicted pass chance" was a 6-step table, so it is shown as a band. */
export type MotPassOutlook = "good" | "fair" | "poor";

export type MotAiBasis = {
  /** MOT tests found in the history (entries with a date, year, result or test number). */
  testsRecorded: number;
  /** Tests whose result was a fail. */
  failedTests: number;
  /** Failure items listed across the whole history (a fail with no listed items counts as 1). */
  failureItems: number;
  /** Advisories on the current record (the latest test's). */
  advisories: number;
  /** The most recent test BY DATE, not by position in the list. */
  latestTest: { date: string | null; result: string | null; mileage: number | null } | null;
  /** Mileage of the newest test that recorded one (or the newest reading passed in); null if none. */
  mileage: number | null;
  expiry: string | null;
  expired: boolean;
};

export type MotAiResult = {
  /** False when there is no MOT expiry, no test history and no advisories: nothing below is then a real figure. */
  hasData: boolean;
  /** 0 to 100 rule of thumb, or null when there is no MOT data. 0 when the MOT has expired. */
  healthScore: number | null;
  riskLevel: MotRiskLevel;
  /** Coarse step (97/90/78/62/45/25), a rough guide and not a measured probability. Null when there is no data or the MOT has expired. */
  predictedPassChance: number | null;
  /** The same rough guide as a band; prefer this for display. */
  passOutlook: MotPassOutlook | null;
  nextTestRisk: string;
  advisorySeverity: number;
  failureSeverity: number;
  /** Mileage band 5 to 95, or null when no mileage is on record. */
  mileageRisk: number | null;
  verdict: string;
  /** One plain sentence saying what the rule was worked out from, or that no MOT data is recorded. */
  summary: string;
  basis: MotAiBasis;
};

const DAY_MS = 86400000;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** A test's moment in time: its date, else 1 January of its year, else unknown. */
function entryTime(entry: any): number | null {
  if (!entry) return null;
  if (entry.date) {
    const t = new Date(entry.date).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (typeof entry.year === "number" && Number.isFinite(entry.year)) return Date.UTC(entry.year, 0, 1);
  return null;
}

/** An entry that looks like a real MOT test, as opposed to a bare `{ mileage }` reading. */
function isTestRecord(entry: any): boolean {
  return !!entry && typeof entry === "object" &&
    !!(entry.date || typeof entry.year === "number" || entry.result || entry.testNumber || entry.expiryDate);
}

function isFail(entry: any): boolean {
  return String(entry?.result ?? "").toUpperCase() === "FAIL";
}

function failureItemCount(entry: any): number {
  const listed = Array.isArray(entry?.failures) ? entry.failures.length : 0;
  return isFail(entry) ? Math.max(listed, 1) : listed;
}

/**
 * True once the expiry DAY has finished. An MOT is valid up to and including
 * its expiry date, so a date-only expiry ("2026-09-20") must not read as
 * expired at 00:00 on that day. Blank or unreadable dates are not expired.
 */
export function isMotExpired(expiry: unknown, now: number = Date.now()): boolean {
  if (typeof expiry !== "string" || !expiry.trim()) return false;
  const t = new Date(expiry).getTime();
  if (!Number.isFinite(t)) return false;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiry.trim());
  return (dateOnly ? t + DAY_MS : t) <= now;
}

function mileageBand(mileage: number | null): number | null {
  if (mileage === null) return null;
  return mileage > 180000 ? 95 :
    mileage > 150000 ? 85 :
    mileage > 120000 ? 70 :
    mileage > 90000 ? 50 :
    mileage > 60000 ? 30 :
    mileage > 30000 ? 15 : 5;
}

function noDataBasis(expiry: string | null): MotAiBasis {
  return { testsRecorded: 0, failedTests: 0, failureItems: 0, advisories: 0, latestTest: null, mileage: null, expiry, expired: false };
}

/** The one plain sentence a screen can print next to a score to say how it is worked out. */
export const MOT_RULE_OF_THUMB =
  "Starts at 100. Takes off 3.5 for each current advisory (up to 35), about 14 for each failure item on record (up to 65) and up to 24 for high mileage. An expired MOT scores 0. It is a rule of thumb, not a prediction.";

function collect(mot: any, history: any[] | undefined) {
  const advisories = Array.isArray(mot?.advisories) ? mot.advisories.length : 0;
  const expiry = typeof mot?.expiry === "string" && mot.expiry.trim() ? mot.expiry : null;

  // Callers pass either mot.history again, a list of bare mileage readings,
  // or both. Merge them without counting the same object twice.
  const seen = new Set<any>();
  const entries: any[] = [];
  for (const source of [Array.isArray(history) ? history : [], Array.isArray(mot?.history) ? mot.history : []]) {
    for (const entry of source) {
      if (entry && typeof entry === "object" && !seen.has(entry)) {
        seen.add(entry);
        entries.push(entry);
      }
    }
  }

  const tests = entries.filter(isTestRecord);
  const hasData = expiry !== null || tests.length > 0 || advisories > 0;
  return { advisories, expiry, entries, tests, hasData };
}

/**
 * True when the record holds a real MOT expiry date, a test in its history or
 * an advisory. Screens use this to print "No MOT data" instead of zeros.
 */
export function hasMotData(mot: any, history: any[] = []): boolean {
  return collect(mot, history).hasData;
}

export function motAiEngine(mot: any, history: any[], now: number = Date.now()): MotAiResult {
  const { advisories, expiry, entries, tests, hasData } = collect(mot, history);

  if (!hasData) {
    const message = "No MOT data is recorded for this vehicle.";
    return {
      hasData: false,
      healthScore: null,
      riskLevel: "unknown",
      predictedPassChance: null,
      passOutlook: null,
      nextTestRisk: message,
      advisorySeverity: 0,
      failureSeverity: 0,
      mileageRisk: null,
      verdict: message,
      summary: message,
      basis: noDataBasis(expiry),
    };
  }

  // Newest test by DATE. DVSA lists newest first, but that must not be relied on.
  let newest: any = null;
  let newestTime = -Infinity;
  for (const test of tests) {
    const t = entryTime(test);
    if (t !== null && t > newestTime) {
      newest = test;
      newestTime = t;
    }
  }

  // Mileage: the newest dated test that recorded one, or a bare current
  // reading (which is never older than a test), or the record's own figure.
  let datedMileage: number | null = null;
  let datedMileageTime = -Infinity;
  let bareMileage: number | null = null;
  for (const entry of entries) {
    const m = num(entry.mileage);
    if (m === null) continue;
    const t = entryTime(entry);
    if (t === null) {
      bareMileage = bareMileage === null ? m : Math.max(bareMileage, m);
    } else if (t > datedMileageTime) {
      datedMileage = m;
      datedMileageTime = t;
    }
  }
  const candidates = [datedMileage, bareMileage].filter((m): m is number => m !== null);
  const mileage = candidates.length ? Math.max(...candidates) : num(mot?.mileage);

  // A test that FAILED. (A "pass after rectification" lists failure items but
  // its result is a pass; the items still count below, the test does not.)
  const failedTests = tests.filter(isFail).length;
  const failureItems = tests.reduce((sum, t) => sum + failureItemCount(t), 0);

  const mileageRisk = mileageBand(mileage);
  const advisorySeverity = Math.min(advisories * 10, 100);
  const failureSeverity = Math.min(failureItems * 22, 100);

  // 100, minus 3.5 points per current advisory (up to 35), minus 14.3 points
  // per failure item on record (up to 65), minus up to 24 for mileage.
  const baseHealth =
    100 -
    advisorySeverity * 0.35 -
    failureSeverity * 0.65 -
    (mileageRisk ?? 0) * 0.25;

  // This engine used to only ever look at advisory/failure history and
  // mileage — a vehicle with a clean record but a genuinely EXPIRED MOT
  // scored as perfectly healthy, because nothing here ever checked the
  // one fact that actually matters most: is it currently roadworthy
  // right now. Caught live: the HUD showed "MOT: good" in green while
  // real vehicles in the same inventory were sitting with expired MOTs.
  // An expired MOT overrides everything else below — it's not a
  // "future risk prediction", it's a current fact.
  const expired = isMotExpired(expiry, now);

  const healthScore = expired ? 0 : Math.max(0, Math.min(100, Math.round(baseHealth)));

  // A car whose MOT has run out has not failed anything; it needs a test.
  // So there is no pass chance to quote, rather than the old flat 0.
  const predictedPassChance = expired ? null :
    healthScore >= 90 ? 97 :
    healthScore >= 75 ? 90 :
    healthScore >= 60 ? 78 :
    healthScore >= 45 ? 62 :
    healthScore >= 30 ? 45 : 25;

  const riskLevel: MotRiskLevel = expired ? "high" :
    healthScore >= 70 ? "low" :
    healthScore >= 45 ? "medium" : "high";

  // The band follows the risk level, so a card never says "low risk" and
  // "fair outlook" about the same car.
  const passOutlook: MotPassOutlook | null = expired ? null :
    riskLevel === "low" ? "good" :
    riskLevel === "medium" ? "fair" : "poor";

  const nextTestRisk = expired
    ? "The MOT has expired. It should not be driven on the road, other than to a pre-booked MOT test, until it has been retested."
    : riskLevel === "low"
      ? "The recorded data shows no strong sign of trouble at the next MOT. This is a rule of thumb, not a prediction."
      : riskLevel === "medium"
      ? "The recorded data shows some warning signs (advisories, past failures or mileage). Worth checking before relying on a first-time pass."
      : "The recorded data shows several warning signs. Allow for repairs before or at the next MOT.";

  const verdict = expired
    ? "The MOT has expired. It needs a retest before it is sold on the road or driven."
    : riskLevel === "low"
      ? "The recorded MOT data shows no strong warning signs."
      : riskLevel === "medium"
      ? "The recorded MOT data shows some warning signs. Check the advisories and past failures."
      : "The recorded MOT data shows several warning signs: past failures, advisories or high mileage.";

  const parts: string[] = [];
  parts.push(`${advisories} current ${advisories === 1 ? "advisory" : "advisories"}`);
  if (tests.length > 0) {
    parts.push(
      failureItems === 0
        ? `no failures on record across ${tests.length} ${tests.length === 1 ? "test" : "tests"}`
        : `${failureItems} failure ${failureItems === 1 ? "item" : "items"} on record, ${failedTests} failed ${failedTests === 1 ? "test" : "tests"} of ${tests.length}`
    );
  } else {
    parts.push("no test history on record");
  }
  parts.push(mileage === null ? "no mileage on record" : `${mileage.toLocaleString("en-GB")} miles`);
  const summary = `Rule of thumb from: ${parts.join(", ")}.${expired ? " The MOT has expired." : ""}`;

  return {
    hasData: true,
    healthScore,
    riskLevel,
    predictedPassChance,
    passOutlook,
    nextTestRisk,
    advisorySeverity,
    failureSeverity,
    mileageRisk,
    verdict,
    summary,
    basis: {
      testsRecorded: tests.length,
      failedTests,
      failureItems,
      advisories,
      latestTest: newest
        ? {
            date: typeof newest.date === "string" ? newest.date : null,
            result: newest.result ? String(newest.result).toUpperCase() : null,
            mileage: num(newest.mileage),
          }
        : null,
      mileage,
      expiry,
      expired,
    },
  };
}
