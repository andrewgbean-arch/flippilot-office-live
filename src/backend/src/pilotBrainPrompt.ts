// How Pilot Brain's instructions are sent to the model, in pieces the API
// can cache.
//
// Anthropic's prompt caching is a prefix match: the request's tools, system
// prompt and messages are rendered in that order, and everything up to a
// cache marker is keyed on its exact bytes. A marked stretch that a later
// request sends again, byte for byte, is read from the cache at about a
// tenth of the price of sending it fresh (a write costs a little more than a
// plain send: 1.25x for a 5-minute entry, 2x for an hour). So the
// instructions are built as blocks that change at different speeds, the most
// stable first:
//   1. the shared instructions: identical for every dealership and every
//      person, so one dealer's chat warms it for the next; kept an hour;
//   2. the dealership's own evidence (snapshot, alerts, market, goals, notes):
//      the same across the turns of one conversation and across the chat and
//      the morning briefing; kept 5 minutes (a read resets the timer);
//   3. whatever one call adds (web access, the tools' instructions, the
//      security reminder): short and never marked.
// An hour entry has to come before any 5-minute entry, and a prefix shorter
// than the model's minimum is simply not cached (no error), so the markers
// are safe whatever the sizes turn out to be. Whether they are paying off is
// visible in the server log: logUsage prints cache_read for every call.

export type CacheLife = "5m" | "1h";

export interface SystemBlock {
  text: string;
  // Set on the last block of a stretch that other calls will send again.
  cache?: CacheLife;
}

// A plain string is sent exactly as before, uncached: for one-off prompts
// that nothing else shares (decision analysis, the operator's drafts).
export type SystemPrompt = string | SystemBlock[];

export interface ApiSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral"; ttl?: "1h" };
}

// The `system` field of the request body.
export function systemParam(system: SystemPrompt): string | ApiSystemBlock[] {
  if (typeof system === "string") return system;
  return system.map(b => {
    const block: ApiSystemBlock = { type: "text", text: b.text };
    if (b.cache === "5m") block.cache_control = { type: "ephemeral" };
    if (b.cache === "1h") block.cache_control = { type: "ephemeral", ttl: "1h" };
    return block;
  });
}

// Adds one call's own sections after the cached blocks, never inside them.
export function appendToSystem(system: SystemPrompt, tail: string): SystemPrompt {
  if (typeof system === "string") return `${system}\n${tail}`;
  return [...system, { text: tail }];
}

// The whole prompt as one string, the way the model reads it (blocks follow
// one another). For tests and logs.
export function systemText(system: unknown): string {
  if (typeof system === "string") return system;
  if (!Array.isArray(system)) return "";
  return system.map(b => (typeof b?.text === "string" ? b.text : "")).join("\n");
}

// A captured request body with its system prompt flattened to a string, so
// tests written against the old single-string prompt keep reading.
export function withSystemText<T extends { system?: unknown }>(body: T): T {
  return { ...body, system: systemText(body.system) };
}

// One line in the server log per model call, with what it cost in tokens.
// cache_read above zero is the cache working; input is what was sent fresh.
// Never the prompt itself, never the key.
export function logUsage(label: string, data: unknown): void {
  const usage = (data as { usage?: unknown } | null)?.usage;
  if (typeof usage !== "object" || usage === null) return;
  const u = usage as Record<string, unknown>;
  const n = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : 0);
  const model = typeof (data as { model?: unknown }).model === "string" ? (data as { model: string }).model : "?";
  // Which marker a write landed on: an hour entry too short to cache shows
  // up here as a 5-minute write of the whole prefix instead.
  const creation = typeof u.cache_creation === "object" && u.cache_creation !== null ? (u.cache_creation as Record<string, unknown>) : {};
  const c = (k: string) => (typeof creation[k] === "number" ? (creation[k] as number) : 0);
  const split = Object.keys(creation).length > 0 ? ` (1h=${c("ephemeral_1h_input_tokens")} 5m=${c("ephemeral_5m_input_tokens")})` : "";
  console.log(
    `pilot-brain usage: ${label} model=${model} input=${n("input_tokens")} cache_write=${n("cache_creation_input_tokens")}${split} cache_read=${n("cache_read_input_tokens")} output=${n("output_tokens")}`
  );
}
