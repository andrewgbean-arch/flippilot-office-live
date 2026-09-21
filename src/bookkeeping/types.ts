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

  // Links this cost to a real item in the Consumables stock list —
  // set when the cost was raised against real stock (not a one-off
  // labour/misc line) so the part it used is traceable after the fact,
  // and so the stock count can be deducted automatically when logged.
  // quantityUsed is the exact amount that was deducted, kept alongside
  // consumableId so a later deletion of this cost entry can give that
  // exact quantity back rather than guessing from the cost amount.
  partNumber?: string;
  consumableId?: string;
  quantityUsed?: number;
}


/* -------------------------------------------------------
   ⭐ PURCHASE ENTRY
------------------------------------------------------- */
export interface PurchaseEntry {
  id: string;
  vehicleId: string;
  purchasePrice: number;
  // Where the vehicle actually came from — a trade-in, an auction, a
  // private sale, or a real wholesale supplier. Named separately from
  // CostEntry.supplier (parts/labour costs, where "supplier" is always
  // accurate) since most vehicle acquisitions here aren't from a
  // supplier at all.
  source?: string;
  date: string;

  // The VAT scheme the car was bought under. Optional because purchases saved
  // before this field existed do not carry it (see purchaseVat.ts, which reads it
  // from the car instead). Under "margin" there is no VAT invoice on the
  // purchase, so vatRate is 0, vatIncluded false and vatAmount 0.
  vatScheme?: "margin" | "standard";

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
  // null = not worked out. A Margin Scheme sale needs the car's purchase price to
  // work out its VAT; with no real purchase price on record there is no figure, and
  // none is made up (see saleVat.ts). Never a stand-in 0.
  vatAmount: number | null;
  netAmount: number | null;

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
  // null when the sale price is not above zero (no margin on a sale of nothing).
  margin: number | null;
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
