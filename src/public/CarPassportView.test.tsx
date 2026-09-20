import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CarPassportView, { passportPageTitle } from "./CarPassportView";
import type { AvailablePassport, PublicPassport, SoldPassport } from "./passportTypes";

const dealer = { name: "Sam's Motors", phone: "01234 567890", address: "1 High Street, Leeds" };

const available = (over: Partial<AvailablePassport> = {}): AvailablePassport => ({
  sold: false,
  dealer,
  car: {
    id: "v1",
    year: 2019,
    make: "Ford",
    model: "Fiesta",
    mileage: 42000,
    colour: "Blue",
    reg: "AB12 CDE",
    fuelType: "PETROL",
    askingPrice: 8495,
    images: ["https://api.example.test/photos/a.jpg", "https://api.example.test/photos/b.jpg"],
  },
  workDone: [],
  generatedAt: "2030-03-15T12:00:00.000Z",
  ...over,
});

const full = (): AvailablePassport =>
  available({
    mot: {
      state: "valid",
      expiry: "2030-09-01",
      daysLeft: 120,
      tests: [
        { date: "2029-09-01", result: "pass", mileage: 40000, advisories: ["Front tyre close to the legal limit"], failures: [] },
        { date: "2028-09-01", result: "fail", mileage: 30000, advisories: [], failures: ["Brake disc worn"] },
        { date: "2027-09-01", result: "pass", mileage: 20000, advisories: [], failures: [] },
      ],
    },
    emissions: { fuelType: "PETROL", euroStatus: "Euro 6" },
    market: { averageAsking: 9000, lowest: 6000, highest: 12000, listings: 14, checkedOn: "2030-03-12", difference: -505, basis: "make and model" },
    workDone: ["New front brake pads and discs", "Full valet"],
    note: "One careful owner, full service history.",
  });

const html = (p: PublicPassport = full()) => renderToStaticMarkup(<CarPassportView passport={p} dealershipId="d1" />);

describe("the car page", () => {
  it("leads with the car, its asking price and that it's available now", () => {
    const h = html();
    for (const text of ["2019 Ford Fiesta", "£8,495", "Available now", "AB12 CDE", "42,000 miles", "Blue", "Petrol"]) {
      expect(h, text).toContain(text);
    }
  });

  it("shows the MOT headline and the ULEZ answer beside the price", () => {
    const h = html();
    expect(h).toContain("MOT until 1 Sept 2030");
    expect(h).toContain("ULEZ compliant");
    expect(h).toContain("Petrol, Euro 6");
  });

  it("lays out the MOT history newest first, with results, mileage, advisories and failures", () => {
    const h = html();
    expect(h).toContain("MOT history");
    expect(h.indexOf("1 Sept 2029")).toBeLessThan(h.indexOf("1 Sept 2028"));
    expect(h.indexOf("1 Sept 2028")).toBeLessThan(h.indexOf("1 Sept 2027"));
    for (const text of ["Pass", "Fail", "40,000 miles", "Front tyre close to the legal limit", "Brake disc worn"]) expect(h, text).toContain(text);
    expect(h).toContain("Mileage at each MOT");
  });

  it("points the buyer at GOV.UK to check the MOT themselves, opening safely in a new tab", () => {
    const h = html();
    expect(h).toContain('href="https://www.check-mot.service.gov.uk/"');
    expect(h).toContain('rel="noopener noreferrer"');
  });

  it("lists what the dealer has done, and their note", () => {
    const h = html();
    expect(h).toContain("What we&#x27;ve done to it");
    expect(h).toContain("New front brake pads and discs");
    expect(h).toContain("Full valet");
    expect(h).toContain("One careful owner, full service history.");
  });

  it("shows how the price compares, with what it's based on and what it isn't", () => {
    const h = html();
    expect(h).toContain("How the price compares");
    expect(h).toContain("£505 below the average asking price");
    expect(h).toContain("14 dealer listings");
    expect(h).toContain("asking prices, not what cars sold for");
  });

  it("offers to book this car and to call, in the summary and in the phone's bottom bar, and the number is in the footer too", () => {
    const h = html();
    expect(h.match(/href="\/book\/d1\?vehicle=v1"/g)).toHaveLength(2);
    expect(h.match(/href="tel:01234567890"/g)).toHaveLength(3); // summary, bottom bar, footer
    expect(h).toContain("Book a viewing");
  });

  it("keeps the phone's bottom bar to one line: 'Call', with the number on the summary button and in the footer", () => {
    const h = html();
    expect(h).toContain(">Call</a>"); // the bottom bar
    expect(h).toContain("Call 01234 567890"); // the summary button
    expect(h).toContain('aria-label="Call Sam&#x27;s Motors on 01234 567890"'); // so a screen reader still hears who and what number
  });

  it("has no call button when the dealer hasn't given a phone number", () => {
    const h = html(available({ dealer: { name: "Sam's Motors" } }));
    expect(h).not.toContain("tel:");
    expect(h).toContain("Book a viewing");
  });

  it("links back to the dealer's store", () => {
    expect(html()).toContain('href="/store/d1"');
  });
});

