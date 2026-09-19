// The one rule for a link that came from somewhere we don't control: text
// written by Pilot Brain (which can be shaped by web pages and by names typed
// into the public booking form) and the page addresses in the web search log.
//
// Only real web links (http / https) are ever allowed — plus mailto: where a
// link is meant to open a new email. Everything else (javascript:, data:,
// file:, relative paths, protocol-relative "//host/x", garbage) comes back as
// null, and the caller shows plain text instead of a link.
//
// The address is run through the browser's own URL parser and the PARSED form
// is what's returned, so a trick the parser sees through (stray tabs or
// newlines inside "java\nscript:", leading spaces, upper-case schemes) can't
// slip past a naive text check.
export function safeUrl(raw: unknown, options: { allowMailto?: boolean } = {}): string | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  if (options.allowMailto === true && url.protocol === "mailto:") return url.href;
  return null;
}
