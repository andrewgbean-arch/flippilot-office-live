import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "@/components/supernova/SupernovaMetricBar";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

export default function ReconWorkflow() {
  const { id } = useParams();
  const vehicleId = id as string;
  const navigate = useNavigate();

  const { vehicles } = useVehicleHistory();
  const { costs } = useBookkeeping();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleCosts = costs.filter((c) => c.vehicleId === vehicleId);

  const [tasks, setTasks] = useState([
    { id: "1", label: "Full Service", done: false },
    { id: "2", label: "Brake Inspection", done: false },
    { id: "3", label: "Interior Valet", done: false },
    { id: "4", label: "Bodywork Check", done: false },
  ]);

  if (!vehicle) {
    return (
      <div className="p-10 text-white">
        <h1 className="text-2xl font-bold text-red-400">Vehicle Not Found</h1>
        <p className="text-white/60 mt-2">
          This vehicle does not exist in your inventory records.
        </p>
      </div>
    );
  }

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      )
    );
  };

  const completion = Math.round(
    (tasks.filter((t) => t.done).length / tasks.length) * 100
  );

  const reconCost = vehicleCosts.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="px-6 py-10 space-y-10 text-white animate-fadeIn">

 <SupernovaHeroHeader
  title="Recon Workflow"
  subtitle={vehicle.title ?? `${vehicle.make} ${vehicle.model}`}
/>



      {/* RECON HEALTH */}
      <SupernovaSectionDivider label="Recon Health Overview" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Completion"
            value={completion}
            color="#4ade80"
          />
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Recon Cost"
            value={Math.min(100, reconCost / 20)}
            color="#facc15"
          />
          <p className="text-yellow-300 font-bold mt-2">
            £{reconCost.toLocaleString()}
          </p>
        </SupernovaGlowCard>

        <SupernovaGlowCard>
          <SupernovaMetricBar
            label="Workshop Load"
            value={72}
            color="#60a5fa"
          />
        </SupernovaGlowCard>
      </div>

      {/* TASK LIST */}
      <SupernovaSectionDivider label="Recon Tasks" />

      <SupernovaGlowCard>
        <div className="space-y-4">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-lg"
            >
              <span className="text-white">{t.label}</span>
              <button
                onClick={() => toggleTask(t.id)}
                className={`px-3 py-1 rounded font-bold ${
                  t.done
                    ? "bg-green-500 text-black"
                    : "bg-white/10 text-white/70"
                }`}
              >
                {t.done ? "Done" : "Pending"}
              </button>
            </div>
          ))}
        </div>
      </SupernovaGlowCard>

      {/* PARTS & LABOUR */}
      <SupernovaSectionDivider label="Parts & Labour Costs" />

      <SupernovaGlowCard>
        {vehicleCosts.length > 0 ? (
          <div className="space-y-4">
            {vehicleCosts.map((c) => (
              <div
                key={c.id}
                className="border border-white/20 rounded-xl p-4 bg-black/20"
              >
                <p className="text-white/80">{c.notes}</p>
                <p className="text-yellow-400 font-bold">£{c.amount}</p>
                <p className="text-white/40 text-sm">{c.date}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60">No recon costs recorded yet.</p>
        )}

        <div className="mt-4">
          <SupernovaGlowButton
            label="Add Parts & Labour"
            onClick={() => navigate(`/dealer/inventory/parts-labour/${vehicleId}`)}
          />
        </div>
      </SupernovaGlowCard>

      {/* WORKFLOW BUTTONS */}
      <SupernovaSectionDivider label="Next Steps" />

      <div className="flex gap-4">
        <SupernovaGlowButton
          label="Pricing Workflow"
          onClick={() => navigate(`/dealer/workflow/pricing/${vehicleId}`)}
        />

        <SupernovaGlowButton
          label="Photos Workflow"
          onClick={() => navigate(`/dealer/workflow/photos/${vehicleId}`)}
        />

        <SupernovaGlowButton
          label="MOT Workflow"
          onClick={() => navigate(`/dealer/workflow/mot/${vehicleId}`)}
        />
      </div>
    </div>
  );
}
