// The tool-calling pieces shared by both ways Pilot Brain talks to the model
// (the plain call and the web-search call). No dependencies, so neither of
// those modules has to import the other.

export const MAX_TOOL_ROUNDS = 4;
export const MAX_TOOL_CALLS_PER_CHAT = 6;

export interface ClientTools {
  definitions: unknown[];
  // Returns the text handed back to the model as the tool's result. Never
  // throws: a problem comes back as an error result the model can explain.
  execute: (name: string, input: unknown) => string;
  // True once any tool result this message contained instruction-like text
  // (it was filtered on the way in). The chat then won't learn anything from
  // this turn, so a poisoned record can't plant a lasting "memory".
  tainted?: () => boolean;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export const isToolUse = (b: unknown): b is ToolUseBlock =>
  typeof b === "object" && b !== null && (b as { type?: unknown }).type === "tool_use" && typeof (b as { id?: unknown }).id === "string";

// Results for one round of tool calls, respecting the per-message cap. A call
// over the cap still gets an answer (an error the model can explain), because
// the API needs a result for every call it made.
export function runToolCalls(tools: ClientTools, uses: ToolUseBlock[], alreadyRun: number) {
  let run = alreadyRun;
  const results = uses.map(use => {
    run += 1;
    const content =
      run > MAX_TOOL_CALLS_PER_CHAT
        ? JSON.stringify({ ok: false, error: "Too many lookups for one message. Answer with what you already have." })
        : tools.execute(use.name, use.input);
    return { type: "tool_result", tool_use_id: use.id, content };
  });
  return { results, run };
}
