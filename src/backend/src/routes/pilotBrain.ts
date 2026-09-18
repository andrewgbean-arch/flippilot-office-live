import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireAuth, type AuthUser, type Dealership } from "../auth";
import { runWatcher, type WatcherResult } from "../engines/watcherEngine";
import type { StaffNotification } from "./notifications";

export interface PilotBrainMessage {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface PilotBrainMemory {
  id: string;
  userId: string;
  fact: string;
  createdAt: string;
}

function authUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// Real Anthropic billing behind every call — same reasoning as the
// existing AI listing description limiter (aiListing.ts): being
// authenticated isn't enough on its own to cap real spend from a
// frontend bug or someone holding a key down.
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many messages to Pilot Brain — please try again shortly." },
});

// Separate real spend on a separate vendor (OpenAI, not Anthropic) —
// same reasoning as chatLimiter, its own limit since a chat reply and
// its spoken version are two different paid calls.
const speakLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many voice requests — please try again shortly." },
});

const MESSAGES_COLLECTION = "pilotBrainMessages";
const MEMORIES_COLLECTION = "pilotBrainMemories";

// How much raw conversation history rides along on every call — real
// tokens, real cost, so this is a deliberate window rather than the
// whole history. Long-term "remembered" facts (below) are what carry
// context past this window, not an ever-growing transcript.
const HISTORY_WINDOW = 20;

// V1 Business Summary / Context Awareness Engine — deliberately simple
// for this version: real inventory + leads counts and MOT risk, not a
// deep bookkeeping/profit breakdown yet (this dealer app's bookkeeping
// data model is its own more involved thing — a real V2/V3 extension,
// not V1's job). Every number here is genuinely computed from this
// dealership's real stored data, nothing invented.
function buildBusinessSummary(dealershipId: string): string {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const leads = readTenantCollection<any>(dealershipId, "leads");

  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold");
  const totalValue = inStock.reduce((sum, v) => sum + (v.priceRetail ?? 0), 0);

  const now = Date.now();
  const motRisk = inStock.filter(v => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = (new Date(expiry).getTime() - now) / 86400000;
    return days <= 30;
  }).length;

  const openLeads = leads.filter(
    (l: any) => l.status && !["won", "lost"].includes(String(l.status).toLowerCase())
  ).length;

  return [
    `Vehicles in stock: ${inStock.length}`,
    `Total stock value: £${totalValue.toLocaleString()}`,
    `Vehicles with MOT expiring within 30 days (or already expired): ${motRisk}`,
    `Open leads: ${openLeads}`,
  ].join("\n");
}

// V2 (Watcher) additions to the summary — real findings from
// watcherEngine, in the same plain-text style as the V1 business
// snapshot above, so the model can mention them naturally without a
// separate prompt path.
function buildWatcherSummary(watcher: WatcherResult): string {
  const lines = [
    `Business Health: ${watcher.health.overall}/100 (Sales ${watcher.health.salesHealth}, Leads ${watcher.health.leadHealth}, Inventory ${watcher.health.inventoryHealth}, Activity ${watcher.health.activityHealth})`,
  ];

  const critical = watcher.alerts.filter(a => a.severity === "critical");
  const warning = watcher.alerts.filter(a => a.severity === "warning");

  if (critical.length > 0) {
    lines.push(`Critical issues (${critical.length}):`);
    critical.slice(0, 5).forEach(a => lines.push(`- ${a.message}`));
  }
  if (warning.length > 0) {
    lines.push(`Warnings (${warning.length}):`);
    warning.slice(0, 5).forEach(a => lines.push(`- ${a.message}`));
  }
  if (critical.length === 0 && warning.length === 0) {
    lines.push("No active warnings or critical issues right now.");
  }
  watcher.risks.forEach(r => lines.push(`Risk noticed: ${r.title} — ${r.message}`));

  return lines.join("\n");
}

function buildSystemPrompt(dealershipName: string, userName: string, summary: string, watcherSummary: string, memories: string[]): string {
  return [
    `You are Pilot Brain — the business companion built into ${dealershipName}'s FlipPilot Dealer OS.`,
    `You are NOT a generic chatbot or a help-desk bot. You are a trusted digital business partner — closer to a co-founder, advisor and friend than software.`,
    `Always address the user as "Boss". Tone: professional, friendly, calm, confident, honest, helpful. Never robotic, never cold, never overly formal.`,
    `This is V2 (Watcher). On top of V1's conversation and memory, you now proactively notice problems — uncontacted leads, aging stock, incomplete appointments, slowing sales — and can mention them unprompted when relevant. You do NOT yet deeply investigate or explain WHY something is happening, or forecast the market — that's a later version. If Boss asks for something outside that scope, say so honestly rather than pretending.`,
    ``,
    `Today's real business snapshot for ${dealershipName}:`,
    summary,
    ``,
    `What you've been watching for (real, computed just now — not guesses):`,
    watcherSummary,
    ``,
    memories.length > 0
      ? `What you already know about Boss and this business, from earlier conversations:\n${memories.map(m => `- ${m}`).join("\n")}`
      : `You don't have any remembered facts about Boss yet — this may be an early conversation.`,
    ``,
    `The user talking to you is ${userName}.`,
    ``,
    `If a critical issue or a real risk is in the watch list above and this is the start of a conversation, it's natural to mention the most important one early rather than waiting to be asked — that's the whole point of watching. Don't list every single item; lead with what matters most.`,
    ``,
    `If — and only if — you learn something genuinely worth remembering long-term this turn (a real preference, a durable fact about the business, something that should still matter in future conversations), end your reply with a new final line in exactly this form: <remember>the fact, written plainly in one sentence</remember>. Do this rarely — never for routine chit-chat or anything already listed above. Never mention this mechanism to Boss.`,
  ].join("\n");
}

