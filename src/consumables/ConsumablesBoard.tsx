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

  // Not every low-stock item needs to go in THIS order — staff tick off
  // exactly what they actually want sent today; unticked items just
  // stay low and show up again next time. Defaults to checked (the
  // common case is "order everything that's low"), keyed by item id so
  // it survives items being added/removed from the low-stock set.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  function isChecked(id: string): boolean {
    return checked[id] ?? true;
  }
  function toggleChecked(id: string) {
    setChecked(prev => ({ ...prev, [id]: !isChecked(id) }));
  }

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

  // Staff top up stock levels as they notice things running low over
  // however many days, rather than placing an order the moment one
  // item dips — this groups whatever's currently low by supplier so
  // there's one combined email per supplier to send when it's
  // actually time to order, not one email per item.
  const lowStockBySupplier = new Map<string, { supplierName: string; supplierEmail: string; items: Consumable[] }>();
  const lowStockNoSupplier: Consumable[] = [];
  for (const item of lowStock) {
    if (!item.supplierEmail) {
      lowStockNoSupplier.push(item);
      continue;
    }
    const key = item.supplierEmail;
    const group = lowStockBySupplier.get(key);
    if (group) group.items.push(item);
    else lowStockBySupplier.set(key, { supplierName: item.supplierName ?? item.supplierEmail, supplierEmail: item.supplierEmail, items: [item] });
  }

  function mailtoForSupplier(group: { supplierName: string; supplierEmail: string; items: Consumable[] }): string {
    const subject = `Order Request — ${group.items.length} item${group.items.length === 1 ? "" : "s"}`;
    const body = [
      `Hi,`,
      ``,
      `Please could we order the following:`,
      ``,
      ...group.items.map(
        i => `- ${i.name}${i.unit ? ` (${i.unit})` : ""} — currently ${i.currentStock}${i.unit ? ` ${i.unit}` : ""} in stock`
      ),
      ``,
      `Thanks,`,
      dealer?.name ?? "",
    ].join("\n");
    return `mailto:${group.supplierEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
        {lowStock.length > 0 && (
          <section className="sn-panel sn-panel--full">
            <h2 className="sn-panel__title">Ready to Order</h2>
            <p className="sn-timeclock__subtitle">
              Everything currently low, grouped by supplier — one email covers a supplier's whole list.
            </p>
            <div className="sn-leave-list">
              {Array.from(lowStockBySupplier.values()).map(group => {
                const selectedItems = group.items.filter(i => isChecked(i.id));
                return (
                  <div key={group.supplierEmail} className="sn-recent-lead" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
                      <div className="sn-recent-lead__name">{group.supplierName}</div>
                      {selectedItems.length > 0 ? (
                        <a href={mailtoForSupplier({ ...group, items: selectedItems })} className="sn-btn sn-btn--gold" style={{ flexShrink: 0 }}>
                          Email Order — {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}
                        </a>
                      ) : (
                        <span className="sn-empty">Nothing ticked</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {group.items.map(item => (
                        <label key={item.id} className="sn-checkbox-row" style={{ marginTop: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked(item.id)}
                            onChange={() => toggleChecked(item.id)}
                          />
                          {item.name}
                          {item.unit ? ` (${item.unit})` : ""} — {item.currentStock}
                          {item.unit ? ` ${item.unit}` : ""} left
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {lowStockNoSupplier.length > 0 && (
                <div className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="sn-recent-lead__name">No supplier email set</div>
                    <div className="sn-recent-lead__status" style={{ marginTop: 4 }}>
                      {lowStockNoSupplier.map(i => i.name).join(" · ")}
                    </div>
                  </div>
                  <span className="sn-empty">Add a supplier email to enable ordering</span>
                </div>
              )}
            </div>
          </section>
        )}

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
