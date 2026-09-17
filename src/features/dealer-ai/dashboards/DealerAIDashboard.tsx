// src/features/dealer-ai/dashboards/DealerDashboard.tsx
import React from "react";
import SupernovaCard from "../../../components/SupernovaCard";

type DealerDashboardProps = {
  brain: any;
};

// Every card here used to just dump JSON.stringify(core.xxx) straight
// into a <pre> tag — a real, visible "it's all typescript" bug a real
// user would see immediately (raw object literals, no formatting).
// Shapes below match dealerAICommandCenter's real return value exactly
// (see SuperBrainEngine.ts's flipPilotMasterBrain — its own comment
// there spells out precisely which keys this component reads).

function bandColor(band: string): string {
  const b = band.toLowerCase();
  if (["elite", "excellent", "strong", "high growth", "prime acquisition", "high priority", "hot lead", "increase", "increase recommended"].some(s => b.includes(s)))
    return "text-green-300";
  if (["weak", "critical", "avoid", "decrease", "cold lead", "low priority"].some(s => b.includes(s)))
    return "text-red-300";
  return "text-yellow-300";
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
      <span className="text-white/50">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function ScoreBand({ score, band, suffix = "" }: { score: number; band: string; suffix?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-gold">{score}{suffix}</span>
      <span className={`text-sm font-semibold ${bandColor(band)}`}>{band}</span>
    </div>
  );
}

function VehicleList<T>({
  items,
  vehicles,
  renderRow,
}: {
  items: T[];
  vehicles?: any[];
  renderRow: (item: T, label: string) => React.ReactNode;
}) {
  if (items.length === 0) return <p className="text-white/50 text-sm">No vehicles in stock.</p>;
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {items.map((item, i) => {
        const v = (item as any).vehicle ?? vehicles?.[i];
        const label = v?.title || [v?.make, v?.model].filter(Boolean).join(" ") || `Vehicle ${i + 1}`;
        return <React.Fragment key={i}>{renderRow(item, label)}</React.Fragment>;
      })}
    </div>
  );
}

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

export default function DealerDashboard({ brain }: DealerDashboardProps) {
  // MasterBrainScreen already unwraps flipPilotMasterBrain's result down
  // to just the mode's brain payload before passing it here (same as
  // GroupDashboard/OEMDashboard/GlobalDashboard/PlanetDashboard all
  // expect) — reading `brain.brain` again was a leftover double-unwrap
  // that made this undefined and crashed on `core.health`.
  const core = brain;
  const vehicles = core.rotation?.map((r: any) => r.vehicle) ?? [];

  return (
    <div className="space-y-6">

      <div className="text-gold text-3xl font-bold mb-4">
        Dealer AI Dashboard
      </div>

      <SupernovaCard title="Status">
        <p className="text-xl">🟢 Dealer AI Active</p>
      </SupernovaCard>

      <SupernovaCard title="Health Score">
        <ScoreBand score={core.health.score} band={core.health.band} />
      </SupernovaCard>

      <SupernovaCard title="Growth Projection">
        <Stat label="Projected Sales (Next Quarter)" value={core.growth.projectedSalesNextQuarter} />
        <Stat label="Projected Profit (Next Quarter)" value={money(core.growth.projectedProfitNextQuarter)} />
        <Stat label="Risk Index" value={core.growth.risk} />
        <Stat label="Growth Band" value={<span className={bandColor(core.growth.growthBand)}>{core.growth.growthBand}</span>} />
      </SupernovaCard>

      <SupernovaCard title="Efficiency">
        <ScoreBand score={core.efficiency.efficiency} band={core.efficiency.band} />
      </SupernovaCard>

      {/* strategy.growth/efficiency/health duplicate the cards above —
          only the actual recommendation is new information here. */}
      <SupernovaCard title="Strategy">
        <p className="text-lg font-semibold text-gold">{core.strategy.strategy}</p>
      </SupernovaCard>

      <SupernovaCard title="Pricing Engine">
        <VehicleList
          items={core.pricing}
          vehicles={vehicles}
          renderRow={(p: any, label) => (
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/70">{label}</span>
              <span className="text-right">
                <span className="text-white">{money(p.recommendedPrice)}</span>{" "}
                <span className={`text-xs ${bandColor(p.band)}`}>({p.band})</span>
              </span>
            </div>
          )}
        />
      </SupernovaCard>

      <SupernovaCard title="Rotation Engine">
        <VehicleList
          items={core.rotation}
          renderRow={(r: any, label) => (
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/70">{label}</span>
              <span className="text-white">{r.action}</span>
            </div>
          )}
        />
      </SupernovaCard>

      <SupernovaCard title="Profit Maximizer">
        <VehicleList
          items={core.profitMax}
          vehicles={vehicles}
          renderRow={(p: any, label) => (
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/70">{label}</span>
              <span className="text-white">{money(p.optimizedProfit)} profit</span>
            </div>
          )}
        />
      </SupernovaCard>

      <SupernovaCard title="CRM Intelligence">
        {core.crm.length === 0 ? (
          <p className="text-white/50 text-sm">No leads yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {core.crm.map((c: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
                <span className="text-white/70">{c.lead?.name ?? `Lead ${i + 1}`}</span>
                <span className={`text-xs ${bandColor(c.band)}`}>{c.band}</span>
              </div>
            ))}
          </div>
        )}
      </SupernovaCard>

      <SupernovaCard title="Lifecycle Intelligence">
        <VehicleList
          items={core.lifecycle}
          vehicles={vehicles}
          renderRow={(l: any, label) => (
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/70">{label}</span>
              <span className="text-white">{l.futureStage}</span>
            </div>
          )}
        />
      </SupernovaCard>

      <SupernovaCard title="Acquisition Planner">
        <VehicleList
          items={core.acquisition}
          renderRow={(a: any, label) => (
            <div className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/70">{label}</span>
              <span className={`text-xs ${bandColor(a.band)}`}>{a.band}</span>
            </div>
          )}
        />
      </SupernovaCard>

    </div>
  );
}
