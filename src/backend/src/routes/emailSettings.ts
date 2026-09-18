import { Express, Request } from "express";
import { readTenantDoc, writeTenantDoc } from "../db";
import { requireAuth, requireOwner, type AuthUser } from "../auth";
import { encryptSecret, decryptSecret, maskSecret } from "../credentialCrypto";

// "Bring your own key" email sending — each dealership connects their
// own real SendGrid account rather than sending through one shared
// FlipPilot-owned key. Real reasons this matters, not just preference:
// (1) cost — FlipPilot doesn't absorb every dealer's real send volume;
// (2) deliverability — one dealer's spammy content on a shared sending
// domain/IP would hurt every other dealer's email reputation too;
// (3) compliance — the dealer directly contracts with the vendor and
// owns their own sender identity, rather than sending "through"
// FlipPilot's.
//
// The API key is encrypted at rest (see ../credentialCrypto.ts) and NEVER sent
// back to the frontend once saved — GET only ever returns whether a
// key is configured plus a masked hint, matching how every other
// vendor credential in this app is treated.
//
// This is deliberately just the connection layer — nothing in this
// app actually sends a real marketing email yet. That's a separate,
// later step (and needs the Customer consent records this app already
// tracks to be checked before anything goes out).

export type EmailProvider = "sendgrid";

interface EmailSettingsDoc {
  provider: EmailProvider;
  encryptedApiKey: string;
  fromEmail: string;
  fromName: string;
  connectedAt: string;
  connectedByName: string;
}

const EMPTY_EMAIL_SETTINGS: EmailSettingsDoc | null = null;

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function registerEmailSettingsRoute(app: Express) {
  // Any authenticated staff can see whether email is connected — the
  // real key itself is never exposed to anyone, owner included, once saved.
  app.get("/email-settings", requireAuth, (req, res) => {
    const user = authedUser(req);
    const doc = readTenantDoc<EmailSettingsDoc | null>(user.dealershipId, "emailSettings", EMPTY_EMAIL_SETTINGS);
    if (!doc) {
      return res.json({ ok: true, connected: false });
    }
    let maskedKey = "••••";
    try {
      maskedKey = maskSecret(decryptSecret(doc.encryptedApiKey));
    } catch (err) {
      console.error("email-settings: failed to decrypt stored key for masking", err);
    }
    res.json({
      ok: true,
      connected: true,
      provider: doc.provider,
      fromEmail: doc.fromEmail,
      fromName: doc.fromName,
      connectedAt: doc.connectedAt,
      connectedByName: doc.connectedByName,
      maskedKey,
    });
  });

  // Connecting/replacing the real key is owner-only — same trust tier
  // as Stripe billing changes (billing.ts), arguably higher stakes
  // since a bad or leaked key here spends the DEALER'S OWN real vendor
  // budget, not FlipPilot's.
  app.put("/email-settings", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    const { apiKey, fromEmail, fromName } = req.body ?? {};

    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return res.status(400).json({ ok: false, error: "A real SendGrid API key is required" });
    }
    if (typeof fromEmail !== "string" || !isValidEmail(fromEmail.trim())) {
      return res.status(400).json({ ok: false, error: 'A valid "from" email address is required' });
    }
    if (typeof fromName !== "string" || !fromName.trim()) {
      return res.status(400).json({ ok: false, error: 'A "from" name is required' });
    }

    let encryptedApiKey: string;
    try {
      encryptedApiKey = encryptSecret(apiKey.trim());
    } catch (err) {
      console.error("email-settings: encryption failed", err);
      return res.status(500).json({ ok: false, error: "Server isn't configured to store credentials securely yet — contact support." });
    }

    const doc: EmailSettingsDoc = {
      provider: "sendgrid",
      encryptedApiKey,
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim(),
      connectedAt: new Date().toISOString(),
      connectedByName: user.name,
    };
    writeTenantDoc(user.dealershipId, "emailSettings", doc);
    res.json({ ok: true, connected: true, fromEmail: doc.fromEmail, fromName: doc.fromName, maskedKey: maskSecret(apiKey.trim()) });
  });

  app.delete("/email-settings", requireAuth, requireOwner, (req, res) => {
    const user = authedUser(req);
    writeTenantDoc<EmailSettingsDoc | null>(user.dealershipId, "emailSettings", null);
    res.json({ ok: true });
  });

  // Sends one real test email through the dealer's own connected
  // account — the only real way to confirm a pasted key and verified
  // sender actually work, rather than just trusting the paste.
  app.post("/email-settings/test", requireAuth, requireOwner, async (req, res) => {
    const user = authedUser(req);
    const { to } = req.body ?? {};
    if (typeof to !== "string" || !isValidEmail(to.trim())) {
      return res.status(400).json({ ok: false, error: "A valid recipient email is required" });
    }

    const doc = readTenantDoc<EmailSettingsDoc | null>(user.dealershipId, "emailSettings", EMPTY_EMAIL_SETTINGS);
    if (!doc) {
      return res.status(400).json({ ok: false, error: "Connect a real email account first" });
    }

    try {
      const apiKey = decryptSecret(doc.encryptedApiKey);
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to.trim() }] }],
          from: { email: doc.fromEmail, name: doc.fromName },
          subject: "FlipPilot test email",
          content: [
            {
              type: "text/plain",
              value: `This is a real test email sent from ${doc.fromName}'s FlipPilot Dealer OS — if you're reading this, your email sending is connected and working.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("email-settings/test: SendGrid error", response.status, errText);
        return res.status(502).json({
          ok: false,
          error: "SendGrid rejected the test send — check the API key is correct and that the from-address is a verified sender in your SendGrid account.",
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("email-settings/test: request failed", err);
      res.status(502).json({ ok: false, error: "Couldn't reach SendGrid right now." });
    }
  });
}
