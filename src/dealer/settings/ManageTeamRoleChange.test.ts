import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Runs the REAL Manage Team dialog (see Settings.tsx) through a stand-in for
// React's hooks (lib/testing/hookRuntime.ts), against a fake server, and drives
// the role dropdown and the buttons the way the owner would.
//
// The rule under test: moving someone to a LOWER role also cancels every invite
// link already shared (and changing back doesn't restore them), so the dialog
// must ask first and send nothing until the owner says yes. A step up, which
// cancels nothing, still goes through at once. After a step down has gone
// through, the owner is told the shared links no longer work.

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  const runtime = await import("@/lib/testing/hookRuntime");
  const base = (actual as unknown as { default?: object }).default ?? actual;
  const patched = {
    ...base,
    useState: runtime.useState,
    useEffect: runtime.useEffect,
    useRef: runtime.useRef,
    useCallback: runtime.useCallback,
    useMemo: runtime.useMemo,
  };
  return { ...patched, default: patched };
});

import { mount, type Mounted } from "@/lib/testing/hookRuntime";
import { BASE_URL } from "@/lib/apiBaseUrl";
import { ManageTeamModal } from "./Settings";

/* --------------------------- reading the element tree --------------------------- */

interface El {
  type: unknown;
  props: Record<string, any>;
}

const isElement = (node: unknown): node is El => typeof node === "object" && node !== null && "props" in node;

function walk(node: unknown, visit: (el: El) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isElement(node)) return;
  visit(node);
  walk(node.props.children, visit);
}

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) return textOf(node.props.children);
  return "";
}

function findAll(root: unknown, match: (el: El) => boolean): El[] {
  const found: El[] = [];
  walk(root, el => {
    if (match(el)) found.push(el);
  });
  return found;
}

/* -------------------------------- fake server -------------------------------- */

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  staffRole?: "sales" | "finance" | "manager" | "general";
  dealershipId: string;
}

const member = (id: string, name: string, staffRole?: Member["staffRole"]): Member => ({
  id,
  name,
  email: `${id}@example.test`,
  role: "staff",
  ...(staffRole ? { staffRole } : {}),
  dealershipId: "d1",
});

const OWNER: Member = { id: "owner", name: "Alex Owner", email: "alex@example.test", role: "owner", dealershipId: "d1" };

let team: Member[];
let calls: { method: string; path: string; body: any }[];

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const fakeFetch = async (input: unknown, init?: { method?: string; body?: unknown }) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const path = String(input).replace(BASE_URL, "");
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ method, path, body });

  // Answers are copies, as a real response is: the screen must not share
  // objects with the server's own list.
  if (method === "GET" && path === "/team") return reply(200, { ok: true, members: structuredClone(team) });
  const put = path.match(/^\/dealership\/team\/(.+)$/);
  if (method === "PUT" && put) {
    const target = team.find(m => m.id === put[1]);
    if (!target) return reply(404, { ok: false, error: "Team member not found" });
    target.staffRole = body.staffRole;
    return reply(200, { ok: true, member: { ...target } });
  }
  return reply(404, { ok: false, error: `unhandled ${method} ${path}` });
};

const puts = () => calls.filter(c => c.method === "PUT");

/* --------------------------------- plumbing --------------------------------- */

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

let mounted: Mounted<{ onClose: () => void }, any> | null = null;
const screen = () => mounted!.result;

async function open() {
  mounted = mount(ManageTeamModal as (props: { onClose: () => void }) => unknown, { onClose: () => {} }) as Mounted<
    { onClose: () => void },
    any
  >;
  await settle();
}

const dropdown = (name: string) =>
  findAll(screen(), el => el.type === "select" && el.props["aria-label"] === `Role for ${name}`)[0]!;

const chooseRole = async (name: string, role: string) => {
  dropdown(name).props.onChange({ target: { value: role } });
  await settle();
};

const button = (label: string) => findAll(screen(), el => el.type === "button" && textOf(el).trim() === label)[0];
const press = async (label: string) => {
  const b = button(label);
  if (!b) throw new Error(`no "${label}" button on screen`);
  b.props.onClick();
  await settle();
};

const screenText = () => textOf(screen());
const notice = () => findAll(screen(), el => el.type === "p" && el.props.role === "status")[0];
const roleShown = (name: string) => dropdown(name).props.value;

