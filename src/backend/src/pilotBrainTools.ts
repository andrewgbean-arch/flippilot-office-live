// Runs Pilot Brain's tools: hands the model the `look_inside` tool, executes
// the calls it makes AS THE PERSON ASKING, and feeds the results back, within
// hard limits. The tool itself (what it may read, for whom) lives in
// pilotBrainTabs.ts; this file is only the plumbing around it.
//
// Limits, all deliberate: a few rounds of lookups per message, a cap on the
// number of individual lookups, and a final round with no tools at all so a
// reply always ends in words. If the tool-enabled request fails for any
// reason the reply is written without tools rather than failing the chat.

import { randomUUID } from "crypto";
import type { AuthUser } from "./auth";
import { readTenantCollection, readTenantDoc, writeTenantCollection } from "./db";
import { PREPARED_ACTIONS_COLLECTION } from "./engines/preparedActions";
import { FILTERED, looksInjected } from "./engines/promptText";
import {
  EDITABLE,
  canPrepareEdits,
  prepareEdit,
  prepareEditToolDefinition,
  type EditDeps,
  type RecordStore,
} from "./pilotBrainEdits";
import { anthropicMessagesUrl } from "./pilotBrainWeb";
import { lookInside, lookInsideToolDefinition, type LookInput, type TabSource } from "./pilotBrainTabs";
import { MAX_TOOL_ROUNDS, isToolUse, runToolCalls, type ClientTools } from "./pilotBrainToolCore";

export { MAX_TOOL_ROUNDS, MAX_TOOL_CALLS_PER_CHAT, type ClientTools } from "./pilotBrainToolCore";

const TOOL_MAX_TOKENS = 900;
const TOOL_REQUEST_TIMEOUT_MS = 60_000;

export interface ToolChatMessage {
  role: string;
  content: string;
}

// The real data behind the tabs, for one dealership.
export function tenantTabSource(dealershipId: string): TabSource {
  return {
    list: name => readTenantCollection<unknown>(dealershipId, name),
    bookkeeping: () => {
      const doc = readTenantDoc<Record<string, unknown>>(dealershipId, "bookkeeping", {});
      return {
        purchases: Array.isArray(doc.purchases) ? doc.purchases : [],
        sales: Array.isArray(doc.sales) ? doc.sales : [],
        costs: Array.isArray(doc.costs) ? doc.costs : [],
      };
    },
  };
}

// The records a prepared change may touch, for one dealership. Used both to
// prepare a change and, from the Operations screen, to approve or undo it.
export function tenantRecordStore(dealershipId: string): RecordStore {
  return {
    read: kind => readTenantCollection<Record<string, unknown>>(dealershipId, EDITABLE[kind].collection),
    write: (kind, records) => writeTenantCollection(dealershipId, EDITABLE[kind].collection, records),
  };
}

export function tenantEditDeps(dealershipId: string): EditDeps {
  const store = tenantRecordStore(dealershipId);
  return {
    find: (kind, id) => store.read(kind).find(r => typeof r === "object" && r !== null && r.id === id),
    actions: () => readTenantCollection<{ type?: unknown; status?: unknown; payload?: unknown }>(dealershipId, PREPARED_ACTIONS_COLLECTION),
    addAction: action =>
      writeTenantCollection(dealershipId, PREPARED_ACTIONS_COLLECTION, [
        ...readTenantCollection<unknown>(dealershipId, PREPARED_ACTIONS_COLLECTION),
        action,
      ]),
    now: () => Date.now(),
    newId: () => randomUUID(),
  };
}

const asInput = (input: unknown): Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

// Everything the model may call on behalf of this person. prepare_edit is
// only offered to (and only runs for) someone who could approve the change.
export function buildClientTools(user: AuthUser, source: TabSource, edits?: EditDeps): ClientTools {
  const canEdit = edits !== undefined && canPrepareEdits(user);
  let preparedThisMessage = 0;
  let tainted = false;

  const run = (name: string, input: unknown): string => {
    try {
      if (name === "look_inside") {
        return JSON.stringify(lookInside(user, source, asInput(input) as LookInput));
      }
      if (name === "prepare_edit" && canEdit) {
        const result = prepareEdit(user, edits!, asInput(input), preparedThisMessage);
        if (result.ok) {
          preparedThisMessage += 1;
          return JSON.stringify({ ok: true, summary: result.summary });
        }
        return JSON.stringify(result);
      }
      return JSON.stringify({ ok: false, error: `There is no tool called "${String(name).slice(0, 40)}".` });
    } catch (err) {
      console.error(`pilot-brain tools: ${String(name).slice(0, 40)} failed`, err);
      return JSON.stringify({ ok: false, error: "That failed. Say so plainly and answer without it." });
    }
  };

  return {
    definitions: [lookInsideToolDefinition(user), ...(canEdit ? [prepareEditToolDefinition()] : [])],
    execute(name, input) {
      const out = run(name, input);
      // Record text is filtered on the way in; a filter marker means someone
      // typed instruction-like text into a record this turn read.
      if (out.includes(FILTERED) || looksInjected(out)) tainted = true;
      return out;
    },
    tainted: () => tainted,
  };
}

export async function chatWithTools(params: {
  apiKey: string;
  systemWithTools: string;
  // The same prompt without the tool section, for the no-tools fallback, so
  // the model isn't told about a tool it can't call.
  systemWithoutTools: string;
  messages: ToolChatMessage[];
  tools: ClientTools;
  fallbackCall: (systemPrompt: string, messages: ToolChatMessage[]) => Promise<string>;
}): Promise<string> {
  const convo: { role: string; content: unknown }[] = params.messages.map(m => ({ role: m.role, content: m.content }));
  let toolCalls = 0;

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const lastRound = round === MAX_TOOL_ROUNDS;
      const response = await fetch(anthropicMessagesUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": params.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: TOOL_MAX_TOKENS,
          system: params.systemWithTools,
          messages: convo,
          // No tools on the last round, so it has to answer in words.
          ...(lastRound ? {} : { tools: params.tools.definitions }),
        }),
        signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);

      const data = await response.json();
      const content: unknown[] = Array.isArray(data?.content) ? data.content : [];
      const uses = content.filter(isToolUse);

      if (data?.stop_reason === "tool_use" && uses.length > 0 && !lastRound) {
        const { results, run } = runToolCalls(params.tools, uses, toolCalls);
        toolCalls = run;
        convo.push({ role: "assistant", content }, { role: "user", content: results });
        continue;
      }

      // Only the final message's words: what it said before a lookup ("let
      // me check") isn't part of the answer.
      const text = content
        .map(b => {
          if (typeof b !== "object" || b === null) return "";
          const block = b as { type?: unknown; text?: unknown };
          return (block.type === undefined || block.type === "text") && typeof block.text === "string" ? block.text : "";
        })
        .join("")
        .trim();
      if (!text) throw new Error("Anthropic API returned no text");
      return text;
    }
    throw new Error("tool loop ended without an answer");
  } catch (err) {
    console.error("pilot-brain/chat: tool-enabled call failed, answering without tools", err);
    return params.fallbackCall(params.systemWithoutTools, params.messages);
  }
}
