// No real email provider is configured for this app yet — same "not
// activated, but wired for real" state Stripe billing was left in
// earlier. When RESEND_API_KEY is set, this sends a real email via
// Resend's HTTP API (no SDK needed, just a fetch call). Until then it
// logs the email to the backend console instead of silently doing
// nothing, so password reset/invite flows stay fully testable without
// needing a real email account.
//
// process.env is read at call time, not at module load — see the
// house rule at the top of auth.ts about why that matters here.
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "FlipPilot Dealer OS <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `\n📧 [DEV MODE — no RESEND_API_KEY set, email not actually sent]\nTo: ${to}\nSubject: ${subject}\n${body}\n`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    if (!res.ok) {
      console.error(`sendEmail: Resend API returned ${res.status}`, await res.text());
    }
  } catch (err) {
    console.error("sendEmail: failed to reach Resend", err);
  }
}
