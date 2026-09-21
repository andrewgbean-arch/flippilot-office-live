import { useMemo } from "react";
import type { PurchaseEntry } from "./types";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { normalisePurchases } from "./purchaseVat";

// The purchases as they should be SHOWN and EXPORTED: margin-scheme purchases
// saved with phantom VAT before the fix read as the no-VAT purchases they are.
// Derived in memory from what is stored (never written back), so a screen that
// only reads gets the right figures without the stored ledger being rewritten.
export function useLedgerPurchases(): PurchaseEntry[] {
  const { purchases } = useBookkeeping();
  const { vehicles } = useInventory();
  return useMemo(() => normalisePurchases(purchases, vehicles), [purchases, vehicles]);
}
