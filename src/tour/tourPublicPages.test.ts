import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPublicPage } from "./TourProvider";

describe("the tour on the pages a customer opens", () => {
  it("knows the public store, booking and car passport pages", () => {
    expect(isPublicPage("/store/abc")).toBe(true);
    expect(isPublicPage("/book/abc")).toBe(true);
    expect(isPublicPage("/car/abc/v1")).toBe(true);
  });

  it("does not mistake the dealer's own screens for them", () => {
    for (const p of ["/dealer-dashboard", "/bookkeeping", "/bookings", "/stores", "/car", "/inventory/store", "/"]) {
      expect(isPublicPage(p)).toBe(false);
    }
  });

  it("is not drawn over those pages", () => {
    const source = readFileSync(join(__dirname, "TourProvider.tsx"), "utf8");
    expect(source).toContain("{!isPublicPage(location.pathname) && <TourOverlay />}");
  });
});
