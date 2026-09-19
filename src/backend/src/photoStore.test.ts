import { describe, it, expect } from "vitest";
import {
  decodeImageDataUrl,
  hostedPhotoUrl,
  isValidPhotoSignature,
  MAX_MESSAGE_PHOTOS,
  MAX_PHOTO_BYTES,
  MESSAGE_PHOTO_URL_TTL_SECONDS,
  parsePhotoIds,
  redactSignedLinks,
  photoFileName,
  photoIdFromUrl,
  signedMessagePhotoUrl,
  sniffImageMime,
} from "./photoStore";

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const bytesOf = (head: number[], totalLength = head.length + 20) => {
  const buf = Buffer.alloc(totalLength);
  Buffer.from(head).copy(buf);
  return buf;
};
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

const UUID = "3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21";

describe("sniffImageMime — what the bytes really are, not what the upload says", () => {
  it("recognises JPEG, PNG and WebP by their opening bytes", () => {
    expect(sniffImageMime(bytesOf(JPEG_HEAD))).toBe("image/jpeg");
    expect(sniffImageMime(bytesOf(PNG_HEAD))).toBe("image/png");
    expect(sniffImageMime(bytesOf(WEBP_HEAD))).toBe("image/webp");
  });

  it("refuses everything else — including things that are dangerous to serve back", () => {
    expect(sniffImageMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("GIF89a...."))).toBeNull();
    expect(sniffImageMime(Buffer.from("hello there"))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });

  it("refuses truncated headers rather than guessing", () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageMime(Buffer.from(PNG_HEAD.slice(0, 5)))).toBeNull();
    // "RIFF" alone is a WAV or AVI as often as a WebP
    expect(sniffImageMime(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("decodeImageDataUrl", () => {
  it("accepts a real-looking JPEG and PNG and reports the true type", () => {
    const jpeg = decodeImageDataUrl(dataUrl("image/jpeg", bytesOf(JPEG_HEAD)));
    expect(jpeg.ok && jpeg.mime).toBe("image/jpeg");
    const png = decodeImageDataUrl(dataUrl("image/png", bytesOf(PNG_HEAD)));
    expect(png.ok && png.mime).toBe("image/png");
  });

  it("goes by the bytes: a PNG labelled as JPEG is stored as the PNG it is", () => {
    const result = decodeImageDataUrl(dataUrl("image/jpeg", bytesOf(PNG_HEAD)));
    expect(result.ok && result.mime).toBe("image/png");
  });

  it("refuses non-images even when they claim to be images", () => {
    for (const declared of ["image/jpeg", "image/png", "image/svg+xml"]) {
      const result = decodeImageDataUrl(dataUrl(declared, Buffer.from("<svg><script>alert(1)</script></svg>")));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    }
  });

  it("refuses anything that isn't an image data URL", () => {
    for (const bad of [
      undefined,
      null,
      42,
      {},
      "",
      "hello",
      "https://example.com/a.jpg",
      "data:text/html;base64,PGgxPg==",
      "data:image/jpeg,not-base64-at-all",
      "data:image/jpeg;base64,***not base64***",
      "data:image/jpeg;base64,",
    ]) {
      const result = decodeImageDataUrl(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    }
  });

  it("allows a photo of exactly the limit and refuses one byte more", () => {
    const atLimit = decodeImageDataUrl(dataUrl("image/jpeg", bytesOf(JPEG_HEAD, MAX_PHOTO_BYTES)));
    expect(atLimit.ok).toBe(true);

    const over = decodeImageDataUrl(dataUrl("image/jpeg", bytesOf(JPEG_HEAD, MAX_PHOTO_BYTES + 1)));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(413);
  });

  it("turns away an absurdly large body before decoding any of it", () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(5_000_000)}`;
    const result = decodeImageDataUrl(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });
});

describe("photoIdFromUrl — recognising our own photo URLs", () => {
  it("finds the id in a full URL, with or without an extension or query", () => {
    expect(photoIdFromUrl(`https://api.example.com/photos/${UUID}.jpg`)).toBe(UUID);
    expect(photoIdFromUrl(`http://localhost:4001/photos/${UUID}.png`)).toBe(UUID);
    expect(photoIdFromUrl(`https://x.test/photos/${UUID}.webp?v=2`)).toBe(UUID);
    expect(photoIdFromUrl(`/photos/${UUID}`)).toBe(UUID);
  });

  it("normalises case so the same photo is always recognised", () => {
    expect(photoIdFromUrl(`https://x.test/photos/${UUID.toUpperCase()}.jpg`)).toBe(UUID);
  });

  it("returns null for anything that isn't one of ours", () => {
    expect(photoIdFromUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBeNull();
    expect(photoIdFromUrl("https://cdn.example.com/cars/fiesta.jpg")).toBeNull();
    expect(photoIdFromUrl("https://x.test/photos/not-a-uuid.jpg")).toBeNull();
    expect(photoIdFromUrl(`https://x.test/photos/${UUID}.exe`)).toBeNull();
    expect(photoIdFromUrl(`https://x.test/photos/${UUID}/extra`)).toBeNull();
    expect(photoIdFromUrl(null)).toBeNull();
    expect(photoIdFromUrl(123)).toBeNull();
    expect(photoIdFromUrl("x".repeat(600))).toBeNull();
  });

  it("round-trips with hostedPhotoUrl", () => {
    const url = hostedPhotoUrl("https://api.example.com", UUID, "image/png");
    expect(url).toBe(`https://api.example.com/photos/${UUID}.png`);
    expect(photoIdFromUrl(url)).toBe(UUID);
  });
});

describe("photoFileName", () => {
  it("uses the real type's extension, defaulting to jpg", () => {
    expect(photoFileName(UUID, "image/jpeg")).toBe(`${UUID}.jpg`);
    expect(photoFileName(UUID, "image/png")).toBe(`${UUID}.png`);
    expect(photoFileName(UUID, "image/webp")).toBe(`${UUID}.webp`);
    expect(photoFileName(UUID, "application/x-whatever")).toBe(`${UUID}.jpg`);
  });
});

describe("signed links for private message photos", () => {
  const SECRET = "test-secret-not-real";
  const NOW = 1_800_000_000_000; // a fixed "now" in ms
  const query = (url: string) => {
    const u = new URL(url);
    return { exp: u.searchParams.get("exp"), sig: u.searchParams.get("sig") };
  };
  const link = (id = UUID, secret = SECRET, now = NOW) => signedMessagePhotoUrl("https://api.example.com", id, secret, now);

  it("builds a link that lives a day (rounded up to a whole hour) — stated in plain numbers, not the constant under test", () => {
    // NOW is exactly on an hour, so step off it to get a realistic issue time.
    const issuedAt = NOW + 1_234_000;
    const url = link(UUID, SECRET, issuedAt);
    expect(url).toMatch(new RegExp(String.raw`^https://api\.example\.com/photos/${UUID}\.jpg\?exp=\d+&sig=[0-9a-f]{64}$`));
    const { exp, sig } = query(url);
    expect(Number(exp) % 3600).toBe(0);
    const lifeSeconds = Number(exp) - Math.floor(issuedAt / 1000);
    expect(lifeSeconds).toBeGreaterThanOrEqual(86_400); // at least a day
    expect(lifeSeconds).toBeLessThan(90_000); // and under a day and an hour

    // still good 23 hours later, dead 25 hours later
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, issuedAt + 23 * 3_600_000)).toBe(true);
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, issuedAt + 25 * 3_600_000 + 1_000)).toBe(false);
    // the day the product promises is really the day it is
    expect(MESSAGE_PHOTO_URL_TTL_SECONDS).toBe(86_400);
  });

  it("gives the SAME link to a list fetched twice within the hour, so a phone can reuse its cached copy", () => {
    const hourStart = Math.floor(NOW / 3_600_000) * 3_600_000;
    expect(link(UUID, SECRET, hourStart + 1_000)).toBe(link(UUID, SECRET, hourStart + 3_599_000));
    // ...and a new one once the next hour has begun (the boundary second itself still belongs to the old hour)
    expect(link(UUID, SECRET, hourStart + 3_600_000)).toBe(link(UUID, SECRET, hourStart + 1_000));
    expect(link(UUID, SECRET, hourStart + 3_601_000)).not.toBe(link(UUID, SECRET, hourStart + 1_000));
  });

  it("accepts its own link, right up until it expires", () => {
    const { exp, sig } = query(link());
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, NOW)).toBe(true);
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, Number(exp) * 1000 - 1)).toBe(true);
    // the instant it expires, and after, it's dead
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, Number(exp) * 1000)).toBe(false);
    expect(isValidPhotoSignature(SECRET, UUID, exp, sig, NOW + 2 * 86_400_000)).toBe(false);
  });

  it("rejects a link that has been tampered with", () => {
    const { exp, sig } = query(link());
    const otherId = "9d1c4f0a-2b7e-4c3d-a1f5-6e8b0c2d4f71";
    expect(isValidPhotoSignature(SECRET, otherId, exp, sig, NOW)).toBe(false); // someone else's photo
    expect(isValidPhotoSignature(SECRET, UUID, String(Number(exp) + 86_400), sig, NOW)).toBe(false); // extended expiry
    const flipped = sig!.slice(0, -1) + (sig!.endsWith("0") ? "1" : "0");
    expect(isValidPhotoSignature(SECRET, UUID, exp, flipped, NOW)).toBe(false);
    expect(isValidPhotoSignature("a-different-secret", UUID, exp, sig, NOW)).toBe(false);
  });

  it("rejects malformed or missing parameters without computing anything", () => {
    const { exp, sig } = query(link());
    for (const [e, s] of [
      [undefined, sig],
      [exp, undefined],
      [null, null],
      [["1", "2"], sig],
      [exp, [sig]],
      ["abc", sig],
      ["-5", sig],
      ["99999999999999999", sig],
      [exp, "zz".repeat(32)],
      [exp, sig!.slice(0, 60)],
      [exp, sig + "00"],
      ["", ""],
    ] as [unknown, unknown][]) {
      expect(isValidPhotoSignature(SECRET, UUID, e, s, NOW)).toBe(false);
    }
  });

  it("a link for one photo is different from a link for another", () => {
    expect(query(link(UUID)).sig).not.toBe(query(link("9d1c4f0a-2b7e-4c3d-a1f5-6e8b0c2d4f71")).sig);
  });
});

