// A cap on how many password-reset EMAILS one account can be sent per hour.
//
// The per-IP limiter on /auth/forgot-password (app.ts) stops one machine hammering
// the route, but says nothing about many machines all asking for the same person.
// Without a cap per email address, anyone could flood a dealer's inbox with reset
// mails (and run up the email bill) from a spread of addresses.
//
// Only accounts that really exist are counted. That keeps this table as small as
// the user list (nobody can grow it by asking about made-up addresses), and it
// costs nothing in secrecy: the reply to /auth/forgot-password is identical
// whether an email is known, unknown or over its cap. Only whether a mail is sent
// differs, and the person who owns the address is the only one who can see that.
//
// Kept in memory: a restart clears it, which just gives a fresh allowance. That
// is fine for a cap whose purpose is to stop floods, not to be a ledger.

export const RESET_EMAILS_PER_WINDOW = 3;
export const RESET_WINDOW_MS = 60 * 60 * 1000;

const sentAt = new Map<string, number[]>();

function recent(times: number[] | undefined, now: number): number[] {
  return (times ?? []).filter(t => now - t < RESET_WINDOW_MS);
}

// Asks for one reset email for this (already lower-cased) address. True means go
// ahead and send it, and the request is counted; false means the address has used
// its allowance for the hour.
export function takeResetEmailSlot(email: string, now: number = Date.now()): boolean {
  // Tidy up as we go so the table never holds anyone whose hour has passed.
  for (const [key, times] of sentAt) {
    if (recent(times, now).length === 0) sentAt.delete(key);
  }

  const times = recent(sentAt.get(email), now);
  if (times.length >= RESET_EMAILS_PER_WINDOW) {
    sentAt.set(email, times);
    return false;
  }
  times.push(now);
  sentAt.set(email, times);
  return true;
}

// For tests only: forget everything.
export function resetResetEmailLimitsForTests(): void {
  sentAt.clear();
}
