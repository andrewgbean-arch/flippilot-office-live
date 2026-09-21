import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SupernovaInput } from "./SupernovaInput";

// Amounts are typed as text (so "£4,500" can be typed and read), and ask a phone
// for the number pad with inputMode="decimal".
describe("SupernovaInput inputMode", () => {
  it("passes inputMode through, and turns autocomplete off for it", () => {
    const html = renderToStaticMarkup(<SupernovaInput label="Buy Price (£)" value="" onChange={() => {}} inputMode="decimal" />);
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('type="text"');
  });

  it("leaves both off when no inputMode is given, as before", () => {
    const html = renderToStaticMarkup(<SupernovaInput label="Make" value="" onChange={() => {}} />);
    expect(html).not.toContain("inputMode");
    expect(html).not.toContain("autoComplete");
  });

  it("still ties the label to the field", () => {
    const html = renderToStaticMarkup(<SupernovaInput label="Buy Price (£)" value="4500" onChange={() => {}} inputMode="decimal" />);
    const id = /<label for="([^"]+)"/.exec(html)![1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain('value="4500"');
  });
});
