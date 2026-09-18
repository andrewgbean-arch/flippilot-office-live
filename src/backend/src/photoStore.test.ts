import { describe, it, expect } from "vitest";
import {
  decodeImageDataUrl,
  hostedPhotoUrl,
  MAX_PHOTO_BYTES,
  photoFileName,
  photoIdFromUrl,
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
