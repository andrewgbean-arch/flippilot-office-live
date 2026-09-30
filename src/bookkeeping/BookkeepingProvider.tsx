import React, { createContext, useContext, useRef, useState, ReactNode } from "react";
import {
  CostEntry,
  PurchaseEntry,
  SaleEntry,
  TransactionEntry,
  Supplier,
  Category,
  ProfitSummary,
  MonthlyReport,
} from "./types";
import { calculateVat } from "./vatUtils";
import { saleIncome, salePaidAmount, withSaleVat } from "./saleVat";
import { activeSales } from "./saleStatus";
import { isPositiveAmount } from "@/lib/parseMoney";
import { hubTotals, carProfit } from "./profitTotals";
import { purchaseVatSettings } from "./purchaseVat";
import { loadBookkeeping, saveBookkeeping, type BookkeepingDoc, type RemovedEntries } from "./bookkeepingStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";
import { canSeeMoney } from "@/lib/permissions";

// What recording a price for a car with no purchase at all needs besides the price.
export interface NewPurchaseDetails {
  date: string; // YYYY-MM-DD
  vatRate: number; // a fraction, 0.2 = 20% (ignored under the Margin Scheme)
  vatIncluded: boolean;
  source?: string; // where it was bought from (optional)
}

// Correcting a purchase the books already hold: the price, the date it was
// bought, where from, and (Standard VAT only) its VAT.
export interface PurchaseEdit {
  purchasePrice: number;
  date: string; // YYYY-MM-DD
  source?: string;
  vatScheme: "margin" | "standard"; // the car's scheme (old purchases may not store one)
  vatRate: number; // a fraction, 0.2 = 20% (ignored under the Margin Scheme)
  vatIncluded: boolean;
}

interface BookkeepingContextValue {
  costs: CostEntry[];
  purchases: PurchaseEntry[];
  sales: SaleEntry[];
  transactions: TransactionEntry[];
  suppliers: Supplier[];
  categories: Category[];
  loading: boolean;

  addCost: (entry: CostEntry) => void;
  updateCost: (id: string, entry: Partial<CostEntry>) => void;
  deleteCost: (id: string) => void;

  addPurchase: (entry: PurchaseEntry) => void;
  // Adds several purchases in ONE update and ONE save, and says how many were
  // saved (0 when the books were not ready to be written). Calling addPurchase in
  // a loop cannot do this: each call builds its new list from the same
  // render-time copy, so every call overwrites the one before it.
  addPurchases: (entries: PurchaseEntry[]) => number;
  addSale: (entry: SaleEntry) => void;
  // Records what a car really cost on the purchase the books already hold for it,
  // and works out the VAT due on its Margin Scheme sale in the same save. False when
  // nothing was saved (books not ready, no purchase for that car, price not above 0).
  recordPurchasePrice: (vehicleId: string, price: number, scheme: "margin" | "standard", newPurchase?: NewPurchaseDetails) => boolean;
  editPurchase: (vehicleId: string, edit: PurchaseEdit) => boolean;
  // Every sale including voided ones (sales above leaves them out): for invoice
  // numbering and the car's history.
  allSales: SaleEntry[];
  voidSale: (saleId: string, reason: string, byName: string) => boolean;
  updateSale: (id: string, patch: Partial<SaleEntry>) => void;
  addTransaction: (entry: TransactionEntry) => void;

  addSupplier: (supplier: Supplier) => void;
  addCategory: (category: Category) => void;

  getCostsForVehicle: (vehicleId: string) => CostEntry[];
  getTotalCostForVehicle: (vehicleId: string) => number;
  getPurchaseForVehicle: (vehicleId: string) => PurchaseEntry | undefined;
  getSaleForVehicle: (vehicleId: string) => SaleEntry | undefined;

  getProfitForVehicle: (vehicleId: string) => ProfitSummary | null;

  getTotalSpend: () => number;
  getTotalIncome: () => number;
  getTotalProfit: () => number;

  getSupplierStats: (supplierName: string) => Supplier | null;

  getMonthlyReport: (month: string) => MonthlyReport;
}

const BookkeepingContext = createContext<BookkeepingContextValue | undefined>(
  undefined
);

export function useBookkeeping() {
  const ctx = useContext(BookkeepingContext);
  if (!ctx) {
    throw new Error("useBookkeeping must be used within BookkeepingProvider");
  }
  return ctx;
}

