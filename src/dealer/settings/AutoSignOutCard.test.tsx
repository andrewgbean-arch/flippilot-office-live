import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The Automatic Sign-Out card as each person sees it: only the owner gets the
// choice (the server refuses anyone else, see dealershipMeFields.test.ts).

const auth = vi.hoisted(() => ({ role: "owner" as "owner" | "staff" }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: auth.role, dealershipId: "d1" } }),
}));
vi.mock("@/context/DealerContext", () => ({
  useDealer: () => ({ dealer: { id: "d1", name: "Test Motors", autoSignOutMinutes: 30 }, updateDealer: vi.fn() }),
}));

import AutoSignOutCard from "./AutoSignOutCard";

beforeEach(() => {
  auth.role = "owner";
});

describe("AutoSignOutCard", () => {
  it("gives the owner the choice, on the dealership's current setting", () => {
    const html = renderToStaticMarkup(<AutoSignOutCard />);
    expect(html).toContain("<select");
    expect(html).toMatch(/<option value="30" selected="">30 minutes<\/option>/);
  });

  it("shows staff the setting with nothing to change", () => {
    auth.role = "staff";
    const html = renderToStaticMarkup(<AutoSignOutCard />);
    expect(html).not.toContain("<select");
    expect(html).toContain("Dealer OS signs out after 30 minutes with nobody using it.");
  });
});
