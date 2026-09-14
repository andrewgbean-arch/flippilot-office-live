import React, { useState, useMemo } from "react";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { motAiEngine } from "@/engines/motAiEngine";

import { useInventory } from "@/context/InventoryProvider";

// MOT Components
import MOTStatusCard from "@/components/motors/MOTStatusCard";
import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";
import MOTAdvisoriesList from "@/components/motors/MOTAdvisoriesList";
import MOTFailuresList from "@/components/motors/MOTFailuresList";
import MOTMileageHistory from "@/components/motors/MOTMileageHistory";
import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";

// AI Components
import MotAiBuyerConfidence from "@/components/motors/MotAiBuyerConfidence";
import MotAiPassChance from "@/components/motors/MotAiPassChance";
import MotAiRiskGauge from "@/components/motors/MotAiRiskGauge";
import MotAiRadarChart from "@/components/motors/MotAiRadarChart";
import MotAiVerdictCard from "@/components/motors/MotAiVerdictCard";

const EMPTY_MOT_AI = motAiEngine({ advisories: [], history: [] } as any, []);

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
  const motStatus = useMemo(() => {
    const expiry = mot?.expiry;
    if (!expiry) return "Unknown";

    const exp = new Date(expiry);
    const now = new Date();

    if (exp < now) return "Expired";

    const days = (exp.getTime() - now.getTime()) / 86400000;
    if (days < 30) return "Expiring Soon";

    return "Valid";
  }, [mot?.expiry]);

  const daysLeft = useMemo(() => {
    const expiry = mot?.expiry;
    if (!expiry) return null;

    const exp = new Date(expiry);
    const now = new Date();

    const diff = exp.getTime() - now.getTime();
    return Math.ceil(diff / 86400000);
  }, [mot?.expiry]);

  const motAi = useMemo(() => (mot ? motAiEngine(mot, mot.history ?? []) : EMPTY_MOT_AI), [mot]);

  async function handleLookup() {
    if (!reg.trim()) return;

    setLoading(true);
    const result = await fetchMOT(reg.trim().toUpperCase());
    setMot(result);
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
      <div className="p-6 text-white">

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

        <p className="text-white/60">Enter a reg to fetch MOT history.</p>
      </div>
    );
  }

  const failedTests = mot.history
    ? mot.history
        .filter((h: any) => h.result?.toLowerCase() === "fail" && (h.failures?.length ?? 0) > 0)
        .map((h: any) => ({ date: h.date, year: h.year, mileage: h.mileage, testNumber: h.testNumber, failures: h.failures }))
    : [];

  const safeHistory = (mot.history ?? []).map((h: any) => ({
    date: h.date,
    year: h.year,
    mileage: h.mileage ?? mot.mileage ?? 0,
  }));

  const motWithStatus = { ...mot, motStatus };

  return (
    <div className="p-6 text-white">

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

      <MOTStatusCard
        status={motStatus}
        expiryDate={mot.expiry ?? null}
        theme={theme}
      />

      <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />

      <MOTHealthScore mot={mot} />

      <MotAiPassChance ai={motAi} theme={theme} />
      <MotAiBuyerConfidence ai={motAi} theme={theme} />
      <MotAiRiskGauge ai={motAi} theme={theme} />
      <MotAiRadarChart ai={motAi} theme={theme} />
      <MotAiVerdictCard ai={motAi} theme={theme} />

      <MOTAdvisoriesList advisories={mot.advisories ?? []} />
      <MOTFailuresList failedTests={failedTests} />
      <MOTMileageHistory history={safeHistory} />

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
