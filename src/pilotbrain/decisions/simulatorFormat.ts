import { MAX_SIMULATIONS, decisionState, type Confidence, type Decision, type Figure, type FigureKind, type SimAssumption } from "@/lib/decisionTypes";
import {
  SIM_AMOUNT_MAX,
  SIM_AMOUNT_MIN,
  SIM_CUT_MAX,
  SIM_CUT_MIN,
  SIM_DAYS_MAX,
  SIM_DAYS_MIN,
  SIM_EXTRA_SALES_MAX,
  SIM_EXTRA_SALES_MIN,
  type SimulationRequest,
} from "@/lib/simulatorApi";

// Small, pure helpers for the Simulator screen: how a number is written, what
// each label means, and turning what Boss typed into a request. Plain UK English.

const trim = (n: number, places: number) => {
  const f = 10 ** places;
  const r = Math.round(n * f) / f;
  return String(r === 0 ? 0 : r); // never "-0"
};

// £1,234 for whole pounds, £1,234.56 when there are pence, -£500 for a loss.
export function formatPounds(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (r === 0) return "£0";
  const text = Math.abs(r).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
  return `${r < 0 ? "-" : ""}£${text}`;
}

const unitWord = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function formatCars(n: number): string {
  return `${trim(n, 2)} ${unitWord(n, "car", "cars")}`;
}
export function formatDays(n: number): string {
  return `${trim(n, 1)} ${unitWord(n, "day", "days")}`;
}
export function formatMonths(n: number): string {
  return `${trim(n, 1)} ${unitWord(n, "month", "months")}`;
}

// A figure's value as it is shown. A missing figure is "Unknown": never 0, never blank.
export function formatFigureValue(f: Pick<Figure, "value" | "unit">): string {
  if (f.value === null) return "Unknown";
  switch (f.unit) {
    case "gbp":
      return formatPounds(f.value);
    case "cars":
      return formatCars(f.value);
    case "days":
      return formatDays(f.value);
    case "months":
      return formatMonths(f.value);
    case "percent":
      return `${trim(f.value, 1)}%`;
    case "count":
      return trim(f.value, 1);
  }
}

export function formatAssumptionValue(a: Pick<SimAssumption, "value" | "unit">): string {
  if (a.value === null) return "Unknown";
  if (typeof a.value === "string") return a.value;
  return a.unit === "text" ? String(a.value) : formatFigureValue({ value: a.value, unit: a.unit });
}

export const KIND_LABEL: Record<FigureKind, string> = {
  known: "Known",
  inferred: "Inferred",
  predicted: "Predicted",
  unknown: "Unknown",
};

export const KIND_HELP: Record<FigureKind, string> = {
  known: "From your own records",
  inferred: "Worked out from your own records",
  predicted: "An assumption about the future, not a record",
  unknown: "Missing from your records, and left missing",
};

export const SOURCE_LABEL: Record<SimAssumption["source"], string> = {
  history: "Your history",
  boss: "Your figure",
  default: "Pilot's default",
};

// Confidence is a word with reasons, never a percentage.
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const BANNER_TITLE = "Simulation, not a forecast";
const FALLBACK_NOTE = "Arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.";

// The server's note starts with the banner words; the screen shows those as the
// heading and the rest beneath. A missing note falls back to the same sentence.
export function bannerBody(note: string | undefined): string {
  const text = (note ?? "").trim();
  if (text === "") return FALLBACK_NOTE;
  const lead = `${BANNER_TITLE}:`;
  return text.startsWith(lead) ? text.slice(lead.length).trim() || FALLBACK_NOTE : text;
}

// The day a simulation was run, the way the rest of the app writes UK dates.
export function formatRunDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "date unknown";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

// Whether a result can be saved to this decision, and if not, why in plain words.
// The server enforces both rules too: only while the decision is open, and at most
// MAX_SIMULATIONS on one decision.
export function saveAvailability(
  decision: Pick<Decision, "bossDecision" | "outcome" | "reviewDueAt" | "simulations">,
  now: number
): { can: true } | { can: false; reason: string } {
  if (decisionState(decision, now) !== "open") {
    return { can: false, reason: "This decision has already been made, so nothing more can be saved to it. You can still run simulations to look at the numbers." };
  }
  if (decision.simulations.length >= MAX_SIMULATIONS) {
    return { can: false, reason: `This decision already holds ${MAX_SIMULATIONS} simulations, the most it can hold.` };
  }
  return { can: true };
}

/* ------------------------------------------------------------------ */
/* What Boss types                                                      */
/* ------------------------------------------------------------------ */

export interface SimulatorFields {
  amount: string;
  days: string;
  cut: string;
  extraSales: string;
}
export const EMPTY_FIELDS: SimulatorFields = { amount: "", days: "", cut: "", extraSales: "" };

// undefined: left blank. null: not a plain number. Accepts 50000, 50,000 and £50,000.
export function parseNumberField(text: string): number | null | undefined {
  const t = text.trim().replace(/^£\s*/, "");
  if (t === "") return undefined;
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type BuiltRequest = { ok: true; request: SimulationRequest } | { ok: false; error: string };

const inRange = (n: number | null | undefined, min: number, max: number): n is number => typeof n === "number" && n >= min && n <= max;

// Checks what was typed with the same limits the server uses, so a slip is
// caught before it is sent (the server still checks everything itself).
export function buildRequest(kind: SimulationRequest["kind"], fields: SimulatorFields): BuiltRequest {
  if (kind === "stock_investment") {
    const amountGbp = parseNumberField(fields.amount);
    if (!inRange(amountGbp, SIM_AMOUNT_MIN, SIM_AMOUNT_MAX)) {
      return { ok: false, error: `How much would you put into stock? Enter an amount from £${SIM_AMOUNT_MIN} to £${SIM_AMOUNT_MAX.toLocaleString("en-GB")}.` };
    }
    return { ok: true, request: { kind, params: { amountGbp } } };
  }

  const params: { daysThreshold?: number; cutGbp?: number; extraSalesFromCut?: number } = {};
  const days = parseNumberField(fields.days);
  if (days !== undefined) {
    if (!inRange(days, SIM_DAYS_MIN, SIM_DAYS_MAX)) return { ok: false, error: `Days in stock must be a number from ${SIM_DAYS_MIN} to ${SIM_DAYS_MAX}.` };
    params.daysThreshold = days;
  }
  const cut = parseNumberField(fields.cut);
  if (cut !== undefined) {
    if (!inRange(cut, SIM_CUT_MIN, SIM_CUT_MAX)) return { ok: false, error: `The price cut must be a number from £${SIM_CUT_MIN} to £${SIM_CUT_MAX.toLocaleString("en-GB")}.` };
    params.cutGbp = cut;
  }
  const extra = parseNumberField(fields.extraSales);
  if (extra !== undefined) {
    if (!inRange(extra, SIM_EXTRA_SALES_MIN, SIM_EXTRA_SALES_MAX)) {
      return { ok: false, error: `Extra cars sold by the cut must be a number from ${SIM_EXTRA_SALES_MIN} to ${SIM_EXTRA_SALES_MAX}.` };
    }
    params.extraSalesFromCut = extra;
  }
  return { ok: true, request: { kind, params } };
}
