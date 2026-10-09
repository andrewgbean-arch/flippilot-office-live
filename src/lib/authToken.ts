import { recordUse } from "./idleSignOut";

const TOKEN_KEY = "flippilot_office_auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// The dealership this tab was loaded under. The login itself lives in
// localStorage, which every tab shares, so signing in to another dealership in a
// second tab swaps the login under the first one. The tab remembers its own
// dealership here (in memory, so it is per tab) and says it on every request;
// the server refuses a request whose login is a different dealership's.
let tabDealershipId: string | null = null;

/** The dealership a login belongs to, read from the login itself; null if it can't be read. */
export function dealershipOfToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const id = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).dealershipId;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (private browsing etc.) — auth just
    // won't persist across reloads, not worth crashing over.
  }
  tabDealershipId = token ? dealershipOfToken(token) : null;
  // Signing in is using Dealer OS: the automatic sign-out counts from now,
  // not from whenever this browser was last used by anyone.
  if (token) recordUse();
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  if (tabDealershipId === null) tabDealershipId = dealershipOfToken(token);
  return tabDealershipId
    ? { Authorization: `Bearer ${token}`, "X-Dealership-Id": tabDealershipId }
    : { Authorization: `Bearer ${token}` };
}

/** True when another tab has since signed in to a different dealership than this tab was loaded under. */
export function loginIsForAnotherDealership(): boolean {
  const token = getAuthToken();
  const current = token ? dealershipOfToken(token) : null;
  return tabDealershipId !== null && current !== null && current !== tabDealershipId;
}
