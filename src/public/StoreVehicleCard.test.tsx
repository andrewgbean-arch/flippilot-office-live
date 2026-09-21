import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StoreVehicleCard from "./StoreVehicleCard";
import type { PublicVehicle } from "./publicBookingApi";

const PHOTO = "https://api.example.test/photos/a1b2c3d4-0000-4000-8000-000000000001.jpg";

// `over` may set an optional field to undefined (to say "this car has no plate").
const car = (over: Partial<Record<keyof PublicVehicle, unknown>> = {}): PublicVehicle => ({
  id: "v1",
  reg: "ab12 cde",
  make: "Ford",
  model: "Fiesta",
  year: 2019,
  mileage: 42310,
  colour: "Blue",
  priceRetail: 8495,
  ...(over as Partial<PublicVehicle>),
});
const html = (over: Partial<Record<keyof PublicVehicle, unknown>> = {}) => renderToStaticMarkup(<StoreVehicleCard v={car(over)} dealershipId="d1" />);

describe("a car on the public store page", () => {
  describe("its photo", () => {
    it("shows the car's picture, described for a screen reader and sized so the page doesn't jump", () => {
      const h = html({ photo: PHOTO });
      expect(h).toContain(`src="${PHOTO}"`);
      expect(h).toContain('alt="Photo of the 2019 Ford Fiesta"');
      expect(h).toContain('width="640"');
      expect(h).toContain('height="480"');
    });

    it("loads pictures as they scroll into view, without holding up the page", () => {
      const h = html({ photo: PHOTO });
      expect(h).toContain('loading="lazy"');
      expect(h).toContain('decoding="async"');
    });

    it("doesn't tell the picture's host which page asked for it", () => {
      expect(html({ photo: PHOTO })).toContain('referrerPolicy="no-referrer"');
    });

    it("has no picture, and no empty box or 'no photo' words, for a car without one", () => {
      const h = html();
      expect(h).not.toContain("<img");
      expect(h.toLowerCase()).not.toContain("no photo");
      expect(h.toLowerCase()).not.toContain("coming soon");
    });

    it("links the picture to the car's full history when the dealer has published it, and doesn't otherwise", () => {
      const withHistory = html({ photo: PHOTO, hasPassport: true });
      expect(withHistory).toMatch(/<a href="\/car\/d1\/v1"><img /);
      const without = html({ photo: PHOTO });
      expect(without).not.toMatch(/<a [^>]*><img /);
    });

    it("describes the photo without a year when the car has none", () => {
      expect(html({ photo: PHOTO, year: null })).toContain('alt="Photo of the Ford Fiesta"');
    });

    it("shows a make or model that is markup as text, in the picture's description too", () => {
      const evil = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
      const h = html({ photo: PHOTO, make: evil, model: evil });
      expect(h).not.toContain("<script>");
      expect(h).not.toMatch(/<img src=x/);
      expect(h).toContain("&lt;script&gt;");
    });
  });

  describe("everything else it already showed, unchanged", () => {
    it("names the car, and shows its plate in capitals, its year, mileage and colour", () => {
      const h = html();
      expect(h).toContain("Ford Fiesta");
      expect(h).toContain("AB12 CDE");
      expect(h).toContain("2019 · 42,310 miles · Blue");
    });

    it("shows the asking price, or says 'Price on request' rather than a price it doesn't have", () => {
      expect(html()).toContain("£8,495");
      const none = html({ priceRetail: null });
      expect(none).toContain("Price on request");
      expect(none).not.toContain("£");
      expect(html({ priceRetail: 0 })).toContain("Price on request");
    });

    it("leaves out a plate, or facts, the car doesn't have", () => {
      const h = html({ reg: undefined, year: null, mileage: null, colour: undefined });
      expect(h).not.toContain("font-mono");
      expect(h).not.toContain("miles");
    });

    it("offers to book a viewing of this car, and shows the full-history button only when there is one", () => {
      expect(html()).toContain('href="/book/d1?vehicle=v1"');
      expect(html()).not.toContain("See full history");
      const h = html({ hasPassport: true });
      expect(h).toContain("See full history");
      expect(h).toContain('href="/car/d1/v1"');
    });
  });
});
