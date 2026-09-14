/* -------------------------------------------------------
   ⭐ COST TYPES
------------------------------------------------------- */
export type CostType =
  | "purchase"
  | "transport"
  | "auction"
  | "parts"
  | "labour"
  | "mot"
  | "tyres"
  | "detailing"
  | "advertising"
  | "misc"
  | "recon"; // ⭐ Added for ReconWorkflow


/* -------------------------------------------------------
   ⭐ COST ENTRY (supports recon + VAT)
------------------------------------------------------- */
export interface CostEntry {
  id: string;
  vehicleId: string;

  // ⭐ Type of cost (purchase, parts, labour, recon, etc.)
  type: CostType;

  // ⭐ Recon item name (tyres, brakes, MOT prep, etc.)
  label?: string;

  // ⭐ Category grouping (Recon, Parts, Labour, etc.)
  category?: string;

  amount: number;

  // ⭐ VAT fields
  vatRate: number;
  vatIncluded: boolean;
  vatReclaimable: boolean;
  vatAmount: number;
  netAmount: number;

  supplier?: string;
  date: string;
  notes?: string;
}


/* -------------------------------------------------------
   ⭐ PURCHASE ENTRY
------------------------------------------------------- */
export interface PurchaseEntry {
  id: string;
  vehicleId: string;
  purchasePrice: number;
  supplier?: string;
  date: string;

  vatRate: number;
  vatIncluded: boolean;
  vatAmount: number;
  netAmount: number;
}


/* -------------------------------------------------------
   ⭐ SALE ENTRY
------------------------------------------------------- */
export interface SaleEntry {
  id: string;
  vehicleId: string;
  salePrice: number;
  buyer?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  // Assigned once at creation (see invoiceUtils.ts's nextInvoiceNumber)
  // and never recalculated — deleting or editing other sales must
  // never renumber an invoice that's already been issued to a
  // customer.
  invoiceNumber: string;
  date: string;

  // "margin" (the UK VAT Margin Scheme — VAT on profit margin, not sale
  // price) mirrors the vehicle's own Vehicle.vatScheme at the time of
  // sale; "standard" charges VAT on the sale price like any other good.
  vatScheme: "standard" | "margin";

  vatRate: number;
  vatIncluded: boolean;
  vatAmount: number;
  netAmount: number;

  // Only meaningful when vatScheme is "margin" — the purchase price
  // used to compute the margin, kept alongside the result so the
  // ledger can show its working rather than just a final VAT figure.
  marginPurchasePrice?: number;
}


/* -------------------------------------------------------
   ⭐ GENERAL TRANSACTION
------------------------------------------------------- */
export interface TransactionEntry {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  notes?: string;
}


/* -------------------------------------------------------
   ⭐ SUPPLIER
------------------------------------------------------- */
export interface Supplier {
  id: string;
  name: string;
  reliabilityScore: number; // 0–100
  totalSpend: number;
  totalTransactions: number;
}


/* -------------------------------------------------------
   ⭐ CATEGORY
------------------------------------------------------- */
export interface Category {
  id: string;
  name: string;
  description?: string;
}


/* -------------------------------------------------------
   ⭐ PROFIT SUMMARY
------------------------------------------------------- */
export interface ProfitSummary {
  vehicleId: string;
  purchasePrice: number;
  totalCosts: number;
  salePrice: number;
  profit: number;
  margin: number;
}


/* -------------------------------------------------------
   ⭐ MONTHLY REPORT
------------------------------------------------------- */
export interface MonthlyReport {
  month: string; // "2026-09"
  totalSpend: number;
  totalIncome: number;
  netProfit: number;
}
