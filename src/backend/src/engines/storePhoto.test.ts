import { describe, it, expect } from "vitest";
import { storePhoto } from "./storePhoto";

const HOSTED = "https://api.example.test/photos/a1b2c3d4-0000-4000-8000-000000000001.jpg";
const SECOND = "https://api.example.test/photos/a1b2c3d4-0000-4000-8000-000000000002.jpg";
const LOCAL = "http://localhost:4001/photos/a1b2c3d4-0000-4000-8000-000000000003.jpg";
const TINY_INLINE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("the picture on a car's card in the public store", () => {
  it("is the first photo the car has", () => {
    expect(storePhoto([HOSTED, SECOND])).toBe(HOSTED);
  });

  it("allows a photo this system hosts itself when running locally", () => {
    expect(storePhoto([LOCAL])).toBe(LOCAL);
  });

  it("skips a picture embedded in the record, because the store lists every car in one go", () => {
    expect(storePhoto([TINY_INLINE])).toBeUndefined();
    expect(storePhoto([TINY_INLINE, HOSTED])).toBe(HOSTED); // an embedded one first does not hide a normal one after it
  });

  it("never passes on an address that is not a plain picture on a secure address", () => {
    for (const bad of [
      "javascript:alert(1)",
      "file:///C:/secret.jpg",
      "http://insecure.example.test/a.jpg", // plain http, and not this system's own
      "ftp://example.test/a.jpg",
      "//example.test/a.jpg",
      "data:image/svg+xml;base64,PHN2Zz4=", // an SVG can carry script
      "data:text/html;base64,PHNjcmlwdD4=",
      "https://example.test/a b.jpg", // a space
      'https://example.test/a".jpg', // a quote that could break out of an attribute
      "https://example.test/<script>.jpg",
      "https://" + "a".repeat(600) + ".test/a.jpg", // absurdly long
      "",
      "   ",
    ]) {
      expect(storePhoto([bad]), bad).toBeUndefined();
    }
  });

  it("skips a bad address and still finds the good one after it", () => {
    expect(storePhoto(["javascript:alert(1)", "http://insecure.example.test/a.jpg", HOSTED])).toBe(HOSTED);
  });

  it("is nothing for a car with no photos, or junk where the photos should be", () => {
    for (const junk of [undefined, null, [], "", "a string", 42, {}, [null, 1, {}, ["x"]], { 0: HOSTED }]) {
      expect(storePhoto(junk), String(junk)).toBeUndefined();
    }
  });
});
