import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useInventory } from "../../context/InventoryProvider";
import { ReconAIEngine } from "../../core/recon/ReconAIEngine";

export default function ReconPlanScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useInventory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return <div className="p-6 text-white">Vehicle not found.</div>;
  }

  const reconItems = ReconAIEngine.generate(vehicle);

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition"
      >
        <FiArrowLeft /> Back
      </button>

      <h1 className="text-2xl font-bold text-white/80">
        AI Recon Plan — {vehicle.make} {vehicle.model}
      </h1>

      <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-white/80">
          <thead className="bg-black/30 text-white/60">
            <tr>
              <th className="p-3 text-left">Task</th>
              <th className="p-3 text-left">Est. Cost</th>
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">Risk</th>
              <th className="p-3 text-left">Recommendation</th>
            </tr>
          </thead>

          <tbody>
            {reconItems.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/10 hover:bg-white/5 transition"
              >
                <td className="p-3">{item.name}</td>
                <td className="p-3">£{item.estimatedCost}</td>
                <td className="p-3">{item.priority}</td>
                <td className="p-3">{item.risk}%</td>
                <td className="p-3 text-yellow-300 font-semibold">
                  {item.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
