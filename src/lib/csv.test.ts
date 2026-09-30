import { describe, it, expect } from "vitest";
import { toCSV } from "./csv";

// toCSV builds the files behind every "Data Export" button (Vehicles,
// Purchases, Costs, Sales) — some of the fields in those rows are free
// text a person typed (a vehicle's colour, a cost's label, a sale's
// buyer), and a buyer's name in particular can trace back to the public
// booking form, so it is never something this app fully controls.
describe("toCSV — a cell someone typed must never become a formula", () => {
  it("quotes a field that has a comma, a quote, or a newline, and nothing else", () => {
    const csv = toCSV(["Name", "Note"], [["Red Fiesta", "One owner, full history"], ["Blue Golf", 'Said "as seen"'], ["Polo", "Line one\nLine two"]]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('Red Fiesta,"One owner, full history"');
    expect(lines[2]).toBe('Blue Golf,"Said ""as seen"""');
    expect(lines[3]).toBe('Polo,"Line one\nLine two"');
  });

  it("prefixes a cell that starts with =, +, -, @, a tab or a carriage return, so a spreadsheet reads it as text, not a formula", () => {
    const dangerous = [
      "=1+1",
      "=HYPERLINK(\"http://evil.example/steal\",\"Click here\")",
      "+44 7700 900000", // a phone number typed with a leading + is just as dangerous
      "-1",
      "@SUM(A1:A9)",
      "\tsneaky",
      "\rsneaky",
    ];
    for (const value of dangerous) {
      const csv = toCSV(["Buyer"], [[value]]);
      const cell = csv.split("\r\n")[1]!;
      // Wrapped in "..." too when the value also needs that (a comma, a
      // quote, or a newline in it) — the safety apostrophe is then the
      // first character INSIDE the quotes, not of the whole field.
      const unwrapped = cell.startsWith('"') ? cell.slice(1) : cell;
      expect(unwrapped.startsWith("'"), value).toBe(true);
    }
  });

  it("leaves an ordinary value — including a minus sign or an @ in the middle — completely alone", () => {
    const csv = toCSV(["Note"], [["a@b.com is their email"], ["net -£50 on this one"], [""], [null], [undefined]]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("a@b.com is their email");
    expect(lines[2]).toBe("net -£50 on this one");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("");
    expect(lines[5]).toBe("");
  });

  it("still quotes correctly when a formula-triggering cell also needs comma/quote escaping", () => {
    const csv = toCSV(["Note"], [['=A1,"gotcha"']]);
    const cell = csv.split("\r\n")[1]!;
    // The safety prefix goes on first, then the normal quoting rules apply
    // to the result, exactly as they would for any other value.
    expect(cell).toBe('"\'=A1,""gotcha"""');
  });

  it("a header itself gets the same protection — a CSV import guess-column feature is exactly the kind of thing that reads headers back as formulas too", () => {
    const csv = toCSV(["=cmd|' /c calc'!A1", "Ordinary"], [["x", "y"]]);
    expect(csv.split("\r\n")[0]).toBe("'=cmd|' /c calc'!A1,Ordinary");
  });
});
