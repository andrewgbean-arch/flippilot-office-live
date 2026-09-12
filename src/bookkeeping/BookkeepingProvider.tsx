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

interface BookkeepingContextValue {
  costs: CostEntry[];
  purchases: PurchaseEntry[];
  sales: SaleEntry[];
  transactions: TransactionEntry[];
  suppliers: Supplier[];
  categories: Category[];

  addCost: (entry: CostEntry) => void;
  updateCost: (id: string, entry: Partial<CostEntry>) => void;
  deleteCost: (id: string) => void;

  addPurchase: (entry: PurchaseEntry) => void;
  addSale: (entry: SaleEntry) => void;
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

  // COSTS
  const addCost = (entry: CostEntry) => {
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

    setCosts((prev) => [...prev, enriched]);
  };

  const updateCost = (id: string, patch: Partial<CostEntry>) => {
    setCosts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const deleteCost = (id: string) => {
    setCosts((prev) => prev.filter((c) => c.id !== id));
  };

  // PURCHASES
  const addPurchase = (entry: PurchaseEntry) => {
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

    setPurchases((prev) => [...prev, enriched]);
  };

  // SALES
  const addSale = (entry: SaleEntry) => {
    const vat = calculateVat(entry.salePrice, {
      vatRate: entry.vatRate,
      vatIncluded: entry.vatIncluded,
      vatReclaimable: false,
    });

    const enriched: SaleEntry = {
      ...entry,
      vatAmount: vat.vat,
      netAmount: vat.net,
    };

    setSales((prev) => [...prev, enriched]);
  };

  // TRANSACTIONS
  const addTransaction = (entry: TransactionEntry) => {
    setTransactions((prev) => [...prev, entry]);
  };

  // SUPPLIERS
  const addSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => [...prev, supplier]);
  };

  // CATEGORIES
  const addCategory = (category: Category) => {
    setCategories((prev) => [...prev, category]);
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

    const profit = sale.salePrice - purchase.purchasePrice - totalCosts;
    const margin = (profit / sale.salePrice) * 100;

    return {
      vehicleId,
      purchasePrice: purchase.purchasePrice,
      totalCosts,
      salePrice: sale.salePrice,
      profit,
      margin,
    };
  };

  // SUMMARY
  const getTotalSpend = () =>
    costs.reduce((sum, c) => sum + c.amount, 0) +
    purchases.reduce((sum, p) => sum + p.purchasePrice, 0);

  const getTotalIncome = () =>
    sales.reduce((sum, s) => sum + s.salePrice, 0);

  const getTotalProfit = () =>
    getTotalIncome() - getTotalSpend();

  // SUPPLIER STATS
  const getSupplierStats = (supplierName: string): Supplier | null => {
    const supplierCosts = costs.filter((c) => c.supplier === supplierName);
    if (supplierCosts.length === 0) return null;

    const totalSpend = supplierCosts.reduce((sum, c) => sum + c.amount, 0);

    return {
      id: supplierName,
      name: supplierName,
      reliabilityScore: 85,
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
    categories,

    addCost,
    updateCost,
    deleteCost,

    addPurchase,
    addSale,
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
