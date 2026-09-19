// The one place a mailto: link is built.
//
// A mailto: link is really a small web address: after the "?" come parts
// separated by "&" (subject=..., body=..., and also cc=... and bcc=... if a
// value lets them in). Every value that comes from a record (a customer's or a
// supplier's email address, a name, a vehicle) can hold characters that have a
// meaning there, so each one is percent-encoded. That way a stray "?", "&", "="
// or "%" is only ever a character in the address or the text, and can never
// start a new part such as an extra recipient.
//
// Build every mailto: link with this, never by hand: mailto.test.ts fails if a
// component writes one out itself.
export interface MailtoParts {
  subject?: string;
  body?: string;
}

export function mailtoHref(to: string, parts: MailtoParts = {}): string {
  // Everything is encoded except "@" and "+", which mean nothing inside a link
  // (so cannot start a new part) and which mail programs expect to see as they are.
  const address = encodeURIComponent(to.trim()).replace(/%40/g, "@").replace(/%2B/g, "+");
  const query: string[] = [];
  if (parts.subject !== undefined) query.push(`subject=${encodeURIComponent(parts.subject)}`);
  if (parts.body !== undefined) query.push(`body=${encodeURIComponent(parts.body)}`);
  return `mailto:${address}${query.length > 0 ? `?${query.join("&")}` : ""}`;
}
