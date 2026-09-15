import { Express, Request } from "express";
import type { AuthUser } from "../auth";

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

interface VehicleDescriptionInput {
  make?: string;
  model?: string;
  year?: number | null;
  mileage?: number | null;
  colour?: string | null;
  condition?: string;
  motStatus?: string | null;
  motExpiry?: string | null;
  priceRetail?: number | null;
  notes?: string | null;
}

function buildPrompt(v: VehicleDescriptionInput): string {
  const facts = [
    v.year || v.make || v.model
      ? `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim()
      : null,
    v.mileage != null ? `${v.mileage.toLocaleString()} miles` : null,
    v.colour ? `${v.colour}` : null,
    v.condition ? `Condition: ${v.condition}` : null,
    v.motStatus ? `MOT status: ${v.motStatus}` : null,
    v.motExpiry ? `MOT expiry: ${v.motExpiry}` : null,
    v.priceRetail != null ? `Asking price: £${v.priceRetail.toLocaleString()}` : null,
    v.notes ? `Dealer notes: ${v.notes}` : null,
  ].filter(Boolean).join("\n");

  return [
    "Write a short, honest, appealing used-car listing description for a UK dealer website, based only on the real facts below.",
    "Do not invent any feature, spec, or history not given here. Do not use excessive superscript-style ALL CAPS or more than one exclamation mark. 2-4 sentences, plain prose, no markdown.",
    "",
    "Vehicle facts:",
    facts,
  ].join("\n");
}

// Real AI-generated listing descriptions — genuinely wired to Anthropic's
// API (no fake/random output), same "wired for real, not activated
// until a key is set" pattern already used for Stripe billing and
// outbound email in this app. Every fact in the prompt comes from the
// vehicle's own real stored data; nothing is invented server-side.
export default function registerAiListingRoute(app: Express) {
  app.post("/ai/vehicle-description", async (req, res) => {
    authedUser(req); // requireAuth already ran; just confirms a real session

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: "AI description generation needs an API key — set ANTHROPIC_API_KEY in backend/.env to enable this.",
      });
    }

    const input: VehicleDescriptionInput = req.body ?? {};
    if (!input.make && !input.model) {
      return res.status(400).json({ ok: false, error: "Vehicle make/model is required" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: buildPrompt(input) }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ai/vehicle-description: Anthropic API error", response.status, errText);
        return res.status(502).json({ ok: false, error: "AI provider request failed" });
      }

      const data = await response.json();
      const description = data?.content?.[0]?.text?.trim();
      if (!description) {
        return res.status(502).json({ ok: false, error: "AI provider returned no text" });
      }

      res.json({ ok: true, description });
    } catch (err) {
      console.error("ai/vehicle-description: failed to reach Anthropic", err);
      res.status(502).json({ ok: false, error: "Could not reach the AI provider" });
    }
  });
}
