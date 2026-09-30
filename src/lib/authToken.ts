import { recordUse } from "./idleSignOut";

const TOKEN_KEY = "flippilot_office_auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
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
  // Signing in is using Dealer OS: the automatic sign-out counts from now,
  // not from whenever this browser was last used by anyone.
  if (token) recordUse();
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
