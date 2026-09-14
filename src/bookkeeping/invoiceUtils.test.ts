import { describe, it, expect } from "vitest";
import { nextInvoiceNumber } from "./invoiceUtils";
import type { SaleEntry } from "./types";

function sale(invoiceNumber?: string): SaleEntry {
  const entry: SaleEntry = {
    id: crypto.randomUUID(),
    vehicleId: "v1",
    salePrice: 1000,
    invoiceNumber: invoiceNumber ?? "",
    date: "2026-01-01",
    vatScheme: "standard",
    vatRate: 0.2,
    vatIncluded: true,
    vatAmount: 0,
    netAmount: 0,
  };
  if (invoiceNumber === undefined) delete (entry as { invoiceNumber?: string }).invoiceNumber;
  return entry;
}

describe("nextInvoiceNumber", () => {
  it("starts at INV-0001 when there are no sales yet", () => {
    expect(nextInvoiceNumber([])).toBe("INV-0001");
  });

  it("continues from the highest existing numeric suffix, not the count", () => {
    // Only 3 sales, but the highest number is 5 — the next one must be
    // 6, not 4, so it can never collide with a still-existing INV-0005.
    const sales = [sale("INV-0001"), sale("INV-0005"), sale("INV-0003")];
    expect(nextInvoiceNumber(sales)).toBe("INV-0006");
  });

  it("ignores sales with no invoice number at all (legacy pre-backfill records)", () => {
    expect(nextInvoiceNumber([sale(undefined), sale("INV-0002")])).toBe("INV-0003");
  });
});
