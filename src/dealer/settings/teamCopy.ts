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

// ---------------------------------------------------------------------------
// The message the owner sends WITH the link (by the phone's share sheet, text
// message, WhatsApp or email). It is what the person receives, so it uses only
// what they need to recognise it and trust it: their own name (if the owner
// typed one), the dealership's name, the link, how long the link works, and
// what to do if they were not expecting it. Nothing else goes in: not the role,
// not the owner's name or email, nothing about the dealership's business.
// ---------------------------------------------------------------------------

export interface InviteShareDetails {
  // The invitee's name as the owner typed it. May be empty.
  inviteeName: string;
  dealershipName: string;
  link: string;
  // How long the link works. Defaults to the same figure the dialog quotes.
  days?: number;
}

// Names are typed by the owner: a stray line break or run of spaces must not
// reshape the message, so each becomes one tidy line of text.
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// The message WITHOUT the link. The phone's share sheet takes the link
// separately and adds it after this text itself, so putting the link here as
// well would send it twice.
export function inviteShareLead({
  inviteeName,
  dealershipName,
  days = INVITE_LINK_LIFETIME_DAYS,
}: Omit<InviteShareDetails, "link">): string {
  const name = oneLine(inviteeName);
  const greeting = name ? `Hi ${name},` : "Hi,";
  const where = oneLine(dealershipName) || "the team";
  return (
    `${greeting} you've been invited to join ${where} on FlipPilot. Tap the link to set up your login. ` +
    `It works for ${days} ${days === 1 ? "day" : "days"}, so only use it if you were expecting it.`
  );
}

// The whole message, link included, for the ways of sending that have no
// separate place for a link (text message, WhatsApp, email).
export function inviteShareMessage(details: InviteShareDetails): string {
  return `${inviteShareLead(details)} ${details.link}`;
}

// The share sheet's title, and the subject line when it is sent by email.
export function inviteShareTitle(dealershipName: string): string {
  const where = oneLine(dealershipName);
  return where ? `Invitation to join ${where} on FlipPilot` : "Invitation to join FlipPilot";
}
