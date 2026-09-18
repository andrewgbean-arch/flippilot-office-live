import { useState } from "react";
import { useConsumables } from "@/context/ConsumablesContext";
import type { Consumable } from "./consumableTypes";

interface AddConsumableModalProps {
  existing?: Consumable;
  onClose: () => void;
}

export default function AddConsumableModal({ existing, onClose }: AddConsumableModalProps) {
  const { addConsumable, updateConsumable } = useConsumables();
  const [name, setName] = useState(existing?.name ?? "");
  const [partNumber, setPartNumber] = useState(existing?.partNumber ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [currentStock, setCurrentStock] = useState(String(existing?.currentStock ?? 0));
  const [reorderThreshold, setReorderThreshold] = useState(String(existing?.reorderThreshold ?? 5));
  const [supplierName, setSupplierName] = useState(existing?.supplierName ?? "");
  const [supplierEmail, setSupplierEmail] = useState(existing?.supplierEmail ?? "");
  const [supplierPhone, setSupplierPhone] = useState(existing?.supplierPhone ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const fields = {
      name: name.trim(),
      ...(partNumber.trim() ? { partNumber: partNumber.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
      currentStock: Number(currentStock) || 0,
      reorderThreshold: Number(reorderThreshold) || 0,
      ...(supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      ...(supplierEmail.trim() ? { supplierEmail: supplierEmail.trim() } : {}),
      ...(supplierPhone.trim() ? { supplierPhone: supplierPhone.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    if (existing) {
      const ok = await updateConsumable(existing.id, fields);
      setSaving(false);
      if (!ok) {
        setError("Couldn't save because your consumables couldn't be loaded. Nothing was changed — try again shortly.");
        return;
      }
      onClose();
      return;
    }

    const err = await addConsumable(fields);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">{existing ? "Edit Consumable" : "Add Consumable"}</h2>

        <label className="text-white/60 text-sm">Item Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Screen wash, oil filters, valeting shampoo..."
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/60 text-sm">Part Number (optional)</label>
            <input
              type="text"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
              placeholder="e.g. supplier's SKU/part code"
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What it is / spec, e.g. 5L 5W-30 synthetic"
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/60 text-sm">
              {existing ? "Current Stock" : "Starting Stock"}
            </label>
            <input
              type="number"
              value={currentStock}
              onChange={e => setCurrentStock(e.target.value)}
              disabled={!!existing}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 disabled:opacity-50"
            />
            {existing && (
              <p className="text-white/40 text-xs mt-1">Use "Stock" on the item's row to log a delivery or correction.</p>
            )}
          </div>
          <div>
            <label className="text-white/60 text-sm">Reorder Below</label>
            <input
              type="number"
              value={reorderThreshold}
              onChange={e => setReorderThreshold(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
        </div>

        <label className="text-white/60 text-sm">Unit (optional)</label>
        <input
          type="text"
          value={unit}
          onChange={e => setUnit(e.target.value)}
          placeholder="bottles, boxes, litres..."
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Supplier Name (optional)</label>
        <input
          type="text"
          value={supplierName}
          onChange={e => setSupplierName(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Supplier Email (optional — needed for the Order button)</label>
        <input
          type="email"
          value={supplierEmail}
          onChange={e => setSupplierEmail(e.target.value)}
          placeholder="orders@supplier.com"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Supplier Phone (optional)</label>
        <input
          type="text"
          value={supplierPhone}
          onChange={e => setSupplierPhone(e.target.value)}
          placeholder="01803 555 777"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
          >
            {saving ? "…" : existing ? "Save Changes" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
