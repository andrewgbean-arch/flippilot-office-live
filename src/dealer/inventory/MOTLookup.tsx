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

export default function MOTLookup() {
  const [reg, setReg] = useState("");
  const [mot, setMot] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const {
    vehicles: inventoryVehicles,
    updateVehicleMOT,
    createVehicleFromMOT,
  } = useInventory();

  const theme = {
    card: "#0A0F1F",
    accent: "#FFD700",
    text: "#AAB4C3",
    goldDeep: "#C5A100",
    goldSoftGlow: "#FFD70055",
    blackSoft: "#1A1F2B",
  };

  async function handleLookup() {
    if (!reg.trim()) return;

    setLoading(true);
    const result = await fetchMOT(reg.trim().toUpperCase());
    setMot(result);
    setLoading(false);

    if (!result) return;

    // ⭐ AUTO‑MATCH VEHICLE BY REG
    const matchedVehicle = inventoryVehicles.find(
      (v) => v.reg?.toUpperCase() === reg.trim().toUpperCase()
    );

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

    if (matchedVehicle) {
      // ⭐ UPDATE EXISTING VEHICLE
      updateVehicleMOT(matchedVehicle.id, mapped);
    } else {
      // ⭐ AUTO‑CREATE NEW VEHICLE
      createVehicleFromMOT(result);
    }
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

  // ⭐ MOT Status
  const motStatus = useMemo(() => {
    const expiry = mot.expiry;
    if (!expiry) return "Unknown";

    const exp = new Date(expiry);
    const now = new Date();

    if (exp < now) return "Expired";

    const days = (exp.getTime() - now.getTime()) / 86400000;
    if (days < 30) return "Expiring Soon";

    return "Valid";
  }, [mot.expiry]);

  // ⭐ Days Left
  const daysLeft = useMemo(() => {
    const expiry = mot.expiry;
    if (!expiry) return null;

    const exp = new Date(expiry);
    const now = new Date();

    const diff = exp.getTime() - now.getTime();
    return Math.ceil(diff / 86400000);
  }, [mot.expiry]);

  // ⭐ Failures derived from history
  const failures = mot.history
    ? mot.history
        .filter((h: any) => h.result?.toLowerCase() === "fail")
        .flatMap((h: any) => h.failures ?? [])
    : [];

  // ⭐ Mileage history
  const safeHistory = mot.history.map((h: any) => ({
    date: h.date,
    mileage: h.mileage ?? mot.mileage ?? 0,
  }));

  // ⭐ AI Data
 const motAi = useMemo(() => motAiEngine(mot, mot.history ?? []), [mot]);


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
      <MOTFailuresList failures={failures} />
      <MOTMileageHistory history={safeHistory} />

      <MOTInsightsPanel mot={motWithStatus} />
    </div>
  );
}
