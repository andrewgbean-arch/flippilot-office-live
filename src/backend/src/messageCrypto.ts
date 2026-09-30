import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Real AES-256-GCM encryption for a private, 1:1 message between two
// members of staff (staffMessages.ts) -- a conversation nobody else in
// the dealership can see through the app, so it shouldn't be sitting in
// the shared database as plain text either. Its OWN key, never shared
// with credentialCrypto.ts's CREDENTIAL_ENCRYPTION_KEY (a leaked or
// rotated key for one should never affect the other).
//
// UNLIKE credentialCrypto.ts (an opt-in "bring your own key" feature a
// dealer may never touch, so refusing outright without a key is the
// right call), staff messaging is core, everyday functionality. So this
// module FAILS OPEN: with no MESSAGE_ENCRYPTION_KEY set, encryptMessage
// just returns the plain text unchanged -- exactly what already happens
// today -- rather than breaking every message send until the owner
// configures a key. The moment the key IS set, new messages start being
// encrypted with no code change needed.
//
// MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 real
// random bytes). Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Losing or changing this key makes every message encrypted with the old
// one permanently undecryptable — back it up like any other production
// secret, and never rotate it casually.
//
// Only new messages are encrypted from the day this ships; messages
// already stored in plain text before then are left as they are rather
// than risk an in-place migration corrupting real data for no real gain
// (there was no live customer relying on this yet). decryptMessage below
// passes through anything that isn't in the iv:authTag:data shape this
// module writes, so an old plain-text message still displays correctly.

function getKey(): Buffer | null {
  const hex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

// iv : authTag : ciphertext, each base64 — never confused for a plain
// message, which would need every one of these bytes to look exactly
// like this by coincidence.
const ENCRYPTED_SHAPE = /^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]*=*$/;

export function encryptMessage(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // not configured yet — stored as before
  const iv = randomBytes(12); // standard GCM IV size
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

// Passes a value through unchanged if it doesn't look like something
// this module encrypted — covers messages stored before encryption
// shipped (or while no key is configured at all), and is never wrongly
// triggered by a real message someone typed (see ENCRYPTED_SHAPE above).
export function decryptMessage(stored: string): string {
  if (!ENCRYPTED_SHAPE.test(stored)) return stored;
  const key = getKey();
  if (!key) return stored; // can't decrypt without the key that wrote it
  const [ivB64, authTagB64, dataB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || dataB64 === undefined) return stored;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // A corrupted row, or the key changed since it was written — fails
    // safe with a visible placeholder rather than a 500 that blocks the
    // whole inbox from loading.
    return "[This message can't be shown]";
  }
}
