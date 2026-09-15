import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useConsumables } from "@/context/ConsumablesContext";

import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { SupernovaInput } from "@/components/supernova/SupernovaInput";

export default function ReconWorkflow() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { vehicles } = useInventory();
  const { costs, addCost, deleteCost } = useBookkeeping();
  const { consumables, recordStockMovement } = useConsumables();

  const vehicle = vehicles.find((v) => v.id === id);

  const [newItem, setNewItem] = useState("");
  const [newCost, setNewCost] = useState("");
  const [useStock, setUseStock] = useState(false);
  const [linkedConsumableId, setLinkedConsumableId] = useState("");
  const [qtyUsed, setQtyUsed] = useState("1");
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const linkedConsumable = useStock ? consumables.find((c) => c.id === linkedConsumableId) ?? null : null;

  // ⭐ Filter recon costs for this vehicle — kept above the "vehicle not
  // found" early return below so this hook always runs, every render,
  // regardless of whether InventoryProvider has finished loading yet.
  // It used to sit after the early return: on a fresh page load, the
  // first render (before vehicles have loaded) hits that return with
  // fewer hooks called than a later render once the real vehicle is
  // found — React throws "Rendered more hooks than during the previous
  // render" and the whole screen crashes to the error boundary, every
  // single time this route is opened directly (not just an edge case).
  const reconItems = vehicle ? costs.filter((c) => c.vehicleId === vehicle.id) : [];

  const totalRecon = useMemo(() => {
    return reconItems.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  }, [reconItems]);

  if (!vehicle) {
    return (
      <div className="text-white p-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
        >
          <FiArrowLeft /> Back
        </button>
        <p>Vehicle not found.</p>
      </div>
    );
  }

  /* -------------------------------------------------------
     ⭐ Add Recon Item
  ------------------------------------------------------- */
  const handleAddRecon = async () => {
  if (submitting) return; // guards against a double-click firing this twice mid-request

  if (!newItem.trim() || !newCost.trim()) {
    setAddError("Enter both an item description and a cost before adding.");
    return;
  }
  const qty = Number(qtyUsed) || 1;
  if (linkedConsumable && qty > linkedConsumable.currentStock) {
    setAddError(`Only ${linkedConsumable.currentStock}${linkedConsumable.unit ? ` ${linkedConsumable.unit}` : ""} of ${linkedConsumable.name} left in stock.`);
    return;
  }
  setAddError(null);
  setSubmitting(true);

  const amount = Number(newCost);

  // Deduct stock FIRST, before logging the cost — recordStockMovement
  // is the one call here with a real error to check (addCost is a
  // synchronous, fire-and-forget local update, same as the rest of
  // this bookkeeping module). Doing it this way round means a failed
  // deduction stops the whole add rather than leaving a cost entry on
  // record with no matching stock change — silently defeating the
  // exact accountability this feature exists for.
  if (linkedConsumable) {
    const stockError = await recordStockMovement(linkedConsumable.id, {
      type: "adjust",
      quantity: -qty,
      note: `Used on recon: ${vehicle.make} ${vehicle.model}`,
    });
    if (stockError) {
      setAddError(`Could not update stock — nothing was logged. ${stockError}`);
      setSubmitting(false);
      return;
    }
  }

  addCost({
    id: crypto.randomUUID(),
    vehicleId: vehicle.id,

    // ⭐ Recon cost type
    type: "recon",

    // ⭐ Recon item name
    label: newItem,

    // ⭐ Category grouping
    category: "Recon",

    // ⭐ Amount
    amount,

    // ⭐ VAT fields (recon usually has no VAT reclaim)
    vatRate: 0,
    vatIncluded: false,
    vatReclaimable: false,
    vatAmount: 0,
    netAmount: amount,

    // ⭐ Optional fields
    supplier: undefined,
    notes: undefined,
    ...(linkedConsumable
      ? {
          consumableId: linkedConsumable.id,
          quantityUsed: qty,
          ...(linkedConsumable.partNumber ? { partNumber: linkedConsumable.partNumber } : {}),
        }
      : {}),

    // ⭐ Date
    date: new Date().toISOString(),
  });

  setSubmitting(false);
  setNewItem("");
  setNewCost("");
  setLinkedConsumableId("");
  setQtyUsed("1");
};

