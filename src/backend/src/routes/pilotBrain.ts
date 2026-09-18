import { randomUUID } from "crypto";
import { Readable } from "stream";
import { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { readCollection, readTenantCollection, writeTenantCollection, readTenantDoc } from "../db";
import { requireAuth, type AuthUser, type Dealership } from "../auth";
import { runWatcher, type WatcherResult } from "../engines/watcherEngine";
import { investigate, findOpportunities, type InvestigationReport, type Opportunity } from "../engines/advisorEngine";
import { buildMarketSummaryFromStorage } from "./marketIntelligence";
import type { StaffNotification } from "./notifications";

interface BookkeepingDoc {
  purchases: { vehicleId: string; purchasePrice: number; date: string }[];
  sales: { vehicleId: string; salePrice: number; date: string }[];
  costs: { vehicleId: string; amount: number; date: string }[];
}

const EMPTY_BOOKKEEPING: BookkeepingDoc = { purchases: [], sales: [], costs: [] };

function readBookkeeping(dealershipId: string): BookkeepingDoc {
  return readTenantDoc<BookkeepingDoc>(dealershipId, "bookkeeping", EMPTY_BOOKKEEPING);
}

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

function buildSystemPrompt(
  dealershipName: string,
  userName: string,
  summary: string,
  watcherSummary: string,
  advisorSummary: string,
  marketSummary: string,
  memories: string[]
): string {
  return [
    `You are Pilot Brain — the business companion built into ${dealershipName}'s FlipPilot Dealer OS.`,
    `You are NOT a generic chatbot or a help-desk bot. You are a trusted digital business partner — closer to a co-founder, advisor and friend than software.`,
    `Always address the user as "Boss". Tone: professional, friendly, calm, confident, honest, helpful. Never robotic, never cold, never overly formal.`,
    `This is V4 (Market Intelligence). V1 gave you conversation and memory. V2 gave you the ability to notice problems unprompted. V3 gave you the ability to explain why something happened inside the business. V4 gives you real market awareness — comparing this dealership's stock against real comparable market listings (from eBay's dealer marketplace), tracking real price/demand trends over time, and investigating why a specific vehicle isn't selling using both internal and market evidence.`,
    ``,
    `GOLDEN RULE: follow evidence. Never guess, invent, or hallucinate a cause, a price, a trend, or a demand signal. If the evidence below doesn't clearly explain something, say so honestly ("the data doesn't show a clear reason for that yet") rather than making one up.`,
    `Market data below only covers what's actually been checked — if a vehicle or make/model isn't mentioned in the market evidence, you have no real market data for it; say so rather than guessing a price or trend.`,
    `Still explicitly out of scope — say so honestly if Boss asks: regional/local market comparisons (no real regional data source exists yet), tracking specific named competitors (not something the data can responsibly identify), any cross-dealer "platform-wide" trend (not enough real dealers on FlipPilot yet for that to mean anything — it would just be this dealership's own data relabelled), forecasting future performance, autonomous pricing/buying decisions, or acting on your own without being asked. Those are later versions.`,
    `When asked a "why" question about the business (why are sales down, etc.), use the Investigation evidence. When asked why a SPECIFIC vehicle isn't selling, combine that with the Market evidence below — pricing position and demand trend for that make/model — and say plainly which evidence you have and don't have.`,
    `When you notice something Boss has genuinely improved (a real positive change in the evidence below), say so like a coach would — specific and encouraging, not generic praise ("well done!"). Recommendations should always be concrete and actionable (e.g. "contact the 3 leads open over 24 hours" not "improve sales").`,
    `Every market conclusion must state a confidence level (high/medium/low) — the evidence below already tells you what it should be, based on real sample size.`,
    ``,
    `Today's real business snapshot for ${dealershipName}:`,
    summary,
    ``,
    `What you've been watching for (real, computed just now — not guesses):`,
    watcherSummary,
    ``,
    `Investigation evidence — real period-over-period comparisons and ranked likely factors, computed just now, for answering any "why" question about the business:`,
    advisorSummary,
    ``,
    `Market evidence — real comparable pricing and demand data from actual eBay dealer listings, and real price/demand trends built up over real time as this dealership's stock has been checked:`,
    marketSummary,
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
  const bookkeeping = readBookkeeping(dealershipId);
  return runWatcher(vehicles, leads, appointments, jobs, bookkeeping.sales);
}

// V3 (Advisor) — real evidence for "why" questions, built the same way
// as the V1/V2 summaries: computed here, narrated by the model, never
// invented by it.
function runInvestigationForDealership(dealershipId: string, windowDays: number): InvestigationReport {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const leads = readTenantCollection<any>(dealershipId, "leads");
  const appointments = readTenantCollection<any>(dealershipId, "appointments");
  const bookkeeping = readBookkeeping(dealershipId);
  return investigate(vehicles, leads, appointments, bookkeeping, windowDays);
}

function runOpportunitiesForDealership(dealershipId: string): Opportunity[] {
  const vehicles = readTenantCollection<any>(dealershipId, "vehicles");
  const leads = readTenantCollection<any>(dealershipId, "leads");
  const bookkeeping = readBookkeeping(dealershipId);
  return findOpportunities(leads, bookkeeping, vehicles);
}

function formatComparison(c: { metric: string; current: number; previous: number; changePercent: number | null }): string {
  const changeText = c.changePercent == null
    ? "no prior data to compare against"
    : `${c.changePercent >= 0 ? "+" : ""}${c.changePercent}% vs the previous period (was ${c.previous})`;
  return `${c.metric}: ${c.current} (${changeText})`;
}

function buildAdvisorSummary(report: InvestigationReport, opportunities: Opportunity[]): string {
  const lines = [
    `Investigation window: last ${report.windowDays} days vs the ${report.windowDays} days before that. Confidence in this comparison: ${report.confidence} (based on real sample size — few leads/sales in the window makes percentage swings noisy).`,
    formatComparison(report.sales),
    formatComparison(report.revenue),
    formatComparison(report.profit),
    formatComparison(report.leadsAdded),
    formatComparison(report.leadConversionRate),
    formatComparison(report.appointmentsBooked),
  ];

  if (report.likelyFactors.length > 0) {
    lines.push(`Likely contributing factors (ranked by how much each real metric actually moved):`);
    report.likelyFactors.forEach(f => lines.push(`- ${f}`));
  } else {
    lines.push(`No single factor moved enough (10%+) to call out as a likely cause — things are broadly stable.`);
  }

  if (opportunities.length > 0) {
    lines.push(`Real opportunities/positives worth acknowledging:`);
    opportunities.forEach(o => lines.push(`- ${o.title}: ${o.detail}`));
  }

  return lines.join("\n");
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

async function callClaude(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[], maxTokens = 500): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
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
    const investigation = runInvestigationForDealership(user.dealershipId, 30);
    const opportunities = runOpportunitiesForDealership(user.dealershipId);
    const marketSummary = buildMarketSummaryFromStorage(user.dealershipId);
    const systemPrompt = buildSystemPrompt(
      dealershipName,
      user.name,
      summary,
      buildWatcherSummary(watcher),
      buildAdvisorSummary(investigation, opportunities),
      marketSummary,
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

      // Piped through as OpenAI produces it, not buffered into memory
      // first — buffering here would force the client to wait for the
      // ENTIRE file before it could even start receiving bytes, which
      // is most of the real "5 seconds before anything plays" latency
      // for a longer reply. The frontend now plays progressively as
      // this streams in (see PilotBrainChat.tsx's speak()).
      res.set("Content-Type", "audio/mpeg");
      Readable.fromWeb(response.body as import("stream/web").ReadableStream<Uint8Array>).pipe(res);
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

  // V3 (Advisor), Performance Review Engine (Module 4) — a real
  // AI-written review for a given period, using the same real
  // Investigation Engine evidence as chat's "why" answers, just for a
  // fixed reporting window instead of a rolling 30 days.
  const REVIEW_WINDOWS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 90 };
  app.get("/pilot-brain/review", requireAuth, async (req, res) => {
    const user = authUser(req);
    const period = typeof req.query.period === "string" ? req.query.period : "weekly";
    const windowDays = REVIEW_WINDOWS[period];
    if (!windowDays) {
      return res.status(400).json({ ok: false, error: "period must be one of: daily, weekly, monthly, quarterly" });
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
    const summary = buildBusinessSummary(user.dealershipId);
    const watcher = runWatcherForDealership(user.dealershipId);
    const investigation = runInvestigationForDealership(user.dealershipId, windowDays);
    const opportunities = runOpportunitiesForDealership(user.dealershipId);
    const marketSummary = buildMarketSummaryFromStorage(user.dealershipId);

    const allMemories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION);
    const myMemories = allMemories.filter(m => m.userId === user.id);
    const systemPrompt = buildSystemPrompt(
      dealershipName, user.name, summary, buildWatcherSummary(watcher),
      buildAdvisorSummary(investigation, opportunities), marketSummary, myMemories.map(m => m.fact)
    );

    try {
      const reply = await callClaude(apiKey, systemPrompt, [
        {
          role: "user",
          content:
            `Write a ${period} performance review using ONLY the real evidence above — sales, revenue, profit, leads, conversion, appointments, AND a separate "Market Findings" section covering real pricing/demand data and trends from the market evidence above (skip this section entirely, honestly, if no real market data has been checked yet — don't pad it out). For each metric that's worth mentioning, state what happened, why (if the evidence shows a likely factor), and one practical recommendation. Keep it tight and structured, like a real report — short lines, not a wall of prose. If the evidence is too thin to say something meaningful (e.g. a brand new dealership with almost no data yet), say that honestly instead of padding it out.`,
        },
      ], 700);
      res.json({
        ok: true,
        period,
        review: reply.replace(/<remember>[\s\S]*?<\/remember>\s*$/, "").trim(),
      });
    } catch (err) {
      console.error("pilot-brain/review: Anthropic call failed", err);
      res.status(502).json({ ok: false, error: "Could not generate a review right now." });
    }
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
    const investigation = runInvestigationForDealership(user.dealershipId, 30);
    const opportunities = runOpportunitiesForDealership(user.dealershipId);
    const marketSummary = buildMarketSummaryFromStorage(user.dealershipId);

    const allMemories = readTenantCollection<PilotBrainMemory>(user.dealershipId, MEMORIES_COLLECTION);
    const myMemories = allMemories.filter(m => m.userId === user.id);
    const systemPrompt = buildSystemPrompt(
      dealershipName, user.name, summary, buildWatcherSummary(watcher),
      buildAdvisorSummary(investigation, opportunities), marketSummary, myMemories.map(m => m.fact)
    );

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
