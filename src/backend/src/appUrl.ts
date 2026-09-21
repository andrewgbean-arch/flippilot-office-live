// The ONE place that decides which website address goes into a link the server
// hands out: password-reset emails, and the Stripe return pages.
//
// Those links must never be built from anything the caller sent. The Origin,
// Host and X-Forwarded-Host headers are chosen by whoever makes the request, so
// building an emailed link from them lets an attacker ask for a reset for a
// victim's email while claiming their own site as the Origin, and the REAL email
// (with a valid token) then points at the attacker's site.
//
// APP_URL (set on the server) is the address of the web app. It is only
// believed when it is an https address, or, outside production, http://localhost
// with a port (for a developer's own machine). Anything else, including a
// missing or mistyped value, falls back to the live web app. It is read at call
// time, not at load time: see the house rule at the top of auth.ts.

export const DEFAULT_APP_URL = "https://flippilot-office-live-frontend.onrender.com";

export function appUrl(): string {
  const raw = process.env.APP_URL;
  if (typeof raw !== "string" || raw.trim() === "") return DEFAULT_APP_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return DEFAULT_APP_URL;
  }

  // An address with a login in it (https://user:pass@host) is never a real
  // web-app address, and is a classic way to make a link read as one site while
  // going to another.
  if (parsed.username !== "" || parsed.password !== "") return DEFAULT_APP_URL;
  if (parsed.hostname === "") return DEFAULT_APP_URL;

  if (parsed.protocol === "https:") return parsed.origin;

  if (
    parsed.protocol === "http:" &&
    parsed.hostname === "localhost" &&
    parsed.port !== "" &&
    process.env.NODE_ENV !== "production"
  ) {
    return parsed.origin;
  }

  return DEFAULT_APP_URL;
}

// A full link to a page of the web app: appLink("/reset-password?token=...").
export function appLink(path: string): string {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
