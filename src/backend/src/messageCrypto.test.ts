import { describe, it, expect, afterEach } from "vitest";
import { encryptMessage, decryptMessage } from "./messageCrypto";

const KEY = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"; // 64 hex chars
const OTHER_KEY = "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3";

const saved = process.env.MESSAGE_ENCRYPTION_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.MESSAGE_ENCRYPTION_KEY;
  else process.env.MESSAGE_ENCRYPTION_KEY = saved;
});

describe("messageCrypto — a private staff message shouldn't sit in the database as plain text", () => {
  it("round-trips real message text, including punctuation, emoji and multiple lines", () => {
    process.env.MESSAGE_ENCRYPTION_KEY = KEY;
    for (const text of ["Can you check the Fiesta's MOT?", "Yep 👍 on it", "Line one\nLine two\nLine three", ""]) {
      const stored = encryptMessage(text);
      expect(decryptMessage(stored)).toBe(text);
    }
  });

  it("never stores the plain text — the ciphertext contains none of it", () => {
    process.env.MESSAGE_ENCRYPTION_KEY = KEY;
    const secret = "the customer offered £3200 cash, don't tell finance";
    const stored = encryptMessage(secret);
    expect(stored).not.toContain(secret);
    expect(stored).not.toContain("3200");
  });

  it("two messages with identical text produce different ciphertext (a fresh IV every time)", () => {
    process.env.MESSAGE_ENCRYPTION_KEY = KEY;
    const a = encryptMessage("same text");
    const b = encryptMessage("same text");
    expect(a).not.toBe(b);
    expect(decryptMessage(a)).toBe("same text");
    expect(decryptMessage(b)).toBe("same text");
  });

  it("fails open when no key is configured: stores and returns plain text unchanged, exactly like before this shipped", () => {
    delete process.env.MESSAGE_ENCRYPTION_KEY;
    const text = "hello, no key set yet";
    const stored = encryptMessage(text);
    expect(stored).toBe(text);
    expect(decryptMessage(stored)).toBe(text);
  });

  it("passes an already-stored plain-text message straight through — never mistaken for ciphertext", () => {
    process.env.MESSAGE_ENCRYPTION_KEY = KEY;
    for (const legacy of ["Meet at the yard at 9", "Reg: AB12 CDE, £4500", "a:b:c looks like our format but isn't"]) {
      expect(decryptMessage(legacy)).toBe(legacy);
    }
  });

  it("fails safe on a genuinely corrupted or wrong-key row, with a visible placeholder rather than throwing", () => {
    process.env.MESSAGE_ENCRYPTION_KEY = KEY;
    const stored = encryptMessage("a real message");
    process.env.MESSAGE_ENCRYPTION_KEY = OTHER_KEY; // simulates a key rotation without re-encrypting old rows
    expect(decryptMessage(stored)).toBe("[This message can't be shown]");
  });
});
