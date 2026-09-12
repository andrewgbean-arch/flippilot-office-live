import React, { useState } from "react";
import BookkeepingTable from "@/bookkeeping/BookkeepingTable";
import AddCostModal from "@/bookkeeping/AddCostModal"; // you will create this in Module 2

export interface CostsTabProps {
  vehicleId: string;
}

const CostsTab: React.FC<CostsTabProps> = ({ vehicleId }) => {
  const [showAdd, setShowAdd] = useState(false);

  // TEMP: until provider exists
  const addCost = (entry: any) => {
    console.log("Cost added (provider coming in Module 3):", entry);
  };

  return (
    <div className="p-6">

      {/* ADD COST BUTTON */}
      <button
        onClick={() => setShowAdd(true)}
        className="mb-4 px-4 py-2 rounded bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
      >
        + Add Cost
      </button>

      {/* MODAL */}
{showAdd && (
  <AddCostModal
    vehicleId={vehicleId}
    onClose={() => setShowAdd(false)}
  />
)}


      {/* TABLE */}
      <BookkeepingTable vehicleId={vehicleId} />
    </div>
  );
};

export default CostsTab;
