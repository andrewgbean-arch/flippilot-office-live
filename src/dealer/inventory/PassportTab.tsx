import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDealer } from "@/context/DealerContext";
import { loadPassportSetup, savePassportSettings, type PassportSetup } from "@/lib/carPassportApi";
import type { Vehicle } from "@/types/Vehicle";
import PassportEditor, { type SaveResult } from "./PassportEditor";
import { formatPrice, isSold, registrationOf, vehicleTitle } from "./vehicleListModel";
import { hasMotRecord } from "./stockFacts";

// The "Car Passport" tab on a vehicle: loads this car's settings and hands them
// to the editor. Who may publish is decided by the server; the screen only
// reflects it (sales, managers and the owner can edit; everyone else can look).
export default function PassportTab({ vehicle }: { vehicle: Vehicle }) {
  const { user } = useAuth();
  const { dealer } = useDealer();
  const [setup, setSetup] = useState<PassportSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vehicleId = String(vehicle.id);

  useEffect(() => {
    let cancelled = false;
    setSetup(null);
    setError(null);
    loadPassportSetup(vehicleId).then(res => {
      if (cancelled) return;
      if (res.ok && res.data) setSetup(res.data);
      else setError(res.error || "Couldn't load this car's passport settings.");
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!setup || !user) return <p className="text-white/70">Loading…</p>;

  const canEdit = user.role === "owner" || user.staffRole === "sales" || user.staffRole === "manager";
  const fuel = vehicle.mot?.fuelType;

  async function save(draft: Parameters<typeof savePassportSettings>[1]): Promise<SaveResult> {
    const res = await savePassportSettings(vehicleId, draft);
    if (res.ok && res.data) return { ok: true, config: res.data };
    return { ok: false, error: res.error || "Couldn't save. Try again." };
  }

  return (
    <PassportEditor
      vehicleId={vehicleId}
      dealershipId={user.dealershipId}
      origin={window.location.origin}
      dealerName={dealer?.name ?? ""}
      facts={{
        title: [vehicle.year, vehicleTitle(vehicle)].filter(Boolean).join(" "),
        priceText: formatPrice(vehicle.priceRetail),
        reg: registrationOf(vehicle),
        sold: isSold(vehicle),
        hasMotRecord: hasMotRecord(vehicle),
        hasFuelType: typeof fuel === "string" && fuel.trim() !== "",
      }}
      initial={setup}
      canEdit={canEdit}
      save={save}
    />
  );
}
