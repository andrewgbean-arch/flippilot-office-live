// What a login made by the staff phone app (flippilot-dealer) may do.
//
// A phone is easier to lose than a desk computer, and the companion app only
// needs a small part of Dealer OS: clocking in and out, the diary, leave, the
// rota, pay, staff messages, the message board and vehicle photos. So a phone login (a token
// signed with scope "phone", see signToken) is limited to exactly the
// addresses the app uses. Leads, customers, the books, Pilot Brain, settings
// and everything else answer 403 to it. The person's own role rules still
// apply on top: this only ever takes access away, never adds it.
//
// When the phone app gains a screen that needs another address, add it here.

type Rule = { methods: "any" | readonly string[]; path: RegExp };

const READ = ["GET", "HEAD"] as const;

const PHONE_RULES: readonly Rule[] = [
  { methods: "any", path: /^\/auth(\/|$)/ },
  { methods: "any", path: /^\/staff-messages(\/|$)/ },
  { methods: "any", path: /^\/feedback(\/|$)/ },
  { methods: "any", path: /^\/message-photos(\/|$)/ },
  { methods: "any", path: /^\/diary(\/|$)/ },
  { methods: "any", path: /^\/leave(\/|$)/ },
  { methods: "any", path: /^\/timekeeping(\/|$)/ },
  { methods: "any", path: /^\/pay(\/|$)/ },
  { methods: "any", path: /^\/inventory\/[^/]+\/photos(\/[^/]+)?$/ },
  { methods: READ, path: /^\/inventory$/ },
  { methods: READ, path: /^\/team$/ },
  { methods: READ, path: /^\/dealership\/me$/ },
  { methods: READ, path: /^\/shifts$/ },
  { methods: READ, path: /^\/work-patterns$/ },
];

/** May a phone login make this request? `url` is the full request address (req.originalUrl). */
export function phoneMayUse(method: string, url: string): boolean {
  const path = (url.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const m = method.toUpperCase();
  return PHONE_RULES.some((r) => r.path.test(path) && (r.methods === "any" || r.methods.includes(m)));
}

/** The scope a login asks for: "phone" when the staff phone app says so, otherwise none (a full web login). */
export function scopeFromBody(body: unknown): "phone" | undefined {
  return (body as { client?: unknown } | null)?.client === "phone" ? "phone" : undefined;
}