// Runs the Watcher against this dealership's real current data. No
// scheduler exists in this app, so this is triggered on-demand — the
// Dashboard's Watcher card and every Pilot Brain call are what "keeps
// watch" in practice, not a background job.
function runWatcherForDealership(dealershipId: string): WatcherResult {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const leads = readTenantCollection<any>(dealershipId, "leads");
  const appointments = readTenantCollection<any>(dealershipId, "appointments");
  const jobs = readTenantCollection<any>(dealershipId, "jobs");
  return runWatcher(vehicles, leads, appointments, jobs);
}

// Turns warning/critical alerts into real per-user notifications,
// deduped by sourceKey so re-running this (e.g. every dashboard load)
// doesn't spam the same ongoing issue — only creates a fresh one if the
// last one for that exact issue is more than a day old, so a still-open
// problem resurfaces daily rather than never again after the first ping.
function notifyDealershipFromWatcher(dealershipId: string, watcher: WatcherResult) {
  const actionable = watcher.alerts.filter(a => a.severity !== "info" || a.category === "activity");
  if (actionable.length === 0) return;

  const users = readCollection<{ id: string; dealershipId: string }>("users").filter(
    u => u.dealershipId === dealershipId
  );
  if (users.length === 0) return;

  const existing = readTenantCollection<StaffNotification>(dealershipId, "notifications");
  const now = Date.now();
  const fresh: StaffNotification[] = [];

  for (const user of users) {
    for (const alert of actionable) {
      const recent = existing.find(
        n => n.userId === user.id && n.sourceKey === alert.sourceKey &&
          now - new Date(n.createdAt).getTime() < 24 * 60 * 60 * 1000
      );
      if (recent) continue;

      fresh.push({
        id: randomUUID(),
        userId: user.id,
        title: alert.title,
        message: alert.message,
        type: alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "info",
        createdAt: new Date().toISOString(),
        readAt: null,
        sourceKey: alert.sourceKey,
      });
    }
  }

  if (fresh.length > 0) {
    writeTenantCollection(dealershipId, "notifications", [...existing, ...fresh]);
  }
}

async function callClaude(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) throw new Error("Anthropic API returned no text");
  return text;
}