describe("leaving out what isn't there, never filling it in", () => {
  it("shows no MOT, emissions, market, history or note section for a car with none of them", () => {
    const h = html(available());
    for (const absent of ["MOT history", "How the price compares", "What we&#x27;ve done", "ULEZ", "GOV.UK", "Mileage at each MOT", "<blockquote"]) {
      expect(h, absent).not.toContain(absent);
    }
  });

  it("says 'price on request' rather than a price it doesn't have", () => {
    const h = html(available({ car: { ...available().car, askingPrice: null } }));
    expect(h).toContain("Price on request");
    expect(h).not.toContain("£");
  });

  it("doesn't draw the mileage chart from fewer than two readings", () => {
    const h = html(available({ mot: { state: "valid", expiry: "2030-09-01", daysLeft: 100, tests: [{ date: "2029-09-01", result: "pass", mileage: 40000, advisories: [], failures: [] }] } }));
    expect(h).toContain("MOT history");
    expect(h).not.toContain("Mileage at each MOT");
  });

  it("shows a MOT history even when no expiry date is on record, without stating one", () => {
    const h = html(available({ mot: { state: "unknown", tests: [{ date: "2029-09-01", result: "pass", advisories: [], failures: [] }] } }));
    expect(h).toContain("MOT history");
    expect(h).not.toContain("MOT until");
    expect(h).not.toContain("MOT expired");
  });

  it("says a MOT has expired, plainly, when it has", () => {
    expect(html(available({ mot: { state: "expired", expiry: "2029-09-01", tests: [] } }))).toContain("MOT expired 1 Sept 2029");
  });

  it("draws no price range when the range isn't known, but still says how the price compares", () => {
    const p = full();
    const { lowest: _l, highest: _h, ...market } = p.market!;
    const h = html({ ...p, market });
    expect(h).toContain("£505 below the average asking price");
    expect(h).not.toContain("Lowest £");
  });

  it("never mentions tax: the app doesn't keep tax status, and it goes stale daily", () => {
    expect(html().toLowerCase()).not.toMatch(/\btaxed\b|road tax|tax status/);
  });
});

describe("photos", () => {
  it("gives every photo a description a screen reader can use, and loads the first straight away", () => {
    const h = html();
    expect(h).toContain('alt="2019 Ford Fiesta, photo 1 of 2"');
    expect(h).toContain('alt="2019 Ford Fiesta, photo 2 of 2"');
    expect(h).toContain('loading="eager"');
    expect(h).toContain('loading="lazy"');
    expect(h).toContain("1 / 2");
  });

  it("has no photo counter or arrows for a single photo", () => {
    const h = html(available({ car: { ...available().car, images: ["https://api.example.test/photos/a.jpg"] } }));
    expect(h).not.toContain("1 / 1");
    expect(h).not.toContain("Next photo");
  });

  it("says photos are coming, rather than showing a broken picture, when there are none", () => {
    const h = html(available({ car: { ...available().car, images: [] } }));
    expect(h).toContain("Photos coming soon");
    expect(h).not.toContain("<img");
  });
});

describe("text from records is shown as text, never as markup", () => {
  it("escapes the dealer's note and lines, the make, and the DVSA's own advisories", () => {
    const evil = '<script>alert("x")</script><img src=x onerror=alert(1)>';
    const p = full();
    p.note = evil;
    p.workDone = [evil];
    p.car.make = evil;
    p.dealer = { ...dealer, name: evil, address: evil };
    p.mot!.tests[0]!.advisories = [evil];
    p.mot!.tests[0]!.failures = [evil];
    const h = html(p);
    expect(h).not.toContain("<script>");
    expect(h).not.toMatch(/<img src=x/);
    expect(h).toContain("&lt;script&gt;");
  });
});

describe("a sold car", () => {
  const sold: SoldPassport = { sold: true, dealer, car: { year: 2019, make: "Ford", model: "Fiesta" } };

  it("becomes a plain 'sold' page with a way to the rest of the stock, and nothing else", () => {
    const h = html(sold);
    expect(h).toContain("2019 Ford Fiesta");
    expect(h).toContain("This car has been sold");
    expect(h).toContain('href="/store/d1"');
    expect(h).toContain("See what Sam&#x27;s Motors has now");
    for (const absent of ["Book a viewing", "MOT", "£", "<img", "Available now"]) expect(h, absent).not.toContain(absent);
  });
});

describe("the browser tab title", () => {
  it("names the car and the dealer, and says when it's sold", () => {
    expect(passportPageTitle(full())).toBe("2019 Ford Fiesta | Sam's Motors");
    expect(passportPageTitle({ sold: true, dealer, car: { make: "Ford", model: "Fiesta" } })).toBe("Ford Fiesta (sold) | Sam's Motors");
  });
});
