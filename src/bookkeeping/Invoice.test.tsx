import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const state = vi.hoisted(() => ({
  sales: [] as any[],
  dealer: { name: "Test Motors", vatNumber: "GB123456789", address: "1 High St", phone: "01234 567890" } as any,
}));

vi.mock("@/bookkeeping/BookkeepingProvider", () => ({ useBookkeeping: () => ({ sales: state.sales }) }));
vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({
    vehicles: [{ id: "v1", make: "Ford", model: "Focus", reg: "AB12CDE", year: 2018, mileage: 42000 }],
  }),
}));
vi.mock("@/context/DealerContext", () => ({ useDealer: () => ({ dealer: state.dealer }) }));

import Invoice from "./Invoice";
import { calculateVat, calculateMarginVat } from "./vatUtils";
import type { SaleEntry } from "./types";

// A sale exactly as addSale() in BookkeepingProvider stores it (same functions,
// same arithmetic), so these tests print what a real saved sale would print.
function storedSale(o: {
  price: number;
  rate?: number;
  included?: boolean;
  scheme?: "standard" | "margin";
  purchasePrice?: number;
  email?: string | null;
}): SaleEntry {
  const rate = o.rate ?? 0.2;
  const included = o.included ?? true;
  const base = {
    id: "s1",
    vehicleId: "v1",
    salePrice: o.price,
    buyer: "Sam Buyer",
    ...(o.email === null ? {} : { buyerEmail: o.email ?? "sam@example.com" }),
    invoiceNumber: "INV-0007",
    date: "2026-03-14",
    vatRate: rate,
    vatIncluded: included,
  };
  if (o.scheme === "margin") {
    const m = calculateMarginVat(o.price, o.purchasePrice ?? 5000, rate);
    return { ...base, vatScheme: "margin", vatAmount: m.vat, netAmount: o.price - m.vat, marginPurchasePrice: o.purchasePrice ?? 5000 };
  }
  const v = calculateVat(o.price, { vatRate: rate, vatIncluded: included, vatReclaimable: false });
  return { ...base, vatScheme: "standard", vatAmount: v.vat, netAmount: v.net };
}

function render(sale: SaleEntry | null): string {
  state.sales = sale ? [sale] : [];
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/bookkeeping/invoice/v1"]}>
      <Routes>
        <Route path="/bookkeeping/invoice/:vehicleId" element={<Invoice />} />
      </Routes>
    </MemoryRouter>
  );
}

// What a person reads on the page: tags removed, entities decoded, spaces collapsed.
const visible = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// The email the "Email to Customer" button opens, decoded.
function emailBody(html: string): string | null {
  const m = /href="(mailto:[^"]+)"/.exec(html);
  if (!m) return null;
  return new URL(m[1]!.replace(/&amp;/g, "&")).searchParams.get("body");
}

