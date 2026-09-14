export type UlezStatus = "compliant" | "non-compliant" | "unknown";

export interface UlezResult {
  status: UlezStatus;
  label: string;
}

// London ULEZ (and the same Euro-standard basis most UK Clean Air
// Zones — Birmingham, Bristol, etc. — use for cars): petrol needs
// Euro 4 or newer, diesel needs Euro 6 or newer, electric/hydrogen are
// always compliant. Real compliance depends on the vehicle's actual
// DVLA-registered Euro standard, not just fuel type — a hybrid still
// runs a combustion engine that must meet the same Euro standard as
// its fuel type. Deliberately returns "unknown" rather than guessing
// when the underlying DVLA data isn't there (fuelType/euroStatus are
// only populated once DVLA_API_KEY is configured).
export function getUlezStatus(
  fuelType: string | null | undefined,
  euroStatus: string | null | undefined
): UlezResult {
  const fuel = (fuelType ?? "").toUpperCase();

  if (!fuel) {
    return { status: "unknown", label: "ULEZ: Unknown (no fuel type data)" };
  }

  const isHybrid = fuel.includes("HYBRID");

  // Must come AFTER the hybrid check — DVLA's real fuelType value for a
  // petrol/diesel hybrid is literally "HYBRID ELECTRIC", which contains
  // "ELECTRIC" as a substring. A naive `fuel.includes("ELECTRIC")` check
  // here caught that and returned "always compliant" for every hybrid
  // regardless of its actual (combustion) Euro standard — caught by the
  // test suite, not manual testing, on the very first run.
  if (!isHybrid && (fuel.includes("ELECTRIC") || fuel.includes("HYDROGEN"))) {
    return { status: "compliant", label: "ULEZ Compliant (zero emission)" };
  }

  const euroMatch = (euroStatus ?? "").match(/(\d+)/);
  if (!euroMatch) {
    return { status: "unknown", label: "ULEZ: Unknown (no Euro standard data)" };
  }
  const euro = Number(euroMatch[1]);

  const isDiesel = fuel.includes("DIESEL") && !isHybrid;
  const isPetrolOrHybrid = fuel.includes("PETROL") || isHybrid || fuel.includes("GAS");

  if (isDiesel) {
    return euro >= 6
      ? { status: "compliant", label: "ULEZ Compliant (Euro 6 diesel)" }
      : { status: "non-compliant", label: `Not ULEZ Compliant (Euro ${euro} diesel)` };
  }

  if (isPetrolOrHybrid) {
    return euro >= 4
      ? { status: "compliant", label: "ULEZ Compliant (Euro 4+ petrol)" }
      : { status: "non-compliant", label: `Not ULEZ Compliant (Euro ${euro} petrol)` };
  }

  return { status: "unknown", label: "ULEZ: Unknown (unrecognised fuel type)" };
}
