import { describe, it, expect } from "vitest";
import type { WantedItem } from "@/lib/wantedApi";
import {
  askedText,
  budgetText,
  contactLinks,
  groupWanted,
  keptUntil,
  matchText,
  messageFor,
  waitingForCar,
  waitingSentence,
  wantText,
} from "./wantedBoardModel";

const DAY = 86_400_000;
const now = Date.parse("2030-06-15T12:00:00.000Z");
const ago = (days: number) => new Date(now - days * DAY).toISOString();

// `over` may set an optional field to undefined (to say "this person gave no phone").
const item = (over: Partial<Record<keyof WantedItem, unknown>> = {}): WantedItem => ({
  id: "r1",
  name: "Priya Shah",
  phone: "07700 900123",
  email: "priya@example.co.uk",
  make: "Ford",
  model: "Fiesta",
  status: "waiting",
  consent: { at: ago(3), wording: "yes" },
  createdAt: ago(3),
  askedAt: ago(3),
  matches: [],
  ...(over as Partial<WantedItem>),
});

describe("what a request says", () => {
  it("is the car they asked for, or their own words, or admits it has nothing", () => {
    expect(wantText({ make: "Ford", model: "Fiesta" })).toBe("Ford Fiesta");
    expect(wantText({ make: "Ford" })).toBe("Ford");
    expect(wantText({ note: "a small automatic" })).toBe("a small automatic");
    expect(wantText({})).toBe("A car (no details given)");
  });

  it("gives the budget only when there is one", () => {
    expect(budgetText(8000)).toBe("Up to £8,000");
    expect(budgetText(undefined)).toBeNull();
  });

  it("describes a car that fits, and says when it is over their budget", () => {
    expect(matchText({ vehicleId: "v1", label: "2019 Ford Fiesta", price: 8495 })).toBe("2019 Ford Fiesta, £8,495");
    expect(matchText({ vehicleId: "v1", label: "2019 Ford Fiesta", price: 8495, overBudgetBy: 995 })).toBe("2019 Ford Fiesta, £8,495 (£995 over their budget)");
    expect(matchText({ vehicleId: "v1", label: "Ford Ka", price: null })).toBe("Ford Ka, no price yet");
  });
});

describe("how long ago", () => {
  it("uses the words a person would", () => {
    expect(askedText(ago(0), now)).toBe("today");
    expect(askedText(ago(0.5), now)).toBe("today");
    expect(askedText(ago(1), now)).toBe("yesterday");
    expect(askedText(ago(5), now)).toBe("5 days ago");
    expect(askedText(ago(13), now)).toBe("13 days ago");
    expect(askedText(ago(14), now)).toBe("2 weeks ago");
    expect(askedText(ago(45), now)).toBe("6 weeks ago");
    expect(askedText(ago(60), now)).toBe("2 months ago");
    expect(askedText(ago(300), now)).toBe("10 months ago");
  });

  it("says nothing rather than something wrong for a date it can't read, and calls a future date today", () => {
    expect(askedText("", now)).toBe("");
    expect(askedText("later", now)).toBe("");
    expect(askedText(ago(-3), now)).toBe("today");
  });

  it("gives the day their details will be forgotten", () => {
    expect(keptUntil("2030-01-10T12:00:00.000Z", 365)).toBe("10 Jan 2031");
    expect(keptUntil("nonsense", 365)).toBe("");
  });
});

describe("the message that is ready to send", () => {
  it("says 'we've just got one' only when there really is a car that fits", () => {
    const withCar = messageFor(item(), "Sam's Motors", "2019 Ford Fiesta");
    expect(withCar).toBe("Hi Priya, it's Sam's Motors. We've just got a 2019 Ford Fiesta in, which is what you asked us to look out for. Would you like to come and see it?");
    const without = messageFor(item(), "Sam's Motors");
    expect(without).toBe("Hi Priya, it's Sam's Motors. About the Ford Fiesta you asked us to look out for.");
    expect(without).not.toMatch(/just got/);
  });

  it("copes with no first name, no dealer name and no car", () => {
    expect(messageFor({ name: "  " }, "")).toBe("Hello, About the car you asked us to look out for.");
  });
});

