import { randomUUID } from "crypto";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection } from "../db";
import { requireAuth, type AuthUser, type Dealership } from "../auth";

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

function buildSystemPrompt(dealershipName: string, userName: string, summary: string, memories: string[]): string {
  return [
    `You are Pilot Brain — the business companion built into ${dealershipName}'s FlipPilot Dealer OS.`,
    `You are NOT a generic chatbot or a help-desk bot. You are a trusted digital business partner — closer to a co-founder, advisor and friend than software.`,
    `Always address the user as "Boss". Tone: professional, friendly, calm, confident, honest, helpful. Never robotic, never cold, never overly formal.`,
    `This is V1 (Companion) — natural conversation, memory, and business awareness only. You do not yet proactively monitor, forecast, or research the wider market (those are later versions) — if Boss asks for something outside that scope, say so honestly rather than pretending.`,
    ``,
    `Today's real business snapshot for ${dealershipName}:`,
    summary,
    ``,
    memories.length > 0
      ? `What you already know about Boss and this business, from earlier conversations:\n${memories.map(m => `- ${m}`).join("\n")}`
      : `You don't have any remembered facts about Boss yet — this may be an early conversation.`,
    ``,
    `The user talking to you is ${userName}.`,
    ``,
    `If — and only if — you learn something genuinely worth remembering long-term this turn (a real preference, a durable fact about the business, something that should still matter in future conversations), end your reply with a new final line in exactly this form: <remember>the fact, written plainly in one sentence</remember>. Do this rarely — never for routine chit-chat or anything already listed above. Never mention this mechanism to Boss.`,
  ].join("\n");
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
    const systemPrompt = buildSystemPrompt(
      dealershipName,
      user.name,
      summary,
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

    const allMemories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION);
    const myMemories = allMemories.filter(m => m.userId === user.id);
    const systemPrompt = buildSystemPrompt(dealershipName, user.name, summary, myMemories.map(m => m.fact));

    try {
      const reply = await callClaude(apiKey, systemPrompt, [
        {
          role: "user",
          content:
            "Give me a short morning briefing — 2-4 sentences, based only on today's real business snapshot above. No greeting-only fluff; tell me something genuinely useful about where things stand.",
        },
      ]);
      res.json({ ok: true, briefing: reply.replace(/<remember>[\s\S]*?<\/remember>\s*$/, "").trim() });
    } catch (err) {
      console.error("pilot-brain/briefing: Anthropic call failed", err);
      res.status(502).json({ ok: false, error: "Could not generate a briefing right now." });
    }
  });
}
