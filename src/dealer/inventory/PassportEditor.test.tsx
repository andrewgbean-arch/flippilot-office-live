import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PassportEditor, { type PassportFacts } from "./PassportEditor";
import type { PassportSetup } from "@/lib/carPassportApi";

const config = (over: Partial<PassportSetup["config"]> = {}): PassportSetup["config"] => ({
  published: false,
  showReg: true,
  showMot: true,
  showUlez: true,
  showMarket: false,
  workDone: [],
  note: "",
  updatedAt: "",
  ...over,
});

const setup = (over: Partial<PassportSetup> = {}, cfg: Partial<PassportSetup["config"]> = {}): PassportSetup => ({
  config: config(cfg),
  suggestions: [],
  canPublish: true,
  ...over,
});

const facts = (over: Partial<PassportFacts> = {}): PassportFacts => ({
  title: "2019 Ford Fiesta",
  priceText: "£8,495",
  reg: "AB12 CDE",
  sold: false,
  hasMotRecord: true,
  hasFuelType: true,
  ...over,
});

const render = (over: { initial?: PassportSetup; facts?: PassportFacts; canEdit?: boolean } = {}) =>
  renderToStaticMarkup(
    <PassportEditor
      vehicleId="v1"
      dealershipId="d1"
      origin="https://app.example.com"
      dealerName="Sam's Motors"
      facts={over.facts ?? facts()}
      initial={over.initial ?? setup()}
      canEdit={over.canEdit ?? true}
      save={async () => ({ ok: false, error: "not used" })}
    />
  );

describe("PassportEditor: before anything is published", () => {
  it("says plainly that nothing is public, and offers no link or QR code", () => {
    const h = render();
    expect(h).toContain("Not published. Nobody can see this page.");
    for (const absent of ["Share it", "Print a QR card", "See what buyers see", "https://app.example.com/car/"]) expect(h, absent).not.toContain(absent);
  });

  it("says what is always shown and what never is", () => {
    const h = render();
    expect(h).toContain("Always shown: the photos, make, model, year, mileage, colour and your asking price.");
    expect(h).toContain("What you paid, your costs and your notes are never shown.");
  });

  it("starts with the market comparison off and the rest on", () => {
    const h = render();
    const box = (label: string) => new RegExp(`role="switch"([^>]*)>\\s*<span[^>]*><span[^>]*>${label}`).exec(h)?.[1] ?? "";
    expect(box("Price against the market")).not.toContain("checked");
    expect(box("MOT history")).toContain("checked");
    expect(box("Registration")).toContain("checked");
  });

  it("has a save button that does nothing until something changes", () => {
    const h = render();
    expect(h).toMatch(/<button[^>]*disabled[^>]*>Save changes<\/button>/);
  });
});

describe("PassportEditor: once it's live", () => {
  const live = () => render({ initial: setup({}, { published: true, workDone: ["New pads"] }) });

  it("shows the link buyers open, a copy button, and a QR code for it", () => {
    const h = live();
    expect(h).toContain("Share it");
    expect(h).toContain('value="https://app.example.com/car/d1/v1"');
    expect(h).toContain("Copy");
    expect(h).toContain('role="img"');
    expect(h).toContain("QR code that opens this car");
  });

  it("lets the dealer open the real page in a new tab, safely", () => {
    const h = live();
    expect(h).toContain('href="https://app.example.com/car/d1/v1"');
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener noreferrer"');
    expect(h).toContain("See what buyers see");
  });

  it("has a print-only card with the dealer, the car, the price and the reg", () => {
    const h = live();
    expect(h).toContain("Print a QR card");
    expect(h).toContain("passport-print-card");
    for (const text of ["Sam&#x27;s Motors", "2019 Ford Fiesta", "£8,495", "AB12 CDE"]) expect(h, text).toContain(text);
  });

  it("says the page is live", () => {
    expect(live()).toContain("Anyone with the link can see this page.");
  });
});

describe("PassportEditor: the lines about work done", () => {
  it("lists them with a way to remove each", () => {
    const h = render({ initial: setup({}, { workDone: ["New pads", "Full valet"] }) });
    expect(h).toContain("New pads");
    expect(h).toContain('aria-label="Remove: New pads"');
    expect(h).toContain('aria-label="Remove: Full valet"');
  });

  it("offers what's already recorded for the car, except what's already on the list", () => {
    const h = render({ initial: setup({ suggestions: ["Full valet", "Two new tyres"] }, { workDone: ["full valet"] }) });
    expect(h).toContain("+ Two new tyres");
    expect(h).not.toContain("+ Full valet");
  });

  it("says no prices, and how many lines there can be", () => {
    const h = render();
    expect(h).toContain("No prices. Up to 12.");
  });

  it("shows a stored line as text, never as markup", () => {
    const h = render({ initial: setup({}, { workDone: ['<script>alert("x")</script>'] }) });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });
});

describe("PassportEditor: honest notes about what will and won't appear", () => {
  it("says the MOT section won't appear until a MOT look-up has been run", () => {
    expect(render({ facts: facts({ hasMotRecord: false }) })).toContain("no MOT record on file for this car, so this section won&#x27;t appear");
    expect(render({ facts: facts({ hasMotRecord: true }) })).toContain("refresh it on the MOT tab first");
  });

  it("says emissions won't appear without a fuel type from the DVLA look-up", () => {
    expect(render({ facts: facts({ hasFuelType: false }) })).toContain("no fuel type on file");
    expect(render({ facts: facts({ hasFuelType: true }) })).toContain("from its fuel type and Euro standard");
  });

  it("explains the market comparison shows whatever is true, good or bad", () => {
    expect(render()).toContain("It shows whatever is true, good or bad");
  });

  it("warns that a sold car's page shows only a 'sold' notice", () => {
    expect(render({ facts: facts({ sold: true }) })).toContain("marked as sold, so its page shows a plain &quot;sold&quot; notice");
  });

  it("says why a car can't be published, and won't let the switch be turned on", () => {
    const h = render({ initial: setup({ canPublish: false, cannotPublishBecause: "Add the make and model first." }) });
    expect(h).toContain("Add the make and model first.");
    expect(h).toMatch(/role="switch"[^>]*disabled/);
  });
});

describe("PassportEditor: for someone who can look but not publish", () => {
  const h = () => render({ canEdit: false, initial: setup({ suggestions: ["Full valet"] }, { workDone: ["New pads"] }) });

  it("says who can publish, and offers no save, add or remove", () => {
    expect(h()).toContain("Only sales staff, managers and the owner can publish a Car Passport.");
    for (const absent of ["Save changes", ">Add<", "Remove", "+ Full valet"]) expect(h(), absent).not.toContain(absent);
  });

  it("still shows the settings, read-only", () => {
    expect(h()).toContain("New pads");
    expect(h().match(/role="switch"[^>]*disabled/g)?.length).toBe(5);
  });
});