describe("the invoice page: Total Due is what the customer pays", () => {
  it("VAT added on top: 1,000 net + 20% VAT prints Total Due 1,200.00 (it used to print 1,000.00)", () => {
    const html = render(storedSale({ price: 1000, included: false }));
    const text = visible(html);
    expect(text).toContain("Net £1,000.00 VAT (20%) £200.00");
    expect(text).toContain("Total Due £1,200.00");
    expect(text).not.toContain("Total Due £1,000.00");
    // the vehicle line carries the net price as typed
    expect(text).toContain("Ford Focus — AB12CDE, 2018, 42,000 miles £1,000.00");
    expect(text).toContain("VAT Invoice");
  });

  it("VAT included: 1,200 with 20% inside prints Net 1,000.00, VAT 200.00, Total Due 1,200.00", () => {
    const text = visible(render(storedSale({ price: 1200, included: true })));
    expect(text).toContain("Net £1,000.00 VAT (20%) £200.00");
    expect(text).toContain("Total Due £1,200.00");
    expect(text).toContain("Ford Focus — AB12CDE, 2018, 42,000 miles £1,200.00");
  });

  it("penny rounding: 999.99 with VAT included prints lines that add up to the total", () => {
    const text = visible(render(storedSale({ price: 999.99, included: true })));
    expect(text).toContain("Net £833.32 VAT (20%) £166.67");
    expect(text).toContain("Total Due £999.99");
  });

  it("penny rounding: 333.33 + 20% on top prints VAT 66.67 and Total Due 400.00", () => {
    const text = visible(render(storedSale({ price: 333.33, included: false })));
    expect(text).toContain("Net £333.33 VAT (20%) £66.67");
    expect(text).toContain("Total Due £400.00");
  });

  it("a 5% sale is labelled 5%, and 17.5% is not rounded to 18%", () => {
    expect(visible(render(storedSale({ price: 100, rate: 0.05, included: false })))).toContain("VAT (5%) £5.00 Total Due £105.00");
    expect(visible(render(storedSale({ price: 200, rate: 0.175, included: false })))).toContain("VAT (17.5%) £35.00 Total Due £235.00");
  });

  it("margin scheme: prints the price as Total Due and NO VAT amount, line or net, anywhere", () => {
    const sale = storedSale({ price: 6000, scheme: "margin", purchasePrice: 5000 });
    // the dealer's own margin VAT is stored (1,000 / 6 = 166.67) but must never reach the customer
    expect(sale.vatAmount).toBeCloseTo(166.67, 2);
    const html = render(sale);
    const text = visible(html);
    expect(text).toContain("Total Due £6,000.00");
    expect(text).toContain("This vehicle is sold under the VAT Margin Scheme (HMRC Notice 718).");
    expect(text).toContain("No VAT is separately identified on this invoice.");
    expect(text).not.toContain("VAT (");
    expect(text).not.toContain("Net");
    expect(html).not.toContain("166.67");
    expect(html).not.toContain("833.33");
    // not a "VAT Invoice" even though the dealer has a VAT number
    expect(text).toMatch(/\bInvoice No: INV-0007/);
    expect(text).not.toContain("VAT Invoice");
  });

  it("margin scheme with the on-top flag set is still billed at the price, not price + 20%", () => {
    const text = visible(render(storedSale({ price: 6000, included: false, scheme: "margin" })));
    expect(text).toContain("Total Due £6,000.00");
    expect(text).not.toContain("7,200");
  });
});

describe("the emailed invoice says the same thing as the page", () => {
  it("VAT added on top: the email total is 1,200.00, with the same Net and VAT lines", () => {
    const body = emailBody(render(storedSale({ price: 1000, included: false })))!;
    expect(body).toContain("Invoice Number: INV-0007");
    expect(body).toContain("Net: £1,000.00");
    expect(body).toContain("VAT (20%): £200.00");
    expect(body).toContain("Total: £1,200.00");
    expect(body).not.toContain("Total: £1,000.00");
  });

  it("VAT included: the email total is the price", () => {
    const body = emailBody(render(storedSale({ price: 1200, included: true })))!;
    expect(body).toContain("Net: £1,000.00");
    expect(body).toContain("VAT (20%): £200.00");
    expect(body).toContain("Total: £1,200.00");
  });

  it("margin scheme: the email shows the total and no VAT or net line", () => {
    const body = emailBody(render(storedSale({ price: 6000, scheme: "margin" })))!;
    expect(body).toContain("Total: £6,000.00");
    expect(body).not.toContain("VAT");
    expect(body).not.toContain("Net:");
    expect(body).not.toContain("166.67");
  });

  it("the email uses the sale's own VAT rate, not a fixed 20%", () => {
    const cases = [
      { rate: 0.05, price: 100, label: "5", vat: "£5.00", total: "£105.00" },
      { rate: 0.175, price: 200, label: "17.5", vat: "£35.00", total: "£235.00" },
      { rate: 0, price: 500, label: "0", vat: "£0.00", total: "£500.00" },
    ];
    for (const c of cases) {
      const html = render(storedSale({ price: c.price, rate: c.rate, included: false }));
      const body = emailBody(html)!;
      expect(body, c.label).toContain(`VAT (${c.label}%): ${c.vat}`);
      expect(body, c.label).toContain(`Total: ${c.total}`);
    }
  });

  it("the email total always equals the page's Total Due", () => {
    for (const sale of [
      storedSale({ price: 1000, included: false }),
      storedSale({ price: 999.99, included: true }),
      storedSale({ price: 333.33, included: false }),
      storedSale({ price: 6000, scheme: "margin" }),
    ]) {
      const html = render(sale);
      const pageTotal = /Total Due (£[\d,]+\.\d\d)/.exec(visible(html))![1];
      expect(emailBody(html)).toContain(`Total: ${pageTotal}`);
    }
  });

  it("greets the buyer by name and offers no email link when the sale has no buyer email", () => {
    const withEmail = render(storedSale({ price: 1000, included: false }));
    expect(emailBody(withEmail)).toContain("Dear Sam Buyer,");
    const without = render(storedSale({ price: 1000, included: false, email: null }));
    expect(without).not.toContain("mailto:");
    expect(visible(without)).toContain("Add the buyer's email on the sale to enable emailing.");
  });
});

