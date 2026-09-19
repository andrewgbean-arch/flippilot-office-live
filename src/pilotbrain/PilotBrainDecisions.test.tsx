import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PilotBrainDecisions from "./PilotBrainDecisions";

// The Decisions page itself. Who is logged in is swapped for a stand-in so the
// page can be drawn for each kind of person; the page decides what they see.
const auth = vi.hoisted(() => ({ user: null as null | { id: string; name: string; email: string; role: "owner" | "staff"; staffRole?: string; dealershipId: string } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));

const person = (role: "owner" | "staff", staffRole?: string) => ({ id: "u1", name: "Pat", email: "pat@example.test", role, ...(staffRole ? { staffRole } : {}), dealershipId: "dealer" });
function render(user: typeof auth.user) {
  auth.user = user;
  return renderToStaticMarkup(
    <MemoryRouter>
      <PilotBrainDecisions />
    </MemoryRouter>
  );
}

describe("the Decisions page", () => {
  it("tells anyone who is not an owner or a manager so, plainly, and offers nothing to do", () => {
    for (const who of [person("staff", "general"), person("staff", "sales"), person("staff", "finance"), person("staff"), null]) {
      const html = render(who);
      expect(html, JSON.stringify(who)).toContain("Decisions are for owners and managers");
      expect(html).not.toContain("New decision");
      expect(html).not.toContain("Loading");
    }
  });

  it("says who it is for, and that Boss decides, at the top", () => {
    const html = render(person("owner"));
    expect(html).toContain("Owners and managers only");
    expect(html).toContain("You decide: Pilot only advises.");
    expect(html).toContain("Pilot Brain — Decisions");
  });

  it("lets the owner and a manager in, starting with a loading state rather than an empty journal", () => {
    for (const who of [person("owner"), person("staff", "manager")]) {
      const html = render(who);
      expect(html).toContain("Loading…");
      expect(html).not.toContain("Decisions are for owners and managers");
      expect(html).not.toContain("Nothing written down yet"); // an unfinished load must never look like an empty journal
    }
  });
});

describe("the page is wired into the app", () => {
  const read = (...parts: string[]) => readFileSync(join(__dirname, "..", ...parts), "utf8");

  it("has its own route next to the other Pilot Brain pages", () => {
    const routes = read("router", "AnimatedRoutes.tsx");
    expect(routes).toContain('import PilotBrainDecisions from "@/pilotbrain/PilotBrainDecisions";');
    expect(routes).toContain('<Route path="pilot-brain/decisions" element={<PilotBrainDecisions />} />');
  });

  it("is linked from the Strategy page and the chat header", () => {
    for (const page of ["PilotBrainStrategy.tsx", "PilotBrainChat.tsx"]) {
      const source = read("pilotbrain", page);
      expect(source, page).toContain('to="/pilot-brain/decisions"');
      expect(source, page).toContain("Decision Journal");
    }
  });
});
