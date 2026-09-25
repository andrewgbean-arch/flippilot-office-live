import { describe, it, expect } from "vitest";
import type { AuthUser } from "@/context/AuthContext";
import { canOpenPage, pageNeed } from "./pageAccess";

const owner = { id: "o", email: "o@x", name: "O", role: "owner", dealershipId: "d" } as AuthUser;
const as = (staffRole: AuthUser["staffRole"]) => ({ ...owner, role: "staff", staffRole }) as AuthUser;

describe("which pages need more than a login", () => {
  it("knows the books, profit, recon, adding staff, Wanted Cars and billing, and every page under them", () => {
    expect(pageNeed("/bookkeeping")).toBe("money");
    expect(pageNeed("/bookkeeping/entry/v1")).toBe("money");
    expect(pageNeed("/dealer/finance/profit-breakdown")).toBe("money");
    expect(pageNeed("/dealer/workflow/recon/v1")).toBe("money");
    expect(pageNeed("/dealer/staff/add")).toBe("staff");
    expect(pageNeed("/dealer/sales/wanted")).toBe("wanted");
    expect(pageNeed("/billing")).toBe("owner");
  });

  it("leaves everything else to any login, including pages that only share the start of a name", () => {
    for (const path of ["/dealer-dashboard", "/dealer/finance/calculator", "/dealer/staff", "/dealer/staff/permissions", "/bookkeeping-help", "/billingx"]) {
      expect(pageNeed(path), path).toBeNull();
    }
  });

  it("opens each page to the right people", () => {
    expect(canOpenPage(owner, "/billing")).toBe(true);
    expect(canOpenPage(as("manager"), "/billing")).toBe(false);
    expect(canOpenPage(as("finance"), "/bookkeeping")).toBe(true);
    expect(canOpenPage(as("sales"), "/bookkeeping")).toBe(false);
    expect(canOpenPage(as("general"), "/dealer/sales/wanted")).toBe(false);
    expect(canOpenPage(as("sales"), "/dealer/sales/wanted")).toBe(true);
    expect(canOpenPage(as("manager"), "/dealer/staff/add")).toBe(true);
    expect(canOpenPage(as("finance"), "/dealer/staff/add")).toBe(false);
    // a staff account with no role set counts as general
    expect(canOpenPage({ ...owner, role: "staff" } as AuthUser, "/bookkeeping")).toBe(false);
    expect(canOpenPage(null, "/bookkeeping")).toBe(false);
  });
});
