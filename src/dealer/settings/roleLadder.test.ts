import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STAFF_ROLES_LOW_TO_HIGH, isRoleDemotion, isStaffRole, roleChangeStep, type StaffRole } from "./roleLadder";

// Moving someone to a lower role cancels every invite link already shared (the
// server decides that, see isStaffRoleDemotion in src/backend/src/auth.ts). The
// Manage Team screen asks the owner FIRST, so it needs the same answer the
// server will give. roleChangeTable.json lists every move with its answer, and
// the backend's inviteRevocation.test.ts reads the very same file: if this
// screen's ladder and the server's ever disagree, one of the two fails.

type Row = [from: StaffRole, to: StaffRole, demotion: boolean];
const table = JSON.parse(readFileSync(new URL("./roleChangeTable.json", import.meta.url), "utf8")) as {
  roles: StaffRole[];
  rows: Row[];
};

describe("the shared role-change table", () => {
  it("lists the roles lowest to highest, exactly as this screen's ladder ranks them", () => {
    expect(table.roles).toEqual([...STAFF_ROLES_LOW_TO_HIGH]);
  });

  it("has exactly one row for every from -> to pair (including staying the same)", () => {
    const seen = new Set(table.rows.map(([from, to]) => `${from}>${to}`));
    expect(seen.size).toBe(table.rows.length); // no duplicates
    for (const from of table.roles) {
      for (const to of table.roles) expect(seen.has(`${from}>${to}`), `${from} -> ${to}`).toBe(true);
    }
    expect(table.rows).toHaveLength(table.roles.length * table.roles.length);
  });
});

describe("isRoleDemotion agrees with the server's ladder, row by row", () => {
  it.each(table.rows)("%s -> %s: demotion is %s", (from, to, expected) => {
    expect(isRoleDemotion(from, to)).toBe(expected);
  });

  it("counts an account with no role at all as general", () => {
    expect(isRoleDemotion(undefined, "general")).toBe(false);
    expect(isRoleDemotion(undefined, "sales")).toBe(false);
    expect(isRoleDemotion(undefined, "manager")).toBe(false);
  });
});

describe("roleChangeStep: what the role dropdown does with a pick", () => {
  it.each(table.rows)("%s -> %s", (from, to, demotion) => {
    const expected = from === to ? "ignore" : demotion ? "confirm" : "apply";
    expect(roleChangeStep(from, to)).toBe(expected);
  });

  it("asks before a step down and changes a step up at once", () => {
    expect(roleChangeStep("manager", "sales")).toBe("confirm");
    expect(roleChangeStep("finance", "general")).toBe("confirm");
    expect(roleChangeStep("general", "manager")).toBe("apply");
    expect(roleChangeStep("sales", "finance")).toBe("apply");
  });

  it("treats no role at all as general", () => {
    expect(roleChangeStep(undefined, "general")).toBe("ignore");
    expect(roleChangeStep(undefined, "sales")).toBe("apply");
  });

  it("ignores anything that is not a real role", () => {
    for (const junk of ["", "owner", "admin", "toString", "__proto__", "Manager"]) {
      expect(roleChangeStep("manager", junk), junk).toBe("ignore");
      expect(isStaffRole(junk), junk).toBe(false);
    }
  });
});