/* -------------------------------------------------------
   ⭐ Remove Recon Item — there was previously no way at all to
   correct a mistake (wrong item, wrong quantity) once logged, even
   though deleteCost already existed and was used elsewhere in this
   app. Matters more now than it used to: a stock-linked entry's
   deduction is real, so removing the cost without also giving the
   stock back would leave Consumables permanently short by whatever
   was wrongly logged.
------------------------------------------------------- */
const handleRemoveRecon = async (item: (typeof reconItems)[number]) => {
  setRemovingId(item.id);
  if (item.consumableId && item.quantityUsed) {
    // Same sign convention as the deduction itself, just reversed —
    // logged as its own real, visible "returned" entry in that item's
    // stock history, not a silent correction.
    await recordStockMovement(item.consumableId, {
      type: "adjust",
      quantity: item.quantityUsed,
      note: `Recon item removed: ${item.label}`,
    });
  }
  deleteCost(item.id);
  setRemovingId(null);
};



  return (
    <div className="text-white bg-[#0A1128] min-h-screen p-10 animate-fadeIn">
      {/* ⭐ Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/70 hover:text-white transition mb-6"
      >
        <FiArrowLeft /> Back
      </button>

      <SupernovaHeroHeader
        title={`Recon Workflow: ${vehicle.make} ${vehicle.model}`}
        subtitle="Dealer AI • Vehicle Preparation & Costs"
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ⭐ Recon Summary */}
        <SupernovaSectionDivider label="Recon Summary" />

        <SupernovaGlowCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-white/60 text-sm">Total Recon Cost</p>
              <p className="text-yellow-300 font-bold text-xl">
                £{totalRecon.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Recon Items</p>
              <p className="text-white font-bold text-xl">
                {reconItems.length}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">AI Recon Estimate</p>
              <p className="text-white font-bold text-xl">
                £{Math.max(150, (vehicle.mileage ?? vehicle.mot?.mileage ?? 60000) / 10).toFixed(0)}
              </p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Status</p>
              <p className="text-green-400 font-bold text-xl">
                {reconItems.length > 0 ? "In Progress" : "Not Started"}
              </p>
            </div>
          </div>
        </SupernovaGlowCard>

        {/* ⭐ Add Recon Item */}
        <SupernovaSectionDivider label="Add Recon Item" />

        <SupernovaGlowCard>
          <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={useStock}
              onChange={(e) => {
                setUseStock(e.target.checked);
                if (!e.target.checked) setLinkedConsumableId("");
              }}
            />
            Use a real item from Consumables stock (unticked = direct/one-off, e.g. labour)
          </label>

          {useStock && (
            <select
              value={linkedConsumableId}
              onChange={(e) => {
                const consumableId = e.target.value;
                setLinkedConsumableId(consumableId);
                const c = consumables.find((x) => x.id === consumableId);
                if (c) setNewItem(c.name);
              }}
              className="w-full p-2 rounded bg-black/40 border border-white/20 text-white/80 mb-4"
            >
              <option value="">— Choose a stock item —</option>
              {consumables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.partNumber ? ` (${c.partNumber})` : ""} — {c.currentStock}{c.unit ? ` ${c.unit}` : ""} in stock
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SupernovaInput
              label="Recon Item"
              value={newItem}
              onChange={setNewItem}
              placeholder="Tyres, brakes, MOT prep..."
            />

            {linkedConsumable && (
              <SupernovaInput
                label="Quantity Used"
                value={qtyUsed}
                onChange={setQtyUsed}
                placeholder="1"
              />
            )}

            <SupernovaInput
              label="Cost (£)"
              value={newCost}
              onChange={setNewCost}
              placeholder="150"
            />

            <SupernovaGlowButton label={submitting ? "Adding…" : "Add"} onClick={handleAddRecon} disabled={submitting} />
          </div>
          {linkedConsumable && (
            <p className="text-white/50 text-xs mt-3">
              Adding this will deduct {qtyUsed || 1}{linkedConsumable.unit ? ` ${linkedConsumable.unit}` : ""} from {linkedConsumable.name}'s stock ({linkedConsumable.currentStock} currently).
            </p>
          )}
          {addError && <p className="text-red-400 text-sm mt-3">{addError}</p>}
        </SupernovaGlowCard>

        {/* ⭐ Recon Items List */}
        <SupernovaSectionDivider label="Recon Items" />

        {reconItems.length === 0 ? (
          <p className="text-white/60 text-center text-lg">
            No recon items added yet.
          </p>
        ) : (
          reconItems.map((item) => {
            const stockItem = item.consumableId ? consumables.find((c) => c.id === item.consumableId) : null;
            return (
              <SupernovaGlowCard key={item.id}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">
                      {item.label}
                      {item.partNumber && <span className="text-white/50 font-normal"> · {item.partNumber}</span>}
                    </p>
                    <p className="text-white/60 text-sm">
                      {new Date(item.date).toLocaleDateString()}
                      {stockItem && (
                        <span className={stockItem.currentStock <= stockItem.reorderThreshold ? "text-red-400" : "text-white/60"}>
                          {" "}· {stockItem.currentStock}{stockItem.unit ? ` ${stockItem.unit}` : ""} left in stock
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-yellow-300 font-bold text-xl">
                      £{item.amount}
                    </p>
                    <button
                      onClick={() => handleRemoveRecon(item)}
                      disabled={removingId === item.id}
                      className="px-3 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {removingId === item.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              </SupernovaGlowCard>
            );
          })
        )}
      </div>
    </div>
  );
}
