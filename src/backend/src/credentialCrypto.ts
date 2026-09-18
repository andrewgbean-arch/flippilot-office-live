import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Real AES-256-GCM encryption for third-party credentials a dealer
// supplies themselves (their own SendGrid API key, eventually other
// "bring your own key" integrations). These are OTHER PEOPLE'S
// secrets, stored in our shared database, so they're encrypted at
// rest — unlike this app's own vendor keys (Anthropic/OpenAI/Stripe),
// which live only in backend/.env and are never written to the
// database at all.
//
// CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 real
// random bytes). Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Losing or changing this key makes every credential encrypted with
// the old one permanently undecryptable — back it up like any other
// production secret, and never rotate it casually.

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is missing or invalid — must be a 64-character hex string (32 bytes). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // standard GCM IV size
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv : authTag : ciphertext, each base64 — joined into one string so
  // it round-trips through the same JSON text column as everything else.
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, authTagB64, dataB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Stored credential is malformed");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  // GCM's auth tag check means a corrupted/tampered ciphertext throws
  // here rather than silently decrypting to garbage.
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

// For showing "a key is connected" in the UI without ever exposing
// the real value — same idea as Render's own "Show secret" masking.
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}
