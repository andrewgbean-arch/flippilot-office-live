import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";

import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";

import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTInsightsPanel from "@/components/motors/MOTInsightsPanel";

import { useInventory } from "@/context/InventoryProvider";
import { hasMotData } from "@/engines/motAiEngine";
import { isSold, motState, registrationOf, vehicleTitle } from "@/dealer/inventory/vehicleListModel";

const STATE_COLOUR = {
  expired: "text-red-400",
  soon: "text-yellow-300",
  valid: "text-emerald-300",
  unknown: "text-white/60",
} as const;

export default function MOTWorkflowPortfolio() {
  const { vehicles } = useInventory();

  // Cars you still have. Sold cars used to be listed here too.
  const inStock = vehicles.filter((v) => !isSold(v));
  const now = new Date();

  // Expired or due within 30 days, most urgent (earliest expiry) first. The
  // three cards below used to show whichever such car happened to come first
  // in stock order, without naming it.
  const needingAttention = inStock
    .map((v) => ({ v, state: motState(v.mot?.expiry, now) }))
    .filter(({ state }) => state.kind === "expired" || state.kind === "soon")
    .sort((a, b) => new Date(a.v.mot.expiry).getTime() - new Date(b.v.mot.expiry).getTime());

  // Cars with no MOT record at all are a gap worth seeing, not a "clear".
  const noMotData = inStock.filter((v) => !hasMotData(v.mot));

  const selected = needingAttention[0]?.v;

  // ⭐ Calculate days left for the countdown card
  const daysLeft = selected
    ? Math.ceil(
        (new Date(selected.mot.expiry).getTime() - Date.now()) / 86400000
      )
    : null;

  // ⭐ Simple theme object for the countdown card
  const theme = {
    card: "rgba(10,17,40,0.65)",
    goldDeep: "#B8860B",
  };

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="MOT Workflow"
        subtitle="Track MOT expiries and MOT risk across your stock."
      />

      <SupernovaSectionDivider label="Most urgent vehicle" />

      {selected && (
        <p className="text-white/80">
          Showing {vehicleTitle(selected)}
          {registrationOf(selected) ? ` (${registrationOf(selected)})` : ""}, the car in stock whose MOT runs out first.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <MOTHealthScore mot={selected?.mot} />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          {selected ? (
            <MOTInsightsPanel mot={selected.mot} />
          ) : (
            <p className="text-white/60">No vehicle in stock has an MOT that is expired or due within 30 days.</p>
          )}
        </SupernovaGlowCard>
      </div>

      <SupernovaSectionDivider label="Vehicles Needing MOT Attention" />

      <SupernovaGlowCard>
        {needingAttention.length === 0 ? (
          <p className="text-white/60">
            No vehicle in stock has an MOT that is expired or due within 30 days.
          </p>
        ) : (
          <div className="space-y-4">
            {needingAttention.map(({ v, state }) => (
              <div
                key={v.id}
                className="p-4 bg-black/40 border border-white/10 rounded-lg"
              >
                <div className="text-white font-semibold">
                  {vehicleTitle(v)}
                  {registrationOf(v) ? ` (${registrationOf(v)})` : ""}
                </div>

                <div className="text-xs">
                  <span className="text-white/60">MOT Expiry: {state.date ?? "Not recorded"}</span>
                  <span className={`ml-2 ${STATE_COLOUR[state.kind]}`}>{state.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="No MOT data recorded" />

      <SupernovaGlowCard>
        {noMotData.length === 0 ? (
          <p className="text-white/60">Every vehicle in stock has an MOT record.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-white/60 text-sm">
              These cars have no MOT expiry date or test history on record, so they are not counted above.
              Look up each registration on MOT Lookup.
            </p>
            {noMotData.map((v) => (
              <div
                key={v.id}
                className="p-4 bg-black/40 border border-white/10 rounded-lg"
              >
                <div className="text-white font-semibold">
                  {vehicleTitle(v)}
                  {registrationOf(v) ? ` (${registrationOf(v)})` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </SupernovaGlowCard>
    </div>
  );
}