describe("parsePhotoIds", () => {
  const A = "3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21";
  const B = "9d1c4f0a-2b7e-4c3d-a1f5-6e8b0c2d4f71";

  it("treats nothing as no photos", () => {
    expect(parsePhotoIds(undefined)).toEqual({ ok: true, ids: [] });
    expect(parsePhotoIds(null)).toEqual({ ok: true, ids: [] });
    expect(parsePhotoIds([])).toEqual({ ok: true, ids: [] });
  });

  it("accepts real ids, lower-cased and de-duplicated", () => {
    expect(parsePhotoIds([A, B, A.toUpperCase()])).toEqual({ ok: true, ids: [A, B] });
  });

  it("refuses anything that isn't a list of photo ids", () => {
    for (const bad of ["x", 5, {}, [1], [null], ["not-a-uuid"], [A, "../etc/passwd"], [{ id: A }]]) {
      const result = parsePhotoIds(bad);
      expect(result.ok).toBe(false);
    }
  });

  it("caps how many photos one message can carry", () => {
    const ids = Array.from({ length: MAX_MESSAGE_PHOTOS + 1 }, (_, i) => `3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e${String(i).padStart(2, "0")}`);
    const result = parsePhotoIds(ids);
    expect(result.ok).toBe(false);
    expect(parsePhotoIds(ids.slice(0, MAX_MESSAGE_PHOTOS)).ok).toBe(true);
  });
});

describe("redactSignedLinks — keeping private photo links out of the access log", () => {
  const SIG = "213e803723ce564de7f4b85ca7ff624e7440455c33fb481951cce09b8acca7cd";

  it("hides the signature but keeps the rest of the address readable", () => {
    const line = redactSignedLinks(`/photos/${UUID}.jpg?exp=1789880400&sig=${SIG}`);
    expect(line).toBe(`/photos/${UUID}.jpg?exp=1789880400&sig=[redacted]`);
    expect(line).not.toContain(SIG);
  });

  it("finds it wherever it sits in the query, in any letter case", () => {
    expect(redactSignedLinks(`/photos/x.jpg?sig=${SIG.toUpperCase()}&exp=5`)).toBe("/photos/x.jpg?sig=[redacted]&exp=5");
    expect(redactSignedLinks(`/a?b=1&sig=${SIG}&c=2`)).toBe("/a?b=1&sig=[redacted]&c=2");
  });

  it("leaves ordinary addresses exactly as they were", () => {
    for (const url of ["/inventory?limit=5", "/staff-messages", "/photos/x.jpg", "/x?signature=abc", "/x?sig=short", ""]) {
      expect(redactSignedLinks(url)).toBe(url);
    }
  });
});
