import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { mailtoHref } from "./mailto";

// What a mail program does with a mailto: link: what comes before the "?" is the
// recipient, and what comes after is a list of name=value parts (subject, body,
// and also cc and bcc if a value lets one in).
function whatTheMailProgramSees(href: string) {
  const url = new URL(href);
  return {
    protocol: url.protocol,
    recipient: decodeURIComponent(url.pathname),
    parts: [...new URLSearchParams(url.search).entries()],
  };
}

describe("mailtoHref", () => {
  it("makes a plain link for a plain address, and keeps the @ readable", () => {
    expect(mailtoHref("jo@example.com")).toBe("mailto:jo@example.com");
    expect(mailtoHref("  jo+cars@example.co.uk  ")).toBe("mailto:jo+cars@example.co.uk");
  });

  it("adds the subject and body as the only two parts, and both come out exactly as written", () => {
    const subject = "Your MOT — AB12 CDE & more?";
    const body = "Hi Pat,\n\nWe'd like 10% off = a deal #1.\n\nThanks,";
    const seen = whatTheMailProgramSees(mailtoHref("jo@example.com", { subject, body }));
    expect(seen.protocol).toBe("mailto:");
    expect(seen.recipient).toBe("jo@example.com");
    expect(seen.parts).toEqual([
      ["subject", subject],
      ["body", body],
    ]);
  });

  it("leaves out a part that was not asked for", () => {
    expect(whatTheMailProgramSees(mailtoHref("jo@example.com", { subject: "Hi" })).parts).toEqual([["subject", "Hi"]]);
    expect(whatTheMailProgramSees(mailtoHref("jo@example.com", { body: "Hi" })).parts).toEqual([["body", "Hi"]]);
  });

  it("encodes an address holding ? & = # % or / so none of them can start a new part of the link", () => {
    const address = "a?b&c=d%e#f/g@x.co";
    const href = mailtoHref(address);
    // no part of the link at all: there is nothing after the address
    expect(href).not.toContain("?");
    expect(href).not.toContain("&");
    expect(href).not.toContain("=");
    expect(href).not.toContain("#");
    expect(href).toContain("@x.co");
    expect(whatTheMailProgramSees(href).recipient).toBe(address);
    expect(whatTheMailProgramSees(href).parts).toEqual([]);
  });

  it("cannot be made to add a cc or bcc, or swallow the real subject, by an address a stranger typed", () => {
    // What the open booking form once accepted as an "email address".
    const hostile = "x@evil.example?cc=victim%40other.example&bcc=another%40other.example&x=";
    const href = mailtoHref(hostile, { subject: "Your viewing — AB12 CDE", body: "Hi Pat" });
    const seen = whatTheMailProgramSees(href);
    expect(seen.recipient).toBe(hostile); // one (odd) recipient, exactly as typed, not a recipient plus extra parts
    expect(seen.parts.map(([name]) => name)).toEqual(["subject", "body"]);
    expect(seen.parts[0]).toEqual(["subject", "Your viewing — AB12 CDE"]);
    // exactly one "?" (the start of the parts) and one "&" (between them)
    expect(href.split("?")).toHaveLength(2);
    expect(href.split("&")).toHaveLength(2);
  });

  it("also keeps a %-escape in an address as the literal text it is (%0d%0a cannot turn into a line break)", () => {
    const address = "a@b.co%0d%0aBcc%3Dx";
    const href = mailtoHref(address, { subject: "s" });
    expect(href).not.toContain("%0d");
    expect(whatTheMailProgramSees(href).recipient).toBe(address);
  });
});

// Every mailto: link in the app has to come from mailtoHref. This reads the
// source of the web app and fails if a component writes one out by hand again
// (mailto: followed straight by ${...} or by +), which is how a stranger's email
// address once reached a link unencoded.
describe("nobody builds a mailto: link by hand", () => {
  const SRC = join(__dirname, "..");
  const HAND_BUILT = /mailto:\$\{|mailto:["'`]\s*\+/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "backend" ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it("finds only lib/mailto.ts building one", () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(100); // the scan really did read the app
    const offenders = files.filter(file => HAND_BUILT.test(readFileSync(file, "utf8"))).map(file => relative(SRC, file).replace(/\\/g, "/"));
    expect(offenders).toEqual(["lib/mailto.ts"]);
  });
});
