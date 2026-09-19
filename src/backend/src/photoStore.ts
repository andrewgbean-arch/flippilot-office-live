// Pure helpers for hosted photos — no database or Express in here, so the
// checks that stand between an upload and the public internet can be
// tested on their own.

import { createHmac, timingSafeEqual } from "crypto";

export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";

export const MAX_PHOTO_BYTES = 1_500_000;
export const MAX_PHOTOS_PER_VEHICLE = 40;
export const MAX_PHOTOS_PER_DEALERSHIP = 2000;
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

// Photos attached to messages. Unlike listing photos these are PRIVATE:
// nobody gets one without a signed, expiring link that is only ever put
// into a message payload the requester is allowed to read.
export const MAX_MESSAGE_PHOTOS = 6;
export const MAX_UNATTACHED_PER_USER = 20;
export const MESSAGE_PHOTO_URL_TTL_SECONDS = 24 * 60 * 60;
// An unsent photo can be attached to a message for this long, and is swept
// after it. It also bounds how long the uploader is recorded against it.
export const UNATTACHED_GRACE_MS = 24 * 60 * 60 * 1000;
// A person at their unsent-photo limit has their OWN unsent photos older
// than this cleared to make room: they were abandoned drafts.
export const UNSENT_ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

// Disk bounds per dealership, in BYTES (a count says little about disk, and
// a lifetime count would switch the feature off for a busy dealership).
export const MAX_MESSAGE_PHOTO_BYTES_PER_DEALERSHIP = 1_500_000_000;
export const MAX_VEHICLE_PHOTO_BYTES_PER_DEALERSHIP = 1_500_000_000;

// A private photo's link carries its signature in the query string, so the
// access log must never record it: whoever can read the log could otherwise
// open every photo fetched in the last day.
export function redactSignedLinks(url: string): string {
  return url.replace(/([?&]sig=)[0-9a-f]{16,}/gi, "$1[redacted]");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// The signature covers the photo id AND its expiry, with a label of its
// own, so it can't be reused for a different photo, extended, or mistaken
// for anything else the same secret signs (login tokens).
function photoSignature(secret: string, id: string, exp: number): string {
  return createHmac("sha256", secret).update(`message-photo:v1:${id}:${exp}`).digest("hex");
}

export function signedMessagePhotoUrl(origin: string, id: string, secret: string, nowMs: number = Date.now()): string {
  // Expiry is rounded UP to a whole hour (so a link lives 24-25 hours). Every
  // message list fetched within the same hour then carries the same address
  // for a photo, and a phone or browser can reuse the copy it already
  // downloaded instead of fetching every photo again each time.
  const exp = Math.ceil((Math.floor(nowMs / 1000) + MESSAGE_PHOTO_URL_TTL_SECONDS) / 3600) * 3600;
  return `${origin}/photos/${id}.jpg?exp=${exp}&sig=${photoSignature(secret, id, exp)}`;
}

// `exp` and `sig` come straight off the query string, so they're checked
// for shape before anything is computed.
export function isValidPhotoSignature(
  secret: string,
  id: string,
  expRaw: unknown,
  sigRaw: unknown,
  nowMs: number = Date.now()
): boolean {
  if (typeof expRaw !== "string" || typeof sigRaw !== "string") return false;
  if (!/^\d{1,12}$/.test(expRaw) || !/^[0-9a-f]{64}$/.test(sigRaw)) return false;
  const exp = Number(expRaw);
  if (exp * 1000 <= nowMs) return false;
  const expected = Buffer.from(photoSignature(secret, id, exp), "hex");
  const given = Buffer.from(sigRaw, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The `photoIds` a client sends with a message: a short list of photo ids,
// each at most once.
export function parsePhotoIds(input: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, ids: [] };
  if (!Array.isArray(input) || input.some(item => typeof item !== "string" || !UUID.test(item.toLowerCase()))) {
    return { ok: false, error: "photoIds must be a list of photo ids" };
  }
  const ids = [...new Set(input.map(item => (item as string).toLowerCase()))];
  if (ids.length > MAX_MESSAGE_PHOTOS) {
    return { ok: false, error: `A message can have up to ${MAX_MESSAGE_PHOTOS} photos` };
  }
  return { ok: true, ids };
}

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
