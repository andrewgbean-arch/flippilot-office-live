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
import { calculateVat, calculateMarginVat } from "./vatUtils";
import { hubTotals, carProfit } from "./profitTotals";
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
  addSale: (entry: SaleEntry) => void;
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
  const addPurchase = (entry: PurchaseEntry) => {
    if (!guardSave()) return;
    const vat = calculateVat(entry.purchasePrice, {
      vatRate: entry.vatRate,
      vatIncluded: entry.vatIncluded,
      vatReclaimable: true,
    });

    const enriched: PurchaseEntry = {
      ...entry,
      vatAmount: vat.vat,
      netAmount: vat.net,
    };

    const updated = [...purchases, enriched];
    setPurchases(updated);
    persist({ purchases: updated });
  };

  // SALES
  //
  // Margin Scheme sales need the vehicle's purchase price to compute
  // the margin VAT is actually due on — completely different maths
  // from calculateVat() (see vatUtils.ts). Falls back to standard VAT
  // if no purchase record exists yet (margin can't be computed without
  // a purchase price), so a sale never silently loses its VAT figure.
  const addSale = (entry: SaleEntry) => {
    if (!guardSave()) return;
    let enriched: SaleEntry;

    const purchase = getPurchaseForVehicle(entry.vehicleId);

    if (entry.vatScheme === "margin" && purchase) {
      const margin = calculateMarginVat(entry.salePrice, purchase.purchasePrice, entry.vatRate);
      enriched = {
        ...entry,
        vatAmount: margin.vat,
        netAmount: entry.salePrice - margin.vat,
        marginPurchasePrice: purchase.purchasePrice,
      };
    } else {
      const vat = calculateVat(entry.salePrice, {
        vatRate: entry.vatRate,
        vatIncluded: entry.vatIncluded,
        vatReclaimable: false,
      });
      enriched = {
        ...entry,
        vatScheme: "standard",
        vatAmount: vat.vat,
        netAmount: vat.net,
      };
    }

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
    const purchase = getPurchaseForVehicle(merged.vehicleId);

    let enriched: SaleEntry;
    if (merged.vatScheme === "margin" && purchase) {
      const margin = calculateMarginVat(merged.salePrice, purchase.purchasePrice, merged.vatRate);
      enriched = {
        ...merged,
        vatAmount: margin.vat,
        netAmount: merged.salePrice - margin.vat,
        marginPurchasePrice: purchase.purchasePrice,
      };
    } else {
      const vat = calculateVat(merged.salePrice, {
        vatRate: merged.vatRate,
        vatIncluded: merged.vatIncluded,
        vatReclaimable: false,
      });
      enriched = { ...merged, vatScheme: "standard", vatAmount: vat.vat, netAmount: vat.net };
    }

    const updated = sales.map((s) => (s.id === id ? enriched : s));
    setSales(updated);
    persist({ sales: updated });
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
    // A purchase whose price is not a real amount above zero counts as "purchase
    // not recorded": the profit is unknown (null), never worked out against a
    // £0 cost. The margin is null when the sale price is not above zero, so a
    // sale of nothing can never print "-Infinity%" or "NaN%".
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
    addSale,
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