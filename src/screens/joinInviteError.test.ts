import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INVITE_CANCELLED_HEADLINE, INVITE_INVALID_HEADLINE, inviteErrorHeadline } from "./joinInviteError";

// The Join screen headlined every bad link "Invite Link Invalid", including one
// the owner had cancelled on purpose. A cancelled link now says so; anything
// else keeps the old headline, and the server's message stays underneath.

const source = (relative: string) => readFileSync(join(__dirname, relative), "utf8");

describe("the headline over a link that cannot be used", () => {
  it("says the link was cancelled when the server says it was", () => {
    const serverMessage = "This invite link has been cancelled. Ask the dealership owner for a new link.";
    expect(inviteErrorHeadline(serverMessage)).toBe("This invite link was cancelled");
    expect(inviteErrorHeadline(serverMessage)).toBe(INVITE_CANCELLED_HEADLINE);
  });

  it("also recognises the other spelling, in any case", () => {
    expect(inviteErrorHeadline("This invite link has been canceled.")).toBe(INVITE_CANCELLED_HEADLINE);
    expect(inviteErrorHeadline("THIS LINK WAS CANCELLED")).toBe(INVITE_CANCELLED_HEADLINE);
  });

  it("keeps 'Invite Link Invalid' for every other problem", () => {
    for (const message of [
      "This invite link is invalid or has expired",
      "This invite link is missing a token.",
      "Couldn't reach the server — is the backend running?",
      "Name, email, password and an invite link are required",
      "",
    ]) {
      expect(inviteErrorHeadline(message)).toBe("Invite Link Invalid");
      expect(inviteErrorHeadline(message)).toBe(INVITE_INVALID_HEADLINE);
    }
  });

  it("does not take a word that only contains 'cancel' for a cancelled link", () => {
    expect(inviteErrorHeadline("Cancellation policy: this link is invalid")).toBe(INVITE_INVALID_HEADLINE);
  });

  it("recognises the message the server really sends (read from the backend, so the two cannot drift apart)", () => {
    const backend = source("../backend/src/routes/auth.ts");
    const cancelled = /INVITE_CANCELLED_MESSAGE =\s*"([^"]+)"/.exec(backend)?.[1];
    const invalid = /INVITE_INVALID_MESSAGE = "([^"]+)"/.exec(backend)?.[1];
    expect(cancelled).toBeTruthy();
    expect(invalid).toBeTruthy();
    expect(inviteErrorHeadline(cancelled ?? "")).toBe(INVITE_CANCELLED_HEADLINE);
    expect(inviteErrorHeadline(invalid ?? "")).toBe(INVITE_INVALID_HEADLINE);
  });
});

describe("JoinScreen.tsx", () => {
  const screen = source("./JoinScreen.tsx");

  it("takes its headline from the helper, with the server's message still shown underneath", () => {
    expect(screen).toContain('from "./joinInviteError"');
    expect(screen).toContain("{inviteErrorHeadline(inviteError)}");
    expect(screen).toContain("{inviteError}</p>");
  });

  it("no longer writes the one headline out for every bad link", () => {
    expect(screen).not.toContain(">Invite Link Invalid<");
  });
});
