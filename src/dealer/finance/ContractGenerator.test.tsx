import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/context/LeadsContext", () => ({
  useLeads: () => ({ leads: [{ id: "l1", name: "Sam Buyer", phone: "07000 000000" }] }),
}));

import ContractGenerator from "./ContractGenerator";

// The first thing a dealer sees on this screen is what it will put in front of
// a customer. It must not arrive pre-filled with promises.
describe("Contract Generator, as first opened", () => {
  const html = renderToStaticMarkup(<ContractGenerator />);
  const lower = html.toLowerCase();

  it("has no pre-filled warranty promise or inspection clause", () => {
    expect(lower).not.toContain("3 months");
    expect(lower).not.toContain("warranty unless");
    expect(lower).not.toContain("inspected the vehicle");
    expect(lower).not.toContain("buyer confirms");
    expect(lower).not.toContain("valid mot");
  });

  it("carries the starting-template notice: not legal advice, Consumer Rights Act 2015, cannot be signed away", () => {
    expect(html).toContain('role="note"');
    expect(lower).toContain("a starting template, not legal advice");
    expect(html).toContain("Consumer Rights Act 2015");
    expect(lower).toContain("cannot be signed away");
    expect(lower).toContain("checked before you use it");
  });

  it("leaves the seller, warranty and other terms for the dealer to type (blank lines on the printout)", () => {
    expect(html).toContain("Seller: ___________________");
    expect(html).toContain("Seller address: ___________________");
    expect(html).toContain("Warranty (if any):");
    expect(html).toContain("Other terms:");
    // The two textareas are empty.
    expect(html).toMatch(/<textarea[^>]*placeholder="Leave blank if none[^"]*"[^>]*><\/textarea>/);
    expect(html).toMatch(/<textarea[^>]*placeholder="Your own terms[^"]*"[^>]*><\/textarea>/);
    // No VAT number line until the dealer types one.
    expect(html).not.toContain("VAT number:");
  });

  it("prints a blank sale price rather than £0.00, and keeps the signature lines and the print button", () => {
    expect(html).toContain("Sale Price: ___________________");
    expect(html).toContain("Balance Due on Collection: ___________________");
    expect(html).toContain("Signed for the seller");
    expect(html).toContain("Signed by the buyer");
    expect(html).toContain("Print / Save as PDF");
    expect(html).toContain("printable-invoice");
  });

  it("prints the statutory rights line", () => {
    expect(html).toContain("Nothing in this agreement affects the buyer&#x27;s statutory rights.");
  });
});
