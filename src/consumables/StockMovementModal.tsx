import { useState } from "react";
import { useConsumables } from "@/context/ConsumablesContext";
import type { Consumable } from "./consumableTypes";

interface StockMovementModalProps {
  item: Consumable;
  onClose: () => void;
}

export default function StockMovementModal({ item, onClose }: StockMovementModalProps) {
  const { recordStockMovement } = useConsumables();
  const [type, setType] = useState<"receive" | "adjust">("receive");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState(item.supplierName ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const history = [...(item.movements ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  async function handleLog() {
    const qty = Number(quantity);
    if (!qty || (type === "receive" && qty <= 0)) {
      setError(type === "receive" ? "Enter how many arrived" : "Enter a nonzero adjustment");
      return;
    }
    setSaving(true);
    setError(null);

    const err = await recordStockMovement(item.id, {
      type,
      quantity: type === "adjust" ? qty : Math.abs(qty),
      date,
      ...(type === "receive" && cost.trim() ? { cost: Number(cost) } : {}),
      ...(type === "receive" && supplier.trim() ? { supplier: supplier.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setQuantity("1");
    setCost("");
    setNote("");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-1">{item.name}</h2>
        <p className="text-white/50 text-sm mb-4">
          Currently {item.currentStock}{item.unit ? ` ${item.unit}` : ""} in stock
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setType("receive")}
            className={`flex-1 px-3 py-2 rounded text-sm font-semibold ${type === "receive" ? "bg-yellow-500 text-black" : "bg-white/10 text-white/60"}`}
          >
            Receive Delivery
          </button>
          <button
            onClick={() => setType("adjust")}
            className={`flex-1 px-3 py-2 rounded text-sm font-semibold ${type === "adjust" ? "bg-yellow-500 text-black" : "bg-white/10 text-white/60"}`}
          >
            Correct Count
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/60 text-sm">
              {type === "receive" ? "Quantity received" : "Adjustment (+/-)"}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
        </div>

        {type === "receive" && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-white/60 text-sm">Cost (optional)</label>
              <input
                type="number"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="£"
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm">Supplier</label>
              <input
                type="text"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
              />
            </div>
          </div>
        )}

        <label className="text-white/60 text-sm">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={type === "receive" ? "e.g. PO number, invoice ref" : "e.g. found 2 fewer on stock take"}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex justify-end gap-3 mb-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Close
          </button>
          <button
            onClick={handleLog}
            disabled={saving}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
          >
            {saving ? "…" : type === "receive" ? "Log Delivery" : "Log Correction"}
          </button>
        </div>

        <h3 className="text-white/70 text-sm font-semibold mb-2">History</h3>
        {history.length === 0 ? (
          <p className="text-white/40 text-sm">No stock movements logged yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(m => (
              <div key={m.id} className="flex justify-between items-start border-b border-white/10 pb-2 text-sm">
                <div>
                  <span className={m.type === "receive" ? "text-green-400" : "text-blue-300"}>
                    {m.type === "receive" ? "Received" : "Adjusted"}
                  </span>
                  {" "}
                  <span className="text-white/80">
                    {m.quantity > 0 ? "+" : ""}{m.quantity}{item.unit ? ` ${item.unit}` : ""}
                  </span>
                  {(m.supplier || m.note) && (
                    <div className="text-white/40 text-xs mt-0.5">
                      {[m.supplier, m.note].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="text-right text-white/50 text-xs">
                  <div>{m.date}</div>
                  {m.cost != null && <div>£{m.cost.toFixed(2)}</div>}
                  {m.createdBy && <div>{m.createdBy}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
