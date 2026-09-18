// Pure helpers for hosted photos — no database or Express in here, so the
// checks that stand between an upload and the public internet can be
// tested on their own.

export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";

export const MAX_PHOTO_BYTES = 1_500_000;
export const MAX_PHOTOS_PER_VEHICLE = 40;
export const MAX_PHOTOS_PER_DEALERSHIP = 2000;
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const EXTENSION: Record<PhotoMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function photoFileName(id: string, mime: string): string {
  const ext = EXTENSION[mime as PhotoMime] ?? "jpg";
  return `${id}.${ext}`;
}

// What the bytes ACTUALLY are, judged by their opening signature — never
// by what the upload claimed. Photos are served back to the public, so
// anything that isn't one of these three (an SVG or HTML page dressed up
// as an image, say) has to be refused here.
export function sniffImageMime(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // "RIFF" <4-byte size> "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const DATA_URL_MARKER = ";base64,";
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

// Turns "data:image/jpeg;base64,...." into bytes and checks them. The size
// test runs on the text length first so an absurd body is turned away
// before any decoding work is done.
export function decodeImageDataUrl(
  input: unknown
): { ok: true; bytes: Buffer; mime: PhotoMime } | { ok: false; status: number; error: string } {
  if (typeof input !== "string") {
    return { ok: false, status: 400, error: "dataUrl (a base64 image) is required" };
  }
  if (input.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 128) {
    return { ok: false, status: 413, error: tooBigMessage() };
  }
  const marker = input.indexOf(DATA_URL_MARKER);
  if (!input.startsWith("data:image/") || marker === -1 || marker > 40) {
    return { ok: false, status: 400, error: "That isn't a supported image (use a JPEG, PNG or WebP)" };
  }
  const body = input.slice(marker + DATA_URL_MARKER.length);
  if (!BASE64_BODY.test(body)) {
    return { ok: false, status: 400, error: "That isn't a supported image (use a JPEG, PNG or WebP)" };
  }
  const bytes = Buffer.from(body, "base64");
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: tooBigMessage() };
  }
  const mime = sniffImageMime(bytes);
  if (!mime) {
    return { ok: false, status: 400, error: "That isn't a supported image (use a JPEG, PNG or WebP)" };
  }
  return { ok: true, bytes, mime };
}

function tooBigMessage(): string {
  return `That photo is too large (the limit is ${(MAX_PHOTO_BYTES / 1_000_000).toFixed(1)} MB) — it should have been shrunk on the phone first`;
}

// The id inside one of OUR photo URLs (".../photos/<uuid>.jpg"), or null
// for anything else: a legacy base64 picture, someone else's URL, junk.
const PHOTO_URL_ID =
  /\/photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.(?:jpg|png|webp))?(?:[?#].*)?$/i;

export function photoIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 500) return null;
  const match = PHOTO_URL_ID.exec(url);
  return match ? (match[1] ?? "").toLowerCase() : null;
}

export function hostedPhotoUrl(origin: string, id: string, mime: string): string {
  return `${origin}/photos/${photoFileName(id, mime)}`;
}
