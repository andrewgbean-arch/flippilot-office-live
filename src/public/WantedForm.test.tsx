import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WantedFormView, WantedThanks } from "./WantedForm";
import { emptyDraft } from "./wantedFormModel";
import type { PublicVehicle } from "./publicBookingApi";

const WORDING = "I'd like Sam's Motors to contact me about cars that match this. They'll keep my details for up to 12 months, and I can ask them to delete them at any time.";
const info = { consentWording: WORDING, accepting: true };
const noop = () => {};

const form = (over: Partial<Parameters<typeof WantedFormView>[0]> = {}) =>
  renderToStaticMarkup(<WantedFormView info={info} draft={emptyDraft} onChange={noop} onSubmit={noop} dealerName="Sam's Motors" dealerPhone="01234 567890" {...over} />);

describe("the form", () => {
  it("asks what they want, who they are, and shows the exact words they agree to next to a tick-box", () => {
    const h = form();
    for (const label of ["Make", "Model", "Most you", "Anything else", "Your name", "Phone", "Email"]) expect(h, label).toContain(label);
    expect(h).toContain("Sam&#x27;s Motors to contact me about cars that match this");
    expect(h).toContain("12 months");
    expect(h).toMatch(/<input[^>]*type="checkbox"/);
    expect(h).toContain("Tell me when you get one");
  });

  it("gives every box a label that is properly tied to it", () => {
    const h = form();
    for (const id of ["wanted-make", "wanted-model", "wanted-budget", "wanted-note", "wanted-name", "wanted-phone", "wanted-email"]) {
      expect(h, id).toContain(`for="${id}"`);
      expect(h, id).toContain(`id="${id}"`);
    }
    expect(h).toContain('autoComplete="email"');
    expect(h).toContain('autoComplete="tel"');
    expect(h).toContain('autoComplete="name"');
  });

  it("says plainly what happens to what they give", () => {
    const h = form();
    expect(h).toContain("only they will see your details");
    expect(h).toContain("costs nothing");
  });

  it("hides the trap box from people and screen readers, and out of the tab order", () => {
    const h = form();
    const trap = h.match(/<div aria-hidden="true"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(trap).toContain('name="website"');
    expect(trap).toContain('tabindex="-1"');
    expect(trap).toContain('autoComplete="off"');
  });

  it("shows what has been typed", () => {
    const h = form({ draft: { ...emptyDraft, make: "Ford", name: "Priya" } });
    expect(h).toContain('value="Ford"');
    expect(h).toContain('value="Priya"');
  });

  it("shows a problem as an alert, and says Sending… while it goes", () => {
    expect(form({ error: "Please tell us your name." })).toMatch(/role="alert"[^>]*>Please tell us your name\./);
    expect(form()).not.toContain('role="alert"');
    expect(form({ sending: true })).toContain("Sending…");
  });

  it("is switched off in the dealer's own preview, and says so", () => {
    const h = form({ preview: true });
    expect(h).toMatch(/<fieldset[^>]*disabled/);
    expect(h).toContain("This is a preview");
    expect(form()).not.toContain("This is a preview");
    expect(form()).not.toMatch(/<fieldset[^>]*disabled/);
  });

  it("swaps the form for a note pointing at the phone when the dealer's list is full", () => {
    const h = form({ info: { ...info, accepting: false } });
    expect(h).not.toContain("<form");
    expect(h).toContain("can&#x27;t take any more requests");
    expect(h).toContain("give them a call");
    expect(form({ info: { ...info, accepting: false }, dealerPhone: undefined })).toContain("get in touch with them directly");
  });

  it("shows a dealer's name that is markup as text", () => {
    const h = form({ dealerName: "<script>alert(1)</script>" });
    expect(h).not.toContain("<script>");
    expect(h).toContain("&lt;script&gt;");
  });
});

const car = (over: Partial<PublicVehicle> = {}): PublicVehicle => ({ id: "v1", make: "Ford", model: "Fiesta", year: 2019, mileage: 42000, priceRetail: 8495, ...over });
const thanks = (over: Partial<Parameters<typeof WantedThanks>[0]> = {}) =>
  renderToStaticMarkup(<WantedThanks dealerName="Sam's Motors" dealershipId="d1" name="Priya" inStockNow={[]} onAgain={noop} {...over} />);

describe("once it has been sent", () => {
  it("thanks them by name and says who has their request", () => {
    const h = thanks();
    expect(h).toContain("Thank you, Priya.");
    expect(h).toContain("Sam&#x27;s Motors has your request");
    expect(h).toContain('role="status"');
    expect(h).toContain("Ask for something else");
    expect(thanks({ name: "" })).toContain("Thank you.");
  });

  it("makes no claim about cars in stock when none fit", () => {
    expect(thanks()).not.toContain("in stock right now");
  });

  it("puts a car that is already in stock first, with a way to see it", () => {
    const h = thanks({ inStockNow: [car()] });
    expect(h).toContain("There&#x27;s one in stock right now");
    expect(h).toContain("2019 Ford Fiesta");
    expect(h).toContain("£8,495");
    expect(h).toContain('href="/book/d1?vehicle=v1"');
    expect(h).toContain("Book a viewing");
  });

  it("links to the full history page when the dealer has published one", () => {
    const h = thanks({ inStockNow: [car({ hasPassport: true })] });
    expect(h).toContain('href="/car/d1/v1"');
    expect(h).toContain("See full history");
  });

  it("says 'some' for several, and 'price on request' rather than a price it doesn't have", () => {
    const h = thanks({ inStockNow: [car(), car({ id: "v2", priceRetail: null })] });
    expect(h).toContain("There are some in stock right now");
    expect(h).toContain("Price on request");
  });

  it("shows a name that is markup as text", () => {
    const h = thanks({ name: "<img src=x onerror=alert(1)>" });
    expect(h).not.toMatch(/<img src=x/);
    expect(h).toContain("&lt;img");
  });
});
