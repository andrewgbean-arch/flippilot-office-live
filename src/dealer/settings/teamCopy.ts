// What the owner is told, in the invite dialog and in Manage Team, about how
// invite links and removals behave. Kept out of Settings.tsx so the wording
// can be tested — it has to stay TRUE to what the backend does:
//
//  - An invite link is not tied to an email address: anyone who has it can use
//    it, and use it more than once, until it expires 7 days after it was made
//    (signInviteToken in the backend), and they get the role chosen when it was
//    made.
//  - Removing a teammate, or moving one to a lower role, cancels every invite
//    link already shared (routes/team.ts). Links made afterwards work.

export const INVITE_LINK_LIFETIME_DAYS = 7;

export function removeTeammatePrompt(name: string): string {
  return (
    `Remove ${name}? They'll lose access at once, and every invite link you've already shared ` +
    `stops working. Create a new link for anyone you're expecting.`
  );
}

// Asked BEFORE moving someone to a lower role, in the same in-page
// confirmation the Remove button uses. A step down cancels every invite link
// already shared (the person could otherwise use a link carrying their old role
// to make a second account with it), and moving them back up does not bring the
// links back, so the owner has to know first.
export function lowerRolePrompt(name: string, fromLabel: string, toLabel: string): string {
  return (
    `Move ${name} from ${fromLabel} to ${toLabel}? This also cancels every invite link you've already shared, ` +
    `and moving them back up won't bring those links back. Create a new link for anyone you're expecting.`
  );
}

// One line shown after a step down has gone through.
export function roleLoweredNotice(name: string, toLabel: string): string {
  return (
    `${name} is now ${toLabel}. Invite links you'd already shared no longer work — ` +
    `create a new link for anyone you're expecting.`
  );
}

export const MANAGE_TEAM_INTRO =
  "Role changes and removals take effect on their very next click — no waiting for them to log in again. " +
  "Removing someone, or moving them to a lower role, also cancels every invite link you've already shared.";

// First line of the "your link is ready" step. `inviteeName` may be empty.
export function inviteShareIntro(inviteeName: string): string {
  const who = inviteeName.trim() ? inviteeName.trim() : "a coworker";
  return `Share this link with ${who} — they'll create their own login and land inside your dealership, not a separate one.`;
}

// The plain warning: the link isn't private to the person it's meant for.
export function inviteLinkWarning(roleLabel: string): string {
  return (
    `Anyone who has this link can join for the next ${INVITE_LINK_LIFETIME_DAYS} days, ` +
    `with the ${roleLabel} role you chose. Only send it to the person you mean it for.`
  );
}

export const INVITE_LINK_CANCEL_NOTE =
  "If you remove someone from your team, or move them to a lower role, links you've already shared stop working.";
