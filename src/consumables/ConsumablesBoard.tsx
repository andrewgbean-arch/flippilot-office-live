import { useState } from "react";
import { useConsumables } from "@/context/ConsumablesContext";
import { useDealer } from "@/context/DealerContext";
import AddConsumableModal from "./AddConsumableModal";
import type { Consumable } from "./consumableTypes";
import "@/staff/StaffDashboard.css";

export default function ConsumablesBoard() {
  const { consumables, loading, updateStock, removeConsumable } = useConsumables();
  const { dealer } = useDealer();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Consumable | null>(null);

  const lowStock = consumables.filter(c => c.currentStock <= c.reorderThreshold);

  function mailtoFor(item: (typeof consumables)[number]): string | null {
    if (!item.supplierEmail) return null;
    const subject = `Order Request: ${item.name}`;
    const body = [
      `Hi,`,
      ``,
      `Please could we order more ${item.name}${item.unit ? ` (${item.unit})` : ""}.`,
      `Current stock: ${item.currentStock}${item.unit ? ` ${item.unit}` : ""} (reorder threshold: ${item.reorderThreshold}).`,
      ``,
      `Thanks,`,
      dealer?.name ?? "",
    ].join("\n");
    return `mailto:${item.supplierEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Consumables</h1>
          <p className="sn-hero__subtitle">Stock levels for day-to-day supplies, and a one-click order to your supplier.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">
              Stock{lowStock.length > 0 ? ` — ${lowStock.length} low` : ""}
            </h2>
            <button className="sn-btn sn-btn--gold" onClick={() => setShowAdd(true)}>
              Add Consumable
            </button>
          </div>

          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : consumables.length === 0 ? (
            <p className="sn-empty">No consumables tracked yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sn-timeclock__table sn-rota-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Stock</th>
                    <th>Reorder Below</th>
                    <th>Supplier</th>
                    <th>Order</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map(item => {
                    const low = item.currentStock <= item.reorderThreshold;
                    const mailto = mailtoFor(item);
                    return (
                      <tr key={item.id}>
                        <td style={low ? { color: "#ff8080", fontWeight: 600 } : undefined}>
                          {item.name}
                          {item.unit ? ` (${item.unit})` : ""}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="sn-input"
                            style={{ width: 80 }}
                            defaultValue={item.currentStock}
                            onBlur={e => updateStock(item.id, Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>{item.reorderThreshold}</td>
                        <td>
                          {item.supplierName ?? "—"}
                          {item.supplierPhone && (
                            <div className="sn-empty" style={{ fontSize: 12 }}>
                              {item.supplierPhone}
                            </div>
                          )}
                        </td>
                        <td>
                          {mailto ? (
                            <a href={mailto} className="sn-btn sn-btn--gold" style={{ padding: "6px 12px", fontSize: 12 }}>
                              Order
                            </a>
                          ) : (
                            <span className="sn-empty" style={{ fontSize: 12 }}>No supplier email</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="sn-btn sn-btn--ghost"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => setEditing(item)}
                          >
                            Edit
                          </button>
                        </td>
                        <td>
                          <button
                            className="sn-btn sn-btn--danger"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => removeConsumable(item.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showAdd && <AddConsumableModal onClose={() => setShowAdd(false)} />}
      {editing && <AddConsumableModal existing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