beforeEach(() => {
  calls = [];
  team = [OWNER, member("sarah", "Sarah Bell", "manager"), member("tom", "Tom Reid", "general"), member("old", "Olly Old")];
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ----------------------------------- tests ----------------------------------- */

describe("moving someone to a lower role", () => {
  it("asks first, and sends nothing until the owner confirms", async () => {
    await open();
    await chooseRole("Sarah Bell", "sales");

    expect(puts()).toHaveLength(0);
    expect(screenText()).toContain("Move Sarah Bell from Manager to Sales?");
    expect(screenText()).toMatch(/also cancels every invite link you've already shared/i);
    expect(button("Change role")).toBeDefined();
    expect(roleShown("Sarah Bell")).toBe("manager"); // still what she really is
    expect(notice()).toBeUndefined();
  });

  it("does nothing at all if the owner cancels", async () => {
    await open();
    await chooseRole("Sarah Bell", "general");
    await press("Cancel");

    expect(puts()).toHaveLength(0);
    expect(screenText()).not.toContain("Move Sarah Bell");
    expect(roleShown("Sarah Bell")).toBe("manager");
    expect(button("Remove from team")).toBeDefined(); // her row is back to normal
  });

  it("makes the change once confirmed, and then says the shared links no longer work", async () => {
    await open();
    await chooseRole("Sarah Bell", "sales");
    await press("Change role");

    expect(puts()).toEqual([{ method: "PUT", path: "/dealership/team/sarah", body: { staffRole: "sales" } }]);
    expect(roleShown("Sarah Bell")).toBe("sales");
    expect(screenText()).not.toContain("Move Sarah Bell"); // the question is gone
    const line = textOf(notice());
    expect(line).toContain("Sarah Bell is now Sales");
    expect(line).toMatch(/invite links you'd already shared no longer work/i);
  });

  it("asks for every kind of step down, not just from manager", async () => {
    await open();
    await chooseRole("Sarah Bell", "finance");
    expect(screenText()).toContain("Move Sarah Bell from Manager to Finance?");
    expect(puts()).toHaveLength(0);

    team.push(member("fin", "Fin Ance", "finance"));
    mounted!.unmount();
    await open();
    await chooseRole("Fin Ance", "sales"); // finance -> sales is a step down
    expect(screenText()).toContain("Move Fin Ance from Finance to Sales?");
    expect(puts()).toHaveLength(0);
  });

  it("asks about only one person at a time, and picking another role drops the open question", async () => {
    await open();
    await chooseRole("Sarah Bell", "sales");
    expect(screenText()).toContain("Move Sarah Bell");

    // A step up for someone else goes through, and the earlier question is dropped.
    await chooseRole("Tom Reid", "manager");
    expect(screenText()).not.toContain("Move Sarah Bell");
    expect(puts().map(c => c.path)).toEqual(["/dealership/team/tom"]);

    // Asking about Sarah, then choosing the role she already has, drops it too.
    await chooseRole("Sarah Bell", "sales");
    expect(screenText()).toContain("Move Sarah Bell");
    await chooseRole("Sarah Bell", "manager");
    expect(screenText()).not.toContain("Move Sarah Bell");
    expect(puts()).toHaveLength(1);
  });

  it("starting to remove someone drops the open role question, and the remove confirmation still works", async () => {
    await open();
    await chooseRole("Sarah Bell", "sales");
    await chooseRole("Tom Reid", "manager"); // (a step up: goes straight through)
    await chooseRole("Sarah Bell", "general");
    expect(screenText()).toContain("Move Sarah Bell");

    // Sarah's own row hides its Remove link while her question is open, so use Tom's.
    await press("Remove from team");
    expect(screenText()).not.toContain("Move Sarah Bell");
    expect(screenText()).toMatch(/Remove .*\? They'll lose access at once/);
    expect(calls.filter(c => c.method === "DELETE")).toHaveLength(0); // still only asking
  });

  it("an account with no role counts as general, so it can be moved up without a question", async () => {
    await open();
    await chooseRole("Olly Old", "sales");
    expect(screenText()).not.toContain("Move Olly Old");
    expect(puts().map(c => c.body)).toEqual([{ staffRole: "sales" }]);
    expect(notice()).toBeUndefined();
  });
});

describe("moving someone to a higher role, or nowhere", () => {
  it("makes a step up at once, with no question and no notice about links", async () => {
    await open();
    await chooseRole("Tom Reid", "manager");

    expect(puts()).toEqual([{ method: "PUT", path: "/dealership/team/tom", body: { staffRole: "manager" } }]);
    expect(roleShown("Tom Reid")).toBe("manager");
    expect(screenText()).not.toMatch(/Move Tom Reid/);
    expect(button("Change role")).toBeUndefined();
    expect(notice()).toBeUndefined();
  });

  it("sends nothing for a pick that is not a role, or the role they already have", async () => {
    await open();
    await chooseRole("Tom Reid", "general");
    await chooseRole("Tom Reid", "owner");
    await chooseRole("Sarah Bell", "manager");
    expect(puts()).toHaveLength(0);
    expect(screenText()).not.toContain("Move ");
  });
});
