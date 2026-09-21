// The free trial: 14 days, counted from the moment a dealership can actually use
// the app. A new dealership starts "pending" and a person has to approve it
// (requireApprovedDealership), so counting from sign-up would let a slow review
// eat into the trial the dealer was promised. Sign-up sets a provisional end
// date, and approval restarts the count (routes/dealership.ts).
export const TRIAL_DAYS = 14;

const DAY_MS = 86_400_000;

export function trialEndsAtFrom(start: Date): string {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS).toISOString();
}
