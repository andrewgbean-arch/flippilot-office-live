import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoStaffNote } from "./StaffDashboard";

describe("a staff page with nobody on it", () => {
  it("explains that this list is separate from the people who can log in", () => {
    const text = renderToStaticMarkup(<NoStaffNote onAdd={() => {}} />);
    expect(text).toContain("Nobody is on the rota yet");
    expect(text).toContain("Manage Team in Settings");
    expect(text).toContain("Add a staff member");
  });

  it("only shows when there are no staff records", () => {
    const source = readFileSync(join(__dirname, "StaffDashboard.tsx"), "utf8");
    expect(source).toContain("{staff.length === 0 && <NoStaffNote");
  });
});
