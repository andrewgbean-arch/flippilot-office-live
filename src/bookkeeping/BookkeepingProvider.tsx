import React, { createContext, useContext, useState, ReactNode } from "react";
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
import { withSaleVat } from "./saleVat";
import { isPositiveAmount } from "@/lib/parseMoney";
import { hubTotals, carProfit } from "./profitTotals";
import { purchaseVatSettings } from "./purchaseVat";
import { loadBookkeeping, saveBookkeeping, type BookkeepingDoc } from "./bookkeepingStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

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
  recordPurchasePrice: (vehicleId: string, price: number, scheme: "margin" | "standard") => boolean;
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
    key: user?.dealershipId,
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
  function persist(next: Partial<BookkeepingDoc>) {
    saveBookkeeping({
      costs: next.costs ?? costs,
      purchases: next.purchases ?? purchases,
      sales: next.sales ?? sales,
      transactions: next.transactions ?? transactions,
      suppliers: next.suppliers ?? suppliers,
      categories: next.categories ?? categories,
    });
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
    setCosts(updated);
    persist({ costs: updated });
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
    if (!existing) return;

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
  const recordPurchasePrice = (vehicleId: string, price: number, scheme: "margin" | "standard"): boolean => {
    if (!isPositiveAmount(price)) return false;
    if (!guardSave()) return false;
    const current = getPurchaseForVehicle(vehicleId);
    if (!current) return false;

    const fixed = enrichPurchase({ ...current, purchasePrice: price, vatScheme: scheme });
    const updatedPurchases = purchases.map((p) => (p === current ? fixed : p));
    const updatedSales = sales.map((s) => (s.vehicleId === vehicleId && s.vatScheme === "margin" ? withSaleVat(s, fixed) : s));

    setPurchases(updatedPurchases);
    setSales(updatedSales);
    persist({ purchases: updatedPurchases, sales: updatedSales });
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
    sales.find((s) => s.vehicleId === vehicleId);

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
    const worked = carProfit(purchase.purchasePrice, sale.salePrice, totalCosts);
    if (!worked) return null;

    return {
      vehicleId,
      purchasePrice: purchase.purchasePrice,
      totalCosts,
      salePrice: sale.salePrice,
      profit: worked.profit,
      margin: worked.margin,
    };
  };

  // SUMMARY
  const getTotalSpend = () =>
    costs.reduce((sum, c) => sum + c.amount, 0) +
    purchases.reduce((sum, p) => sum + p.purchasePrice, 0);

  const getTotalIncome = () =>
    sales.reduce((sum, s) => sum + s.salePrice, 0);

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
    const monthSales = sales.filter((s) => s.date.startsWith(month));

    const totalSpend =
      monthCosts.reduce((sum, c) => sum + c.amount, 0) +
      monthPurchases.reduce((sum, p) => sum + p.purchasePrice, 0);

    const totalIncome = monthSales.reduce((sum, s) => sum + s.salePrice, 0);

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
    sales,
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