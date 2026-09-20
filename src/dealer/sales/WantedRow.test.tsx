import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { WantedRow } from "./WantedBoard";
import type { WantedItem } from "@/lib/wantedApi";

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();

// `over` may set an optional field to undefined (to say "this person gave no phone").
const base = (over: Partial<Record<keyof WantedItem, unknown>> = {}): WantedItem => ({
  id: "r1",
  name: "Priya Shah",
  phone: "07700 900123",
  email: "priya@example.co.uk",
  make: "Ford",
  model: "Fiesta",
  maxPrice: 9000,
  note: "Automatic if possible",
  status: "waiting",
  consent: { at: ago(3), wording: "I'd like Sam's Motors to contact me." },
  createdAt: ago(3),
  askedAt: ago(3),
  matches: [],
  ...(over as Partial<WantedItem>),
});

const row = (over: Partial<Record<keyof WantedItem, unknown>> = {}, highlight = false) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <WantedRow item={base(over)} retentionDays={365} dealerName="Sam's Motors" onChanged={async () => {}} highlight={highlight} />
    </MemoryRouter>
  );

describe("a request on the Wanted Cars page", () => {
  it("shows who, what for, how much, what they said, and when they asked", () => {
    const h = row();
    for (const text of ["Priya Shah — Ford Fiesta", "Up to £9,000", "Automatic if possible", "Asked 3 days ago", "07700 900123", "priya@example.co.uk"]) {
      expect(h, text).toContain(text);
    }
  });

  it("shows they agreed to be contacted, with the exact words available, and when their details go", () => {
    const h = row();
    expect(h).toContain("agreed to be contacted");
    expect(h).toContain("I&#x27;d like Sam&#x27;s Motors to contact me.");
    expect(h).toContain("kept until");
  });

  it("offers call, text and email as links that open the dealer's own apps", () => {
    const h = row();
    expect(h).toContain('href="tel:07700900123"');
    expect(h).toContain('href="sms:07700900123?&amp;body=');
    expect(h).toContain('href="mailto:priya@example.co.uk?subject=');
  });

  it("offers only what can be used: no call or text without a phone number, no email without an address", () => {
    const noPhone = row({ phone: undefined });
    expect(noPhone).not.toContain("tel:");
    expect(noPhone).not.toContain("sms:");
    expect(noPhone).toContain("mailto:");
    const noEmail = row({ email: undefined });
    expect(noEmail).not.toContain("mailto:");
    expect(noEmail).toContain("tel:");
  });

  it("lists the cars you have that fit, each linking to the car, and says when one is over budget", () => {
    const h = row({ matches: [{ vehicleId: "v1", label: "2019 Ford Fiesta", price: 9500, overBudgetBy: 500 }, { vehicleId: "v2", label: "2017 Ford Fiesta", price: 6000 }] });
    expect(h).toContain("You have 2 cars that fit");
    expect(h).toContain('href="/dealer/inventory/v1"');
    expect(h).toContain("(£500 over their budget)");
    expect(h).toContain("2017 Ford Fiesta, £6,000");
  });

  it("makes the ready message say 'just got' only when there is a car, and prefers one within budget", () => {
    const withCar = row({ matches: [{ vehicleId: "v1", label: "Over Car", price: 9500, overBudgetBy: 500 }, { vehicleId: "v2", label: "Fits Car", price: 6000 }] });
    const readable = decodeURIComponent(withCar);
    expect(readable).toContain("We&#x27;ve just got a Fits Car in"); // markup writes ' as &#x27;
    expect(readable).not.toContain("just got a Over Car");
    expect(decodeURIComponent(row())).not.toContain("just got");
  });

  it("shows the right buttons for each status", () => {
    const waiting = row();
    expect(waiting).toContain("Mark contacted");
    expect(waiting).toContain(">Close<");
    expect(waiting).not.toContain("Back to waiting");

    const contacted = row({ status: "contacted" });
    expect(contacted).toContain("Back to waiting");
    expect(contacted).not.toContain("Mark contacted");

    const closed = row({ status: "closed", matches: [{ vehicleId: "v1", label: "Ford Fiesta", price: 1 }] });
    expect(closed).toContain("Back to waiting");
    expect(closed).not.toContain(">Close<");
    expect(closed).not.toContain("You have"); // a closed request no longer asks for a car
  });

  it("asks before forgetting anyone, rather than deleting at a click", () => {
    const h = row();
    expect(h).toContain("Forget this person");
    expect(h).not.toContain("Delete their details for good?");
    expect(h).not.toContain("Yes, delete");
  });

  it("shows what a stranger typed as text, never as markup", () => {
    const h = row({ name: "<script>alert(1)</script>", note: "<img src=x onerror=alert(1)>" });
    expect(h).not.toContain("<script>");
    expect(h).not.toMatch(/<img src=x/);
    expect(h).toContain("&lt;script&gt;");
  });

  it("highlights a person waiting for a car you have", () => {
    expect(row({}, true)).toContain("border-left:3px solid #facc15");
    expect(row({}, false)).not.toContain("border-left");
  });
});