export default function registerPilotBrainRoute(app: Express) {
  app.get("/pilot-brain/messages", requireAuth, (req, res) => {
    const user = authUser(req);
    const messages = readTenantCollection<PilotBrainMessage>(user.dealershipId, MESSAGES_COLLECTION)
      .filter(m => m.userId === user.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ ok: true, messages });
  });

  app.post("/pilot-brain/chat", requireAuth, chatLimiter, async (req, res) => {
    const user = authUser(req);
    const { message } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message can't be empty" });
    }
    if (message.length > 4000) {
      return res.status(400).json({ ok: false, error: "Message is too long" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: "Pilot Brain needs an API key — set ANTHROPIC_API_KEY in backend/.env to enable this.",
      });
    }

    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === user.dealershipId);
    const dealershipName = dealership?.name ?? "your dealership";

    const allMessages = readTenantCollection<PilotBrainMessage>(user.dealershipId, MESSAGES_COLLECTION);
    const myMessages = allMessages.filter(m => m.userId === user.id);
    const recentHistory = myMessages.slice(-HISTORY_WINDOW);

    const allMemories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION);
    const myMemories = allMemories.filter(m => m.userId === user.id);

    const summary = buildBusinessSummary(user.dealershipId);
    const watcher = runWatcherForDealership(user.dealershipId);
    notifyDealershipFromWatcher(user.dealershipId, watcher);
    const systemPrompt = buildSystemPrompt(
      dealershipName,
      user.name,
      summary,
      buildWatcherSummary(watcher),
      myMemories.map(m => m.fact)
    );

    const userMsg: PilotBrainMessage = {
      id: randomUUID(),
      userId: user.id,
      role: "user",
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };

    let rawReply: string;
    try {
      rawReply = await callClaude(
        apiKey,
        systemPrompt,
        [...recentHistory, userMsg].map(m => ({ role: m.role, content: m.content }))
      );
    } catch (err) {
      console.error("pilot-brain/chat: Anthropic call failed", err);
      return res.status(502).json({ ok: false, error: "Could not reach Pilot Brain right now — please try again." });
    }

    // Pull out an optional <remember>...</remember> tag the model may
    // have appended — stored as a real long-term memory, stripped from
    // what's actually shown to Boss (the mechanism is invisible to them).
    let visibleReply = rawReply;
    const rememberMatch = rawReply.match(/<remember>([\s\S]*?)<\/remember>\s*$/);
    let newMemory: PilotBrainMemory | null = null;
    if (rememberMatch && rememberMatch[1]) {
      visibleReply = rawReply.slice(0, rememberMatch.index).trim();
      newMemory = {
        id: randomUUID(),
        userId: user.id,
        fact: rememberMatch[1].trim(),
        createdAt: new Date().toISOString(),
      };
    }

    const assistantMsg: PilotBrainMessage = {
      id: randomUUID(),
      userId: user.id,
      role: "assistant",
      content: visibleReply,
      createdAt: new Date().toISOString(),
    };

    writeTenantCollection(user.dealershipId, MESSAGES_COLLECTION, [...allMessages, userMsg, assistantMsg]);
    if (newMemory) {
      writeTenantCollection(user.dealershipId, MEMORIES_COLLECTION, [...allMemories, newMemory]);
    }

    res.json({ ok: true, message: assistantMsg });
  });

  // Real AI voice (OpenAI's tts-1) for Pilot Brain's spoken replies —
  // "Wendy". Real pay-as-you-go spend per character, separate vendor/
  // key from Anthropic, hence its own rate limit. Returns raw MP3 bytes
  // rather than a URL — nothing is stored, each call is generated fresh
  // and streamed straight through.
  const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

  app.post("/pilot-brain/speak", requireAuth, speakLimiter, async (req, res) => {
    const { text, voice } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Text can't be empty" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ ok: false, error: "Text is too long to speak" });
    }
    // Whitelisted rather than passed straight through — this value goes
    // directly into a real paid API call, so an unvalidated field here
    // would let a client pass anything through to OpenAI on our key.
    const selectedVoice = OPENAI_VOICES.includes(voice) ? voice : "fable";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: "Voice needs an API key — set OPENAI_API_KEY in backend/.env to enable this.",
      });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: selectedVoice,
          input: text.trim(),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("pilot-brain/speak: OpenAI error", response.status, errText);
        return res.status(502).json({ ok: false, error: "Could not generate voice right now." });
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      res.set("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (err) {
      console.error("pilot-brain/speak: request failed", err);
      res.status(502).json({ ok: false, error: "Could not generate voice right now." });
    }
  });

  // V2 (Watcher) — real business health score, alerts, risks and
  // activity, computed fresh from this dealership's real current data.
  // Also the trigger point for real notifications (deduped, see
  // notifyDealershipFromWatcher) — this is what "runs the watch" since
  // there's no background scheduler in this app.
  app.get("/pilot-brain/watcher", requireAuth, (req, res) => {
    const user = authUser(req);
    const watcher = runWatcherForDealership(user.dealershipId);
    notifyDealershipFromWatcher(user.dealershipId, watcher);
    res.json({ ok: true, ...watcher });
  });

  app.get("/pilot-brain/memories", requireAuth, (req, res) => {
    const user = authUser(req);
    const memories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION)
      .filter(m => m.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, memories });
  });

  // Morning Briefing Engine — a real AI-written summary of today's
  // actual business snapshot, same underlying data as the chat's own
  // context awareness, just asked for directly rather than triggered
  // by a question. Not cached per-day yet (a real V1 simplification,
  // noted rather than hidden) — each call is a fresh real request.
  app.get("/pilot-brain/briefing", requireAuth, async (req, res) => {
    const user = authUser(req);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: "Pilot Brain needs an API key — set ANTHROPIC_API_KEY in backend/.env to enable this.",
      });
    }

    const dealership = readCollection<Dealership>("dealerships").find(d => d.id === user.dealershipId);
    const dealershipName = dealership?.name ?? "your dealership";
    const summary = buildBusinessSummary(user.dealershipId);
    const watcher = runWatcherForDealership(user.dealershipId);
    notifyDealershipFromWatcher(user.dealershipId, watcher);

    const allMemories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION);
    const myMemories = allMemories.filter(m => m.userId === user.id);
    const systemPrompt = buildSystemPrompt(dealershipName, user.name, summary, buildWatcherSummary(watcher), myMemories.map(m => m.fact));

    try {
      const reply = await callClaude(apiKey, systemPrompt, [
        {
          role: "user",
          content:
            "Give me a short morning briefing — 2-4 sentences, based on today's real business snapshot and what you've been watching for above. If there's a genuinely important issue (critical alert or real risk), lead with that rather than burying it. No greeting-only fluff.",
        },
      ]);
      res.json({ ok: true, briefing: reply.replace(/<remember>[\s\S]*?<\/remember>\s*$/, "").trim() });
    } catch (err) {
      console.error("pilot-brain/briefing: Anthropic call failed", err);
      res.status(502).json({ ok: false, error: "Could not generate a briefing right now." });
    }
  });
}
