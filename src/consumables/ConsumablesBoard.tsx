import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConsumables } from "@/context/ConsumablesContext";
import { useDealer } from "@/context/DealerContext";
import AddConsumableModal from "./AddConsumableModal";
import StockMovementModal from "./StockMovementModal";
import type { Consumable } from "./consumableTypes";
import "@/staff/StaffDashboard.css";

export default function ConsumablesBoard() {
  const { consumables, loading, removeConsumable } = useConsumables();
  const { dealer } = useDealer();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Consumable | null>(null);
  const [stockItemId, setStockItemId] = useState<string | null>(null);
  const stockItem = stockItemId ? consumables.find(c => c.id === stockItemId) ?? null : null;

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

  // How many units to actually ask the supplier for — previously the
  // order email just said "please could we order more X", with no
  // quantity at all, leaving the supplier to guess. Defaults to enough
  // to reach the reorder threshold again, staff can adjust per item.
  const [orderQty, setOrderQty] = useState<Record<string, number>>({});
  function qtyFor(item: Consumable): number {
    return orderQty[item.id] ?? Math.max(item.reorderThreshold - item.currentStock, 1);
  }
  function setQty(id: string, value: number) {
    setOrderQty(prev => ({ ...prev, [id]: Math.max(value, 1) }));
  }

  const lowStock = consumables.filter(c => c.currentStock <= c.reorderThreshold);

  function mailtoFor(item: (typeof consumables)[number]): string | null {
    if (!item.supplierEmail) return null;
    const subject = `Order Request: ${item.name}`;
    const body = [
      `Hi,`,
      ``,
      `Please could we order ${qtyFor(item)}${item.unit ? ` ${item.unit}` : ""} of ${item.name}${item.partNumber ? ` (Part No: ${item.partNumber})` : ""}.`,
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
        i => `- ${qtyFor(i)}${i.unit ? ` ${i.unit}` : ""} x ${i.name}${i.partNumber ? ` (Part No: ${i.partNumber})` : ""} — currently ${i.currentStock}${i.unit ? ` ${i.unit}` : ""} in stock`
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
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label className="sn-checkbox-row" style={{ marginTop: 0, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked(item.id)}
                              onChange={() => toggleChecked(item.id)}
                            />
                            {item.name}
                            {item.partNumber ? ` · ${item.partNumber}` : ""} — {item.currentStock}
                            {item.unit ? ` ${item.unit}` : ""} left
                          </label>
                          <span className="sn-empty" style={{ fontSize: 12, flexShrink: 0 }}>Order qty:</span>
                          <input
                            type="number"
                            min={1}
                            value={qtyFor(item)}
                            onChange={e => setQty(item.id, Number(e.target.value) || 1)}
                            className="sn-input"
                            style={{ width: 60, flexShrink: 0 }}
                          />
                          {item.unit && <span className="sn-empty" style={{ fontSize: 12, flexShrink: 0 }}>{item.unit}</span>}
                          <button
                            className="sn-btn sn-btn--ghost"
                            style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                            onClick={() => setStockItemId(item.id)}
                          >
                            Stock arrived
                          </button>
                        </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/import")}>
                Import from CSV
              </button>
              <button className="sn-btn sn-btn--gold" onClick={() => setShowAdd(true)}>
                Add Consumable
              </button>
            </div>
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
                          {(item.partNumber || item.description) && (
                            <div className="sn-empty" style={{ fontSize: 12, fontWeight: 400 }}>
                              {[item.partNumber, item.description].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            className="sn-btn sn-btn--ghost"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => setStockItemId(item.id)}
                          >
                            {item.currentStock}{item.unit ? ` ${item.unit}` : ""}
                          </button>
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
      {stockItem && <StockMovementModal item={stockItem} onClose={() => setStockItemId(null)} />}
    </div>
  );
}
