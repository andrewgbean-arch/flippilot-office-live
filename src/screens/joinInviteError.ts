// What the Join screen puts in big letters above a link that cannot be used.
//
// Every bad link used to be headlined "Invite Link Invalid", even one the owner
// had cancelled on purpose (they removed someone, or moved someone to a lower
// role, after making it). "Invalid" tells the person they did something wrong;
// "cancelled" tells them the truth and that the owner has to send a new one.
// The server's own message stays underneath either way (it says what to do
// next), so this only chooses the headline.
//
// The server's cancelled message is INVITE_CANCELLED_MESSAGE in
// src/backend/src/routes/auth.ts; joinInviteError.test.ts reads it from there,
// so this cannot drift from what the server really says.

export const INVITE_INVALID_HEADLINE = "Invite Link Invalid";
export const INVITE_CANCELLED_HEADLINE = "This invite link was cancelled";

export function inviteErrorHeadline(serverMessage: string): string {
  return /\bcancell?ed\b/i.test(serverMessage) ? INVITE_CANCELLED_HEADLINE : INVITE_INVALID_HEADLINE;
}
