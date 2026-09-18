import { useEffect, useState } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { useAuth } from "@/context/AuthContext";
import {
  fetchEmailSettings,
  saveEmailSettings,
  disconnectEmailSettings,
  sendTestEmail,
  type EmailSettingsStatus,
} from "@/lib/emailSettingsApi";

const inputClass = "w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4";

// "Bring your own key" email sending — each dealership connects their
// own real SendGrid account rather than sending through one shared
// FlipPilot key. Nothing anywhere in the app actually sends a real
// marketing email yet; this page is just the connection layer, and
// the only thing it can send is a one-off test to prove the
// connection genuinely works.
export default function EmailSettingsScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [status, setStatus] = useState<EmailSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);

  const [testTo, setTestTo] = useState(user?.email ?? "");
  const [testing, setTesting] = useState(false);

  async function load() {
    setLoading(true);
    const result = await fetchEmailSettings();
    if (result.ok && result.status) setStatus(result.status);
    else setError(result.error ?? "Couldn't load email settings");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!apiKey.trim() || !fromEmail.trim() || !fromName.trim()) {
      setError("API key, from-email, and from-name are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await saveEmailSettings(apiKey.trim(), fromEmail.trim(), fromName.trim());
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that.");
      return;
    }
    setApiKey("");
    setSuccess("Connected. Send a test email below to confirm it actually works.");
    await load();
  }

  async function handleDisconnect() {
    setError(null);
    setSuccess(null);
    const result = await disconnectEmailSettings();
    if (!result.ok) {
      setError(result.error ?? "Couldn't disconnect.");
      return;
    }
    await load();
  }

  async function handleTest() {
    if (!testTo.trim()) {
      setError("Enter an email address to send the test to.");
      return;
    }
    setTesting(true);
    setError(null);
    setSuccess(null);
    const result = await sendTestEmail(testTo.trim());
    setTesting(false);
    if (!result.ok) {
      setError(result.error ?? "Test send failed.");
      return;
    }
    setSuccess(`Test email sent to ${testTo.trim()} — check your inbox (and spam folder).`);
  }

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-3xl mx-auto">
      <SupernovaHeroHeader
        title="Email Sending"
        subtitle="Connect your own real SendGrid account — your emails, your domain, your bill, not FlipPilot's."
      />

      <a
        href="https://claude.ai/artifact/42nDBbGByqMbgY2phykwR8"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-yellow-300 text-sm mb-6 hover:text-yellow-200 underline underline-offset-2"
      >
        Full step-by-step setup guide (opens in a new tab) →
      </a>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-400 text-sm mb-4">{success}</p>}

      {loading ? (
        <p className="text-white/50">Loading…</p>
      ) : (
        <>
          <SupernovaGlowCard className="mb-8">
            <h2 className="text-yellow-300 font-bold text-xl mb-3">Why bring your own key?</h2>
            <ul className="text-white/70 space-y-2 text-sm">
              <li>• Your emails send from your own domain — better trust and deliverability than a shared platform address.</li>
              <li>• You pay your own SendGrid bill directly — no per-email cost from FlipPilot.</li>
              <li>• One dealer's spammy sending can't hurt another dealer's reputation — everyone sends on their own account.</li>
            </ul>
            <p className="text-white/50 text-xs mt-3">
              Nothing sends automatically yet — this only connects the account. Bulk messaging (stock alerts, dealer
              lists) is a separate feature, and will only ever message customers who've genuinely opted in.
            </p>
          </SupernovaGlowCard>

          {status?.connected ? (
            <SupernovaGlowCard className="mb-8">
              <h2 className="text-yellow-300 font-bold text-xl mb-3">Connected</h2>
              <p className="text-white/70 text-sm mb-1">Provider: SendGrid</p>
              <p className="text-white/70 text-sm mb-1">From: {status.fromName} &lt;{status.fromEmail}&gt;</p>
              <p className="text-white/70 text-sm mb-1">API key: {status.maskedKey}</p>
              <p className="text-white/50 text-xs mb-4">
                Connected by {status.connectedByName} on {status.connectedAt ? new Date(status.connectedAt).toLocaleString() : ""}
              </p>

              <div className="flex gap-2 items-end flex-wrap mb-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-white/60 text-sm">Send a test email to</label>
                  <input className={inputClass} value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" style={{ marginBottom: 0 }} />
                </div>
                <SupernovaGlowButton label={testing ? "Sending…" : "Send Test"} onClick={handleTest} disabled={testing || !isOwner} />
              </div>

              {isOwner && (
                <button onClick={handleDisconnect} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 text-sm">
                  Disconnect
                </button>
              )}
            </SupernovaGlowCard>
          ) : !isOwner ? (
            <SupernovaGlowCard>
              <p className="text-white/60">Only the dealership owner can connect email sending.</p>
            </SupernovaGlowCard>
          ) : (
            <>
              <SupernovaGlowCard className="mb-8">
                <h2 className="text-yellow-300 font-bold text-xl mb-3">How to get a real SendGrid API key</h2>
                <ol className="text-white/70 space-y-2 text-sm list-decimal list-inside">
                  <li>Create a free account at <span className="text-yellow-200">sendgrid.com</span> (100 emails/day free, forever).</li>
                  <li>Under Settings → Sender Authentication, verify a single sender — use a real email address you can receive mail at (e.g. sales@yourdealership.co.uk). SendGrid will email you a confirmation link.</li>
                  <li>Under Settings → API Keys, create a new key with "Mail Send" permission only (restricted access, not full access).</li>
                  <li>Copy the key — SendGrid only shows it once — and paste it below.</li>
                </ol>
              </SupernovaGlowCard>

              <SupernovaGlowCard>
                <h2 className="text-yellow-300 font-bold text-xl mb-3">Connect your account</h2>
                <label className="text-white/60 text-sm">SendGrid API Key</label>
                <input className={inputClass} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="SG...." />

                <label className="text-white/60 text-sm">From Email (must be the sender you verified in SendGrid)</label>
                <input className={inputClass} value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="sales@yourdealership.co.uk" />

                <label className="text-white/60 text-sm">From Name</label>
                <input className={inputClass} value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Your Dealership Name" />

                <SupernovaGlowButton label={saving ? "Connecting…" : "Connect"} onClick={handleSave} disabled={saving} />
              </SupernovaGlowCard>
            </>
          )}
        </>
      )}
    </div>
  );
}