describe("a sale with no usable price is never billed as £0.00", () => {
  it.each([0, NaN, -50])("price %s shows a notice, no Total Due, no email link", (price) => {
    const html = render({ ...storedSale({ price: 1000 }), salePrice: price });
    const text = visible(html);
    expect(text).toContain("No Price Recorded");
    expect(text).toContain("has no usable sale price");
    expect(text).not.toContain("Total Due");
    expect(text).not.toContain("£0.00");
    expect(text).not.toContain("NaN");
    expect(html).not.toContain("mailto:");
  });

  it("a standard sale whose VAT rate is unreadable is not billed either, and the page says it is the RATE", () => {
    const html = render({ ...storedSale({ price: 1000, included: false }), vatRate: NaN });
    expect(visible(html)).toContain("VAT Rate Not Valid");
    expect(visible(html)).toContain("has no usable VAT rate");
    // not the price message: the price is fine, and pointing at it sends the dealer to the wrong field
    expect(visible(html)).not.toContain("No Price Recorded");
    expect(visible(html)).not.toContain("no usable sale price");
    expect(visible(html)).not.toContain("Total Due");
  });

  it.each([
    ["more than 100% (a rate of 200 saved as 2)", 2],
    ["negative", -0.2],
    ["nothing (null)", null],
    ["text", "20"],
  ])("a VAT rate that is %s says the RATE is wrong, not the price", (_name, rate) => {
    const html = render({ ...storedSale({ price: 1000, included: false }), vatRate: rate as never });
    expect(visible(html)).toContain("VAT Rate Not Valid");
    expect(visible(html)).not.toContain("no usable sale price");
    expect(visible(html)).not.toContain("Total Due");
  });

  it("a sale with no price still says the PRICE is missing", () => {
    const html = render({ ...storedSale({ price: 1000, included: false }), salePrice: 0 });
    expect(visible(html)).toContain("No Price Recorded");
    expect(visible(html)).toContain("no usable sale price");
    expect(visible(html)).not.toContain("VAT Rate Not Valid");
  });

  it("a margin sale whose VAT due is not worked out (no purchase price yet) is still billed at its price, with no VAT line", () => {
    const sale = { ...storedSale({ price: 6000, scheme: "margin" }), vatAmount: null, netAmount: null } as SaleEntry;
    delete (sale as { marginPurchasePrice?: number }).marginPurchasePrice;
    const html = render(sale);
    const text = visible(html);
    expect(text).toContain("Total Due");
    expect(text).toContain("£6,000.00");
    expect(text).toContain("VAT Margin Scheme");
    expect(text).not.toContain("Net");
    expect(text).not.toContain("VAT (");
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("null");
  });

  it("a margin sale never needs a VAT rate, so a bad one does not stop it being billed", () => {
    const html = render({ ...storedSale({ price: 6000, scheme: "margin" }), vatRate: NaN });
    expect(visible(html)).toContain("Total Due");
    expect(visible(html)).not.toContain("VAT Rate Not Valid");
  });
});

describe("the rest of the page is unchanged", () => {
  it("still says No Sale Recorded when the car has no sale", () => {
    const text = visible(render(null));
    expect(text).toContain("No Sale Recorded");
    expect(text).not.toContain("Total Due");
  });

  it("carries the dealer, the buyer, the invoice number and the print button", () => {
    const text = visible(render(storedSale({ price: 1200 })));
    expect(text).toContain("Test Motors");
    expect(text).toContain("VAT No: GB123456789");
    expect(text).toContain("Bill To Sam Buyer");
    expect(text).toContain("Invoice INV-0007");
    expect(text).toContain("Print / Save as PDF");
    expect(text).toContain("Email to Customer");
  });
});
