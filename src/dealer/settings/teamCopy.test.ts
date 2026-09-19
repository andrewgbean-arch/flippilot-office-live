import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  INVITE_LINK_CANCEL_NOTE,
  INVITE_LINK_LIFETIME_DAYS,
  MANAGE_TEAM_INTRO,
  inviteLinkWarning,
  inviteShareIntro,
  lowerRolePrompt,
  removeTeammatePrompt,
  roleLoweredNotice,
} from "./teamCopy";

// Invite links and removals used to be described untruthfully: the removal
// prompt said the person "loses access straight away" and stopped there, and
// the invite dialog never said the link works for anyone who holds it. Both
// now say what the backend really does (see teamCopy.ts and the backend's
// inviteRevocation.test.ts, which pins the behaviour they describe).

describe("the removal prompt", () => {
  const text = removeTeammatePrompt("Sarah Bell");

  it("names the person being removed", () => {
    expect(text).toContain("Remove Sarah Bell?");
  });

  it("says they lose access at once", () => {
    expect(text).toMatch(/lose access at once/i);
  });

  it("says the invite links already shared stop working, and to create a new one for anyone expected", () => {
    expect(text).toMatch(/every invite link you've already shared stops working/i);
    expect(text).toMatch(/create a new link/i);
  });
});

describe("the invite dialog's link-ready wording", () => {
  it("says plainly that anyone who has the link can join, for 7 days, with the chosen role", () => {
    const text = inviteLinkWarning("Manager");
    expect(text).toMatch(/anyone who has this link can join/i);
    expect(text).toContain("7 days");
    expect(text).toContain("Manager role");
    expect(text).toMatch(/only send it to the person you mean/i);
  });

  it("uses the same number of days the link really lives for", () => {
    expect(INVITE_LINK_LIFETIME_DAYS).toBe(7);
  });

  it("greets the person by name, or as a coworker when no name was given", () => {
    expect(inviteShareIntro("Sarah")).toContain("Share this link with Sarah —");
    expect(inviteShareIntro("  Sarah  ")).toContain("Share this link with Sarah —");
    expect(inviteShareIntro("")).toContain("Share this link with a coworker —");
    expect(inviteShareIntro("   ")).toContain("Share this link with a coworker —");
  });

  it("no longer claims only that the link 'expires in 7 days' — that undersold who can use it", () => {
    expect(inviteShareIntro("Sarah")).not.toMatch(/expires/i);
  });

  it("reminds the owner that removing someone or moving them to a lower role cancels links already shared", () => {
    expect(INVITE_LINK_CANCEL_NOTE).toMatch(/remove someone/i);
    expect(INVITE_LINK_CANCEL_NOTE).toMatch(/lower role/i);
    expect(INVITE_LINK_CANCEL_NOTE).toMatch(/stop working/i);
  });
});

describe("the question before moving someone to a lower role", () => {
  const text = lowerRolePrompt("Sarah Bell", "Manager", "Sales");

  it("names the person and both roles", () => {
    expect(text).toContain("Move Sarah Bell from Manager to Sales?");
  });

  it("says it also cancels every invite link already shared, and that moving back won't restore them", () => {
    expect(text).toMatch(/also cancels every invite link you've already shared/i);
    expect(text).toMatch(/moving them back up won't bring those links back/i);
    expect(text).toMatch(/create a new link/i);
  });
});

describe("the notice after someone has been moved to a lower role", () => {
  const text = roleLoweredNotice("Sarah Bell", "Sales");

  it("says who is now what, and that the shared links no longer work", () => {
    expect(text).toContain("Sarah Bell is now Sales");
    expect(text).toMatch(/invite links you'd already shared no longer work/i);
    expect(text).toMatch(/create a new link/i);
  });

  it("is one line", () => {
    expect(text).not.toContain("\n");
  });
});

describe("the Manage Team heading", () => {
  it("still says changes take effect on the person's next click", () => {
    expect(MANAGE_TEAM_INTRO).toMatch(/very next click/i);
  });

  it("says removing someone, or moving them to a lower role, also cancels links already shared", () => {
    expect(MANAGE_TEAM_INTRO).toMatch(/removing someone/i);
    expect(MANAGE_TEAM_INTRO).toMatch(/lower role/i);
    expect(MANAGE_TEAM_INTRO).toMatch(/cancels every invite link you've already shared/i);
  });
});

// The screen has to actually use the wording above, not carry its own copy
// of the old sentences.
describe("Settings.tsx", () => {
  const source = readFileSync(new URL("./Settings.tsx", import.meta.url), "utf8");

  it("takes the team wording from teamCopy", () => {
    expect(source).toContain('from "./teamCopy"');
    expect(source).toContain("removeTeammatePrompt(");
    expect(source).toContain("lowerRolePrompt(");
    expect(source).toContain("roleLoweredNotice(");
    expect(source).toContain("inviteLinkWarning(");
    expect(source).toContain("inviteShareIntro(");
    expect(source).toContain("{MANAGE_TEAM_INTRO}");
    expect(source).toContain("{INVITE_LINK_CANCEL_NOTE}");
  });

  it("no longer carries the old, incomplete sentences", () => {
    expect(source).not.toContain("They'll lose access straight away");
    expect(source).not.toContain("It expires in 7 days");
  });
});
