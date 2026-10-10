import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import EditCustomerForm, { detailsProblem } from "./EditCustomerForm";
import type { Customer } from "@/lib/customersApi";

// Correcting a customer's details on the Customers screen.

const customer = {
  id: "c1",
  name: "Jo Bloggs",
  email: "jo@example.com",
  phone: "07700 900111",
  vehicleInterests: "Small SUV",
  notes: "Prefers mornings",
  emailConsent: { status: "opted_in" },
  whatsappConsent: { status: "not_asked" },
  createdAt: "2030-01-01T00:00:00.000Z",
  createdByName: "Owner",
  updatedAt: "2030-01-01T00:00:00.000Z",
} as unknown as Customer;

const noop = async () => null;

describe("the edit form", () => {
  it("opens with their details filled in, each box labelled", () => {
    const html = renderToStaticMarkup(<EditCustomerForm customer={customer} onSave={noop} onCancel={() => {}} />);
    for (const [label, value] of [
      ["Name", "Jo Bloggs"],
      ["Email", "jo@example.com"],
      ["Phone", "07700 900111"],
      ["Interested in", "Small SUV"],
      ["Notes", "Prefers mornings"],
    ]) {
      expect(html, label).toMatch(new RegExp(`${label}<input[^>]*value="${value}"`));
    }
    expect(html).toContain("Save Changes");
    expect(html).toContain("Cancel");
    expect(html).toContain('aria-label="Edit Jo Bloggs"');
  });

  it("a customer with missing details opens with empty boxes, not 'undefined'", () => {
    const sparse = { ...customer, email: undefined, vehicleInterests: undefined, notes: undefined } as unknown as Customer;
    const html = renderToStaticMarkup(<EditCustomerForm customer={sparse} onSave={noop} onCancel={() => {}} />);
    expect(html).not.toContain("undefined");
  });
});

describe("what it won't save", () => {
  const ok = { name: "Jo", email: "", phone: "07700 900111", vehicleInterests: "", notes: "" };

  it("a name and an email or a phone, the same rule as adding a customer", () => {
    expect(detailsProblem(ok)).toBeNull();
    expect(detailsProblem({ ...ok, phone: "", email: "jo@example.com" })).toBeNull();
    expect(detailsProblem({ ...ok, name: "  " })).toBe("Their name can't be empty.");
    expect(detailsProblem({ ...ok, phone: " " })).toBe("Keep an email address or a phone number for them.");
  });
});

describe("on the Customers screen", () => {
  const screen = readFileSync(join(__dirname, "CustomersScreen.tsx"), "utf8");

  it("every customer has an Edit button for anyone who can see the list, and Remove stays managers-only", () => {
    expect(screen).toMatch(/onClick=\{\(\) => setEditingId\(c\.id\)\}[^>]*>\s*Edit\s*<\/button>/);
    expect(screen).toMatch(/\{canRemove && \(\s*<button[^>]*sn-btn--danger/);
    // Edit isn't hidden behind canRemove
    const editAt = screen.indexOf("setEditingId(c.id)");
    const gateAt = screen.indexOf("{canRemove && (");
    expect(editAt).toBeGreaterThan(-1);
    expect(editAt).toBeLessThan(gateAt);
  });

  it("an emptied box is sent as empty, so the server removes that detail", () => {
    expect(screen).toMatch(/updateCustomer\(id, \{\s*name: d\.name\.trim\(\),\s*email: d\.email\.trim\(\),\s*phone: d\.phone\.trim\(\),/);
  });
});