describe("reaching them", () => {
  it("offers call and text from a phone number, keeping only the dialable characters", () => {
    const l = contactLinks(item({ email: undefined, phone: "+44 (0)7700 900-123" }), "Sam's Motors");
    expect(l.call).toBe("tel:+4407700900123");
    expect(l.text?.startsWith("sms:+4407700900123?&body=")).toBe(true);
    expect(l.email).toBeUndefined();
  });

  it("offers email from an address, with the subject and message ready and properly encoded", () => {
    const l = contactLinks(item({ phone: undefined }), "Sam's Motors", "2019 Ford Fiesta");
    expect(l.call).toBeUndefined();
    expect(l.text).toBeUndefined();
    expect(l.email?.startsWith("mailto:priya@example.co.uk?subject=")).toBe(true);
    expect(l.email).toContain(encodeURIComponent("Sam's Motors: the car you asked about"));
    expect(l.email).toContain(`&body=${encodeURIComponent(messageFor(item(), "Sam's Motors", "2019 Ford Fiesta"))}`);
  });

  it("puts the message in the text too, encoded so nothing in it can break the link", () => {
    const l = contactLinks(item({ name: "Priya&cc=x?y#z" }), "Sam & Sons #1", "A&B");
    const body = l.text?.split("?&body=")[1] ?? "";
    expect(body).not.toMatch(/[&?#\s]/);
    expect(decodeURIComponent(body)).toContain("Priya&cc=x?y#z");
    expect(decodeURIComponent(body)).toContain("Sam & Sons #1");
  });

  it("won't build an email link from an address that could add a cc, a subject or a second recipient", () => {
    for (const email of [
      // in the part after the @
      "a@b.com?cc=evil@x.com", "a@b.com&bcc=evil@x.com", "a@b.com,evil@x.com", "a@b.com;evil@x.com", "a@b.com#x", "a@b.com%0Abcc:evil@x.com",
      // and in the part before it
      "a?cc=evil@b.com", "a&bcc=evil@b.com", "a=b@c.com", "a#x@b.com", "a%0Abcc:evil@b.com", "a,evil@x.com@b.com",
      "a b@c.com", "not-an-address", "",
    ]) {
      expect(contactLinks(item({ email }), "Sam").email, email).toBeUndefined();
    }
  });

  it("offers no call or text when the 'number' has nothing dialable in it", () => {
    const l = contactLinks(item({ phone: "n/a" }), "Sam");
    expect(l.call).toBeUndefined();
    expect(l.text).toBeUndefined();
  });
});

describe("splitting the list up", () => {
  const match = { vehicleId: "v1", label: "Ford Fiesta", price: 1 as number | null };
  const items = [
    item({ id: "a", matches: [match] }),
    item({ id: "b" }),
    item({ id: "c", status: "contacted", matches: [match] }),
    item({ id: "d", status: "closed", matches: [match] }),
    item({ id: "e", matches: [match] }),
  ];

  it("separates people waiting for a car you have from the rest, keeping the order given", () => {
    const g = groupWanted(items);
    expect(g.waitingWithCar.map(i => i.id)).toEqual(["a", "e"]);
    expect(g.waiting.map(i => i.id)).toEqual(["b"]);
    expect(g.contacted.map(i => i.id)).toEqual(["c"]);
    expect(g.closed.map(i => i.id)).toEqual(["d"]);
  });

  it("puts everyone in exactly one group", () => {
    const g = groupWanted(items);
    expect(g.waitingWithCar.length + g.waiting.length + g.contacted.length + g.closed.length).toBe(items.length);
  });

  it("counts, for one car, only people still waiting whose request fits that car", () => {
    expect(waitingForCar(items, "v1").map(i => i.id)).toEqual(["a", "e"]); // not contacted or closed ones
    expect(waitingForCar(items, "v2")).toEqual([]);
    expect(waitingForCar([], "v1")).toEqual([]);
  });

  it("puts the count in a sentence with the right grammar", () => {
    expect(waitingSentence(1)).toBe("1 person is waiting for a car like this.");
    expect(waitingSentence(3)).toBe("3 people are waiting for a car like this.");
  });
});
