import { describe, it, expect } from "vitest";
import {
  INVITE_LINK_LIFETIME_DAYS,
  inviteShareLead,
  inviteShareMessage,
  inviteShareTitle,
} from "./teamCopy";

// The message the owner sends with an invite link. It is what the person
// receives, so it holds only what they need to recognise it: their name (if the
// owner typed one), the dealership's name, the link, how long the link works and
// what to do if they were not expecting it. Nothing else.

const LINK = "https://app.example.co.uk/join?token=eyJhbGciOi.abc-def_ghi";

describe("the invite message", () => {
  it("greets the person by name, names the dealership, holds the link, and says it works for 7 days", () => {
    expect(inviteShareMessage({ inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK })).toBe(
      `Hi Sarah, you've been invited to join Smith Motors on FlipPilot. Tap the link to set up your login. ` +
        `It works for 7 days, so only use it if you were expecting it. ${LINK}`
    );
  });

  it("still reads properly with no name", () => {
    expect(inviteShareMessage({ inviteeName: "", dealershipName: "Smith Motors", link: LINK })).toBe(
      `Hi, you've been invited to join Smith Motors on FlipPilot. Tap the link to set up your login. ` +
        `It works for 7 days, so only use it if you were expecting it. ${LINK}`
    );
    expect(inviteShareMessage({ inviteeName: "   ", dealershipName: "Smith Motors", link: LINK })).toContain(
      "Hi, you've been invited"
    );
  });

  it("says the link works for 7 days: the same figure the invite dialog quotes", () => {
    expect(INVITE_LINK_LIFETIME_DAYS).toBe(7);
    const text = inviteShareMessage({ inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK });
    expect(text).toContain(`works for ${INVITE_LINK_LIFETIME_DAYS} days`);
    expect(text).toContain("works for 7 days");
  });

  it("can quote another number of days, and says '1 day' for one", () => {
    expect(inviteShareLead({ inviteeName: "", dealershipName: "Smith Motors", days: 3 })).toContain("works for 3 days");
    expect(inviteShareLead({ inviteeName: "", dealershipName: "Smith Motors", days: 1 })).toContain("works for 1 day,");
  });

  it("tells them to use it only if they were expecting it", () => {
    expect(inviteShareMessage({ inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK })).toMatch(
      /only use it if you were expecting it/i
    );
  });

  it("holds nothing but the name, the dealership, the link and the fixed wording", () => {
    const text = inviteShareMessage({ inviteeName: "NAME", dealershipName: "DEALER", link: "LINK" });
    expect(text).toBe(
      "Hi NAME, you've been invited to join DEALER on FlipPilot. Tap the link to set up your login. " +
        "It works for 7 days, so only use it if you were expecting it. LINK"
    );
    // no role, no owner details, no way to add more: those are not even inputs
    expect(text).not.toMatch(/manager|sales|finance|general|owner|@|password/i);
  });

  it("puts the link at the very end, once", () => {
    const text = inviteShareMessage({ inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK });
    expect(text.endsWith(LINK)).toBe(true);
    expect(text.split(LINK)).toHaveLength(2);
  });

  it("is one tidy line however the names were typed", () => {
    const text = inviteShareMessage({ inviteeName: "  Sarah \n  Bell ", dealershipName: "Smith\tMotors\r\n", link: LINK });
    expect(text).toContain("Hi Sarah Bell, you've been invited to join Smith Motors on FlipPilot.");
    expect(text).not.toMatch(/[\r\n\t]/);
  });

  it("does not leave a hole when the dealership's name has not loaded", () => {
    const text = inviteShareMessage({ inviteeName: "Sarah", dealershipName: "  ", link: LINK });
    expect(text).toContain("invited to join the team on FlipPilot.");
    expect(text).not.toMatch(/join\s+on FlipPilot/);
  });
});

describe("the lead-in for the phone's share sheet", () => {
  it("is the same message without the link, because the share sheet adds the link itself", () => {
    const details = { inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK };
    const lead = inviteShareLead(details);
    expect(lead).not.toContain(LINK);
    expect(lead).not.toContain("http");
    expect(inviteShareMessage(details)).toBe(`${lead} ${LINK}`);
  });
});

describe("the share title", () => {
  it("names the dealership, or just FlipPilot when it has no name yet", () => {
    expect(inviteShareTitle("Smith Motors")).toBe("Invitation to join Smith Motors on FlipPilot");
    expect(inviteShareTitle("  ")).toBe("Invitation to join FlipPilot");
  });
});