interface BookkeepingProviderProps {
  children: ReactNode;
}

export function BookkeepingProvider({ children }: BookkeepingProviderProps) {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [sales, setSales] = useState<SaleEntry[]>([]);
  // The sales every figure reads: voided ones are left out (saleStatus.ts).
  const liveSales = activeSales(sales);
  // Costs deleted on this screen, so a merged ledger handed back by an earlier
  // save can't put them back on screen.
  const deletedCostIds = useRef(new Set<string>());
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { user } = useAuth();

  // Was pure localStorage — never left the browser it was entered in,
  // no backup, invisible from a second device. Now loads from the real
  // per-tenant backend, keyed on the authenticated user's dealershipId
  // rather than firing once at mount — a plain `}, [])` here would have
  // the exact same confirmed bug as InventoryProvider/LeadsContext/
  // StaffContext: a real client-side login (no full page reload) would
  // never re-trigger the fetch, leaving bookkeeping stuck on whatever
  // the pre-login unauthenticated attempt got (empty).
  //
  // Every mutator below saves the WHOLE ledger, so guardSave() refuses
  // until it has loaded successfully for THIS login. The old `loading`
  // check only covered a load still in flight: a load that FAILED fell
  // back to an empty ledger, and the next ordinary "add a cost" then
  // replaced the dealer's purchases, sales, costs and suppliers with
  // that one cost. A failed load is now reported to the shared banner.
  const { loading, guardSave } = useGuardedLoad<BookkeepingDoc>({
    id: "bookkeeping",
    label: "bookkeeping records",
    // The ledger is only sent to the owner, managers and finance; for anyone
    // else there is nothing to load (and so nothing can be saved from here).
    key: canSeeMoney(user) ? user?.dealershipId : undefined,
    load: loadBookkeeping,
    apply: doc => {
      setCosts(doc.costs);
      setPurchases(doc.purchases);
      setSales(doc.sales);
      setTransactions(doc.transactions);
      setSuppliers(doc.suppliers);
      setCategories(doc.categories);
    },
    clear: () => {
      setCosts([]);
      setPurchases([]);
      setSales([]);
      setTransactions([]);
      setSuppliers([]);
      setCategories([]);
    },
  });

  // Saves the full combined document — called by every mutator below
  // with whichever field(s) it just changed; everything else is taken
  // from current state. Each mutator checks guardSave() first, so
  // nothing reaches here (or changes on screen) before a good load.
  //
  // The server MERGES a save into what it holds, so a colleague's entries made
  // since this screen loaded are kept, and a deletion has to be named (`removed`).
  // What it hands back is added to this screen: entries it didn't have yet. Nothing
  // on screen is overwritten or removed by it, and a cost deleted here is never
  // brought back.
  function persist(next: Partial<BookkeepingDoc>, removed?: RemovedEntries) {
    void saveBookkeeping(
      {
        costs: next.costs ?? costs,
        purchases: next.purchases ?? purchases,
        sales: next.sales ?? sales,
        transactions: next.transactions ?? transactions,
        suppliers: next.suppliers ?? suppliers,
        categories: next.categories ?? categories,
      },
      removed
    ).then((merged) => {
      if (merged) addOthersEntries(merged);
    });
  }

  function addOthersEntries(merged: BookkeepingDoc) {
    const addMissing = <T extends { id: string }>(prev: T[], server: T[], skip?: ReadonlySet<string>): T[] => {
      const have = new Set(prev.map((e) => e.id));
      const extra = server.filter((e) => e && typeof e.id === "string" && !have.has(e.id) && !skip?.has(e.id));
      return extra.length > 0 ? [...prev, ...extra] : prev;
    };
    setCosts((prev) => addMissing(prev, merged.costs, deletedCostIds.current));
    setPurchases((prev) => addMissing(prev, merged.purchases));
    setSales((prev) => addMissing(prev, merged.sales));
    setTransactions((prev) => addMissing(prev, merged.transactions));
    setSuppliers((prev) => addMissing(prev, merged.suppliers));
    setCategories((prev) => addMissing(prev, merged.categories));
  }

  // COSTS
  const addCost = (entry: CostEntry) => {
    if (!guardSave()) return;
    const vat = calculateVat(entry.amount, {
      vatRate: entry.vatRate,
      vatIncluded: entry.vatIncluded,
      vatReclaimable: entry.vatReclaimable,
    });

    const enriched: CostEntry = {
      ...entry,
      vatAmount: vat.vat,
      netAmount: vat.net,
    };

    const updated = [...costs, enriched];
    setCosts(updated);
    persist({ costs: updated });
  };

  const updateCost = (id: string, patch: Partial<CostEntry>) => {
    if (!guardSave()) return;
    const updated = costs.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setCosts(updated);
    persist({ costs: updated });
  };

  const deleteCost = (id: string) => {
    if (!guardSave()) return;
    const updated = costs.filter((c) => c.id !== id);
    deletedCostIds.current.add(id);
    setCosts(updated);
    persist({ costs: updated }, { costs: [id] });
  };

  // PURCHASES
  //
  // The stored form of a purchase. One that says it was bought under the Margin
  // Scheme has no VAT invoice, so it is stored with no VAT whatever rate the
  // caller left on it.
  const enrichPurchase = (entry: PurchaseEntry): PurchaseEntry => {
    const { vatRate, vatIncluded } = purchaseVatSettings(
      entry.vatScheme === "margin" ? "margin" : "standard",
      entry.vatRate,
      entry.vatIncluded
    );
    const vat = calculateVat(entry.purchasePrice, {
      vatRate,
      vatIncluded,
      vatReclaimable: true,
    });

    return {
      ...entry,
      vatRate,
      vatIncluded,
      vatAmount: vat.vat,
      netAmount: vat.net,
    };
  };

  const addPurchase = (entry: PurchaseEntry) => {
    if (!guardSave()) return;
    const updated = [...purchases, enrichPurchase(entry)];
    setPurchases(updated);
    persist({ purchases: updated });
  };

  const addPurchases = (entries: PurchaseEntry[]): number => {
    if (entries.length === 0) return 0;
    if (!guardSave()) return 0;
    const updated = [...purchases, ...entries.map(enrichPurchase)];
    setPurchases(updated);
    persist({ purchases: updated });
    return entries.length;
  };

  // SALES
  //
  // A sale's VAT comes from saleVat.ts, the same function the Record Sale form
  // previews with. A Margin Scheme sale needs the car's purchase price (completely
  // different maths from calculateVat(): see vatUtils.ts); with no real purchase
  // price on record its VAT is stored as null ("not worked out"), never as a figure
  // made from a £0 cost and never by quietly switching the sale to standard VAT.
  const addSale = (entry: SaleEntry) => {
    if (!guardSave()) return;
    const enriched = withSaleVat(entry, getPurchaseForVehicle(entry.vehicleId));

    const updated = [...sales, enriched];
    setSales(updated);
    persist({ sales: updated });
  };

  // Edits an existing sale (e.g. adding the buyer's email after the
  // fact, so an invoice can actually be emailed) and recomputes VAT
  // the same way addSale does — if the price or scheme changes, the
  // stored VAT/net figures must never go stale.
  const updateSale = (id: string, patch: Partial<SaleEntry>) => {
    if (!guardSave()) return;
    const existing = sales.find((s) => s.id === id);
    if (!existing || existing.voided) return; // a voided sale is frozen

    const merged: SaleEntry = { ...existing, ...patch };
    const enriched = withSaleVat(merged, getPurchaseForVehicle(merged.vehicleId));

    const updated = sales.map((s) => (s.id === id ? enriched : s));
    setSales(updated);
    persist({ sales: updated });
  };

  // Records what a car really cost, on the purchase the books already hold for it
  // (one saved with no usable price: a blank that was once saved as 0, or a price
  // that could not be read). Purchases could not be edited at all, so a car whose
  // purchase price was missing stayed "not recorded" for good.
  //
  // The VAT due on this car's Margin Scheme sale was waiting for exactly this price,
  // so it is worked out now, in the same save. Standard-scheme sales are left alone:
  // their VAT does not depend on what the car cost, and an invoice already issued
  // must not change under the customer.
  //
  // false when nothing was saved: the books are not ready to be written, the car has
  // no purchase on record, or the price is not a real amount above zero.
  // Gives a car its purchase price. A purchase the books hold with no usable
  // price is fixed in place. A car with NO purchase at all (a sold car imported
  // from a spreadsheet, say) gets one attached to it, but only when the caller
  // passes `newPurchase` (the date and, for Standard VAT, the rate), so nothing
  // is invented. Never makes a second purchase for a car that already has one.
  const recordPurchasePrice = (
    vehicleId: string,
    price: number,
    scheme: "margin" | "standard",
    newPurchase?: NewPurchaseDetails
  ): boolean => {
    if (!isPositiveAmount(price)) return false;
    if (!guardSave()) return false;
    const current = getPurchaseForVehicle(vehicleId);
    if (!current && !newPurchase) return false;
    if (!current && newPurchase && !/^\d{4}-\d{2}-\d{2}$/.test(newPurchase.date)) return false;

    const fixed = current
      ? enrichPurchase({ ...current, purchasePrice: price, vatScheme: scheme })
      : enrichPurchase({
          id: crypto.randomUUID(),
          vehicleId,
          purchasePrice: price,
          date: newPurchase!.date,
          vatScheme: scheme,
          vatRate: newPurchase!.vatRate,
          vatIncluded: newPurchase!.vatIncluded,
          ...(newPurchase!.source?.trim() ? { source: newPurchase!.source.trim() } : {}),
          vatAmount: 0,
          netAmount: price,
        });
    const updatedPurchases = current ? purchases.map((p) => (p === current ? fixed : p)) : [...purchases, fixed];
    const updatedSales = sales.map((s) => (s.vehicleId === vehicleId && s.vatScheme === "margin" && !s.voided ? withSaleVat(s, fixed) : s));

    setPurchases(updatedPurchases);
    setSales(updatedSales);
    persist({ purchases: updatedPurchases, sales: updatedSales });
    return true;
  };

  // Corrects a purchase the books already hold. There was no way to: a price typed
  // wrong (45000 for 4500) stayed wrong, and so did the car's profit and the VAT due
  // on its Margin Scheme sale. The car's VAT scheme is used; the VAT is worked out
  // again from the new figures, and a Margin Scheme sale's VAT with it, in ONE save.
  // A Standard VAT sale is left alone: its invoice doesn't depend on the purchase.
  const editPurchase = (vehicleId: string, edit: PurchaseEdit): boolean => {
    if (!isPositiveAmount(edit.purchasePrice)) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.date)) return false;
    if (!guardSave()) return false;
    const current = getPurchaseForVehicle(vehicleId);
    if (!current) return false;

    const { source: _oldSource, ...rest } = current;
    const fixed = enrichPurchase({
      ...rest,
      purchasePrice: edit.purchasePrice,
      date: edit.date,
      vatScheme: edit.vatScheme,
      vatRate: edit.vatRate,
      vatIncluded: edit.vatIncluded,
      ...(edit.source?.trim() ? { source: edit.source.trim() } : {}),
    });
    const updatedPurchases = purchases.map((p) => (p === current ? fixed : p));
    const updatedSales = sales.map((s) => (s.vehicleId === vehicleId && s.vatScheme === "margin" && !s.voided ? withSaleVat(s, fixed) : s));

    setPurchases(updatedPurchases);
    setSales(updatedSales);
    persist({ purchases: updatedPurchases, sales: updatedSales });
    return true;
  };

  // Voids a sale recorded by mistake: it keeps its figures and invoice number, gains
  // `voided` (when, why, who), and every figure leaves it out from then on. A reason
  // is required. The server refuses to let a later save undo it (saleVoids.ts).
  const voidSale = (saleId: string, reason: string, byName: string): boolean => {
    const why = reason.trim();
    if (!why) return false;
    if (!guardSave()) return false;
    const target = sales.find((s) => s.id === saleId);
    if (!target || target.voided) return false;
    const updated = sales.map((s) => (s.id === saleId ? { ...s, voided: { at: new Date().toISOString(), reason: why, byName } } : s));
    setSales(updated);
    persist({ sales: updated });
    return true;
  };

  // TRANSACTIONS
  const addTransaction = (entry: TransactionEntry) => {
    if (!guardSave()) return;
    const updated = [...transactions, entry];
    setTransactions(updated);
    persist({ transactions: updated });
  };

  // SUPPLIERS
  const addSupplier = (supplier: Supplier) => {
    if (!guardSave()) return;
    const updated = [...suppliers, supplier];
    setSuppliers(updated);
    persist({ suppliers: updated });
  };

  // CATEGORIES
  const addCategory = (category: Category) => {
    if (!guardSave()) return;
    const updated = [...categories, category];
    setCategories(updated);
    persist({ categories: updated });
  };

  // LEDGER
  const getCostsForVehicle = (vehicleId: string) =>
    costs.filter((c) => c.vehicleId === vehicleId);

  const getTotalCostForVehicle = (vehicleId: string) =>
    getCostsForVehicle(vehicleId).reduce((sum, c) => sum + c.amount, 0);

  const getPurchaseForVehicle = (vehicleId: string) =>
    purchases.find((p) => p.vehicleId === vehicleId);

  const getSaleForVehicle = (vehicleId: string) =>
    liveSales.find((s) => s.vehicleId === vehicleId);

  // PROFIT ENGINE
  const getProfitForVehicle = (vehicleId: string): ProfitSummary | null => {
    const purchase = getPurchaseForVehicle(vehicleId);
    const sale = getSaleForVehicle(vehicleId);
    const totalCosts = getTotalCostForVehicle(vehicleId);

    if (!purchase || !sale) return null;

    // One definition of a car's profit, shared with the hub (profitTotals.ts).
    // A purchase price, or a sale price, that is not a real amount above zero
    // counts as "not recorded": the profit is unknown (null), never worked out
    // against a £0 cost or as a loss on a sale of £0. So a sale of nothing can
    // never print "-Infinity%" or "NaN%" either.
    // Worked from what the customer paid (saleVat.ts), so a VAT-on-top sale isn't
    // shown the VAT's worth less profit than the same sale with the VAT included.
    const paid = salePaidAmount(sale);
    const worked = carProfit(purchase.purchasePrice, paid, totalCosts);
    if (!worked) return null;

    return {
      vehicleId,
      purchasePrice: purchase.purchasePrice,
      totalCosts,
      salePrice: paid ?? sale.salePrice,
      profit: worked.profit,
      margin: worked.margin,
    };
  };

  // SUMMARY
  const getTotalSpend = () =>
    costs.reduce((sum, c) => sum + c.amount, 0) +
    purchases.reduce((sum, p) => sum + p.purchasePrice, 0);

  const getTotalIncome = () =>
    liveSales.reduce((sum, s) => sum + saleIncome(s), 0);

  // Profit on SOLD cars, worked out car by car like getProfitForVehicle. This
  // used to be income minus ALL spend, which counted every unsold car as a
  // loss (see profitTotals.ts).
  const getTotalProfit = () => hubTotals(purchases, sales, costs).profit;

  // SUPPLIER STATS
  const getSupplierStats = (supplierName: string): Supplier | null => {
    const supplierCosts = costs.filter((c) => c.supplier === supplierName);
    if (supplierCosts.length === 0) return null;

    const totalSpend = supplierCosts.reduce((sum, c) => sum + c.amount, 0);

    return {
      id: supplierName,
      name: supplierName,
      totalSpend,
      totalTransactions: supplierCosts.length,
    };
  };

  // MONTHLY REPORTS
  const getMonthlyReport = (month: string): MonthlyReport => {
    const monthCosts = costs.filter((c) => c.date.startsWith(month));
    const monthPurchases = purchases.filter((p) => p.date.startsWith(month));
    const monthSales = liveSales.filter((s) => s.date.startsWith(month));

    const totalSpend =
      monthCosts.reduce((sum, c) => sum + c.amount, 0) +
      monthPurchases.reduce((sum, p) => sum + p.purchasePrice, 0);

    const totalIncome = monthSales.reduce((sum, s) => sum + saleIncome(s), 0);

    return {
      month,
      totalSpend,
      totalIncome,
      netProfit: totalIncome - totalSpend,
    };
  };

  const value: BookkeepingContextValue = {
    costs,
    purchases,
    sales: liveSales,
    allSales: sales,
    transactions,
    suppliers,
    loading,
    categories,

    addCost,
    updateCost,
    deleteCost,

    addPurchase,
    addPurchases,
    addSale,
    recordPurchasePrice,
    editPurchase,
    voidSale,
    updateSale,
    addTransaction,

    addSupplier,
    addCategory,

    getCostsForVehicle,
    getTotalCostForVehicle,
    getPurchaseForVehicle,
    getSaleForVehicle,

    getProfitForVehicle,

    getTotalSpend,
    getTotalIncome,
    getTotalProfit,

    getSupplierStats,

    getMonthlyReport,
  };

  return (
    <BookkeepingContext.Provider value={value}>
      {children}
    </BookkeepingContext.Provider>
  );
}