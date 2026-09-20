import React, { useState, useMemo } from "react";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { motAiEngine } from "@/engines/motAiEngine";

import { useInventory } from "@/context/InventoryProvider";

// MOT Components
import MOTStatusCard, { motStatusLabel } from "@/components/motors/MOTStatusCard";
import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";
import MOTAdvisoriesList from "@/components/motors/MOTAdvisoriesList";
import MOTMileageHistory, { toMileageEntries } from "@/components/motors/MOTMileageHistory";
import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";
import MotTestCard, { sortMotHistoryDesc } from "@/components/motors/MotTestCard";

// Rule-of-thumb cards. The page used to stack six of these (health score,
// pass chance, "buyer confidence", risk gauge, radar chart, verdict), all
// derived from the same three counts. Buyer Confidence was an invented blend
// with no basis, the radar mixed scales that run in opposite directions, and
// the gauge repeated the health bar, so those three are no longer shown.
import MotAiPassChance from "@/components/motors/MotAiPassChance";
import MotAiVerdictCard from "@/components/motors/MotAiVerdictCard";

export default function MOTLookup() {
  const [reg, setReg] = useState("");
  const [mot, setMot] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const {
    vehicles: inventoryVehicles,
    updateVehicleMOT,
    createVehicleFromMOT,
  } = useInventory();

  const [matchedVehicle, setMatchedVehicle] = useState<{ id: string; make: string; model: string } | null>(null);
  const [added, setAdded] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const theme = {
    card: "#0A0F1F",
    accent: "#FFD700",
    text: "#AAB4C3",
    goldDeep: "#C5A100",
    goldSoftGlow: "#FFD70055",
    blackSoft: "#1A1F2B",
  };

  // Every hook below is called unconditionally on every render — the
  // previous version put a conditional `if (!mot) return ...` BEFORE
  // these useMemo calls, which is a genuine Rules-of-Hooks violation:
  // the first render (mot === null) skips them entirely, then the very
  // next render after a successful lookup reaches them for the first
  // time, and React crashes with "Rendered more hooks than during the
  // previous render." This is why a real, successful MOT lookup on
  // this screen always ended in a hard crash, never actual results —
  // confirmed live.
  // Same rule as the vehicle list: an MOT is valid through its expiry day, so
  // a date-only expiry is not "Expired" until that day has ended.
  const motStatus = useMemo(() => motStatusLabel(mot?.expiry, new Date()), [mot?.expiry]);

  const daysLeft = useMemo(() => {
    const expiry = mot?.expiry;
    if (!expiry) return null;

    const exp = new Date(expiry);
    const now = new Date();

    const diff = exp.getTime() - now.getTime();
    const days = Math.ceil(diff / 86400000);
    return Number.isNaN(days) ? null : days;
  }, [mot?.expiry]);

  // With no lookup yet this is a no-data result, which is never rendered.
  const motAi = useMemo(() => motAiEngine(mot, mot?.history ?? []), [mot]);

  async function handleLookup() {
    if (!reg.trim()) {
      setRegError("Enter a registration before looking it up.");
      return;
    }
    setRegError(null);

    setLoading(true);
    const result = await fetchMOT(reg.trim().toUpperCase());
    setMot(result ? { ...result, history: sortMotHistoryDesc(result.history ?? []) } : result);
    setLoading(false);
    setAdded(false);

    if (!result) return;

    const match = inventoryVehicles.find(
      (v) => v.reg?.toUpperCase() === reg.trim().toUpperCase()
    );

    if (match) {
      // A vehicle you already own — refreshing its real MOT data is a
      // safe, non-destructive enrichment, so this stays automatic.
      const mapped = {
        expiry: result.expiry ?? "",
        advisories: result.advisories ?? [],
        historyScore: result.historyScore ?? 0,
        history: result.history ?? [],
        reg: result.reg ?? null,
        make: result.make ?? null,
        model: result.model ?? null,
        year: result.year ?? null,
        colour: result.colour ?? null,
        mileage: result.mileage ?? null,
        // updateVehicleMOT replaces the whole mot object rather than
        // merging, so leaving these out didn't just fail to update them —
        // it silently wiped a vehicle's real fuelType/euroStatus (ULEZ
        // display on VehicleList.tsx/VehicleOverview.tsx) on every MOT
        // refresh, even after they'd been correctly set some other way.
        fuelType: result.fuelType ?? null,
        euroStatus: result.euroStatus ?? null,
      };
      updateVehicleMOT(match.id, mapped);
      setMatchedVehicle({ id: match.id, make: match.make, model: match.model });
    } else {
      // Not one of your vehicles — this used to silently ADD it as a
      // new inventory item on every lookup, which would pollute real
      // stock with any car someone happened to check (a customer's own
      // car on an MOT booking, a trade-in you decided not to take).
      // Now it's a real, explicit choice instead.
      setMatchedVehicle(null);
    }
  }

  function handleAddAsNewVehicle() {
    if (!mot) return;
    createVehicleFromMOT(mot);
    setAdded(true);
  }

  if (!mot) {
    return (
      <div className="text-white">

        <h1 className="text-2xl font-bold mb-4">MOT Lookup</h1>

        <div className="flex gap-3 mb-6">
          <input
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            placeholder="Enter registration (e.g. AB12CDE)"
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none"
          />

          <button
            onClick={handleLookup}
            className="px-4 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition"
          >
            {loading ? "Loading..." : "Lookup"}
          </button>
        </div>

        {regError && <p className="text-red-400 mb-4">{regError}</p>}
        <p className="text-white/60">Enter a reg to fetch MOT history.</p>
      </div>
    );
  }

  const safeHistory = toMileageEntries(mot.history);

  const motWithStatus = { ...mot, motStatus };

  return (
    <div className="text-white">

      {/* SEARCH BAR */}
      <div className="flex gap-3 mb-6">
        <input
          value={reg}
          onChange={(e) => setReg(e.target.value)}
          placeholder="Enter registration"
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none"
        />

        <button
          onClick={handleLookup}
          className="px-4 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition"
        >
          Lookup
        </button>
      </div>

      {regError && <p className="text-red-400 mb-4">{regError}</p>}

      <MOTStatusCard
        status={motStatus}
        expiryDate={mot.expiry ?? null}
        theme={theme}
      />

      <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />

      <MOTHealthScore mot={mot} />

      <MotAiPassChance ai={motAi} theme={theme} />
      <MotAiVerdictCard ai={motAi} theme={theme} />

      <MOTAdvisoriesList advisories={mot.advisories ?? []} />
      <MOTMileageHistory history={safeHistory} />

      {mot.history && mot.history.length > 0 && (
        <div className="mt-3 rounded-xl p-4 border shadow-lg" style={{ backgroundColor: "#111827", borderColor: "#FFD700" }}>
          <h3 className="text-lg font-bold mb-3" style={{ color: "#FFD700" }}>
            Full Test History — most recent first
          </h3>
          {mot.history.map((h: any, i: number) => (
            <MotTestCard key={i} h={h} />
          ))}
        </div>
      )}

      <MOTInsightsPanel mot={motWithStatus} />

      {matchedVehicle && (
        <p className="mt-4 text-emerald-300 text-sm">
          Updated {matchedVehicle.make} {matchedVehicle.model}'s MOT record in your inventory.
        </p>
      )}

      {!matchedVehicle && (
        <div className="mt-4 rounded-xl border border-yellow-400/40 bg-black/40 p-4">
          <p className="text-white/70 text-sm mb-3">
            This reg isn't in your current stock — this was a read-only lookup.
          </p>
          <button
            onClick={handleAddAsNewVehicle}
            disabled={added}
            className="px-4 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition disabled:opacity-50"
          >
            {added ? "Added to Inventory" : "Add as New Vehicle"}
          </button>
        </div>
      )}
    </div>
  );
}
