import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { AdminGateView } from "./AdminGate";

const render = (status: "checking" | "admin" | "not") =>
  renderToStaticMarkup(
    <MemoryRouter>
      <AdminGateView status={status}>
        <p>SECRET ADMIN PAGE</p>
      </AdminGateView>
    </MemoryRouter>
  );

describe("the platform-admin pages", () => {
  it("show the page to a platform admin", () => {
    expect(render("admin")).toContain("SECRET ADMIN PAGE");
  });

  it("show an ordinary dealer the plain role panel, not the admin page", () => {
    const html = render("not");
    expect(html).not.toContain("SECRET ADMIN PAGE");
    expect(html).toContain("This page isn&#x27;t open to your role");
    expect(html).toContain("Back to the dashboard");
  });

  it("show nothing of the page while it is still being checked, so it never flashes up", () => {
    const html = render("checking");
    expect(html).not.toContain("SECRET ADMIN PAGE");
    expect(html).toContain("Checking");
  });

  it("are both behind the gate in the routes", () => {
    const routes = readFileSync(join(__dirname, "..", "router", "AnimatedRoutes.tsx"), "utf8");
    expect(routes).toMatch(/path="admin\/support" element=\{<AdminGate><SupportInbox \/><\/AdminGate>\}/);
    expect(routes).toMatch(/path="admin\/dealerships" element=\{<AdminGate><AdminDealerships \/><\/AdminGate>\}/);
  });
});
