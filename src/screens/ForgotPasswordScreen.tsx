import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { BASE_URL } from "@/lib/apiBaseUrl";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setMessage(data.message);
      setDevResetLink(data.devResetLink ?? null);
    } catch {
      setError("Couldn't reach the server — is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-sm bg-black/40 border border-yellow-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_30px_rgba(255,215,0,0.15)]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-yellow-300">Reset your password</h1>
          <p className="text-white/60 text-sm mt-1">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {message ? (
          <>
            <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 mb-4">
              {message}
            </p>

            {devResetLink && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-3 mb-4">
                <p className="text-yellow-300 text-xs font-semibold mb-1">
                  DEV MODE — no email provider configured, here's the link directly:
                </p>
                <Link to={devResetLink.replace(window.location.origin, "")} className="text-yellow-200 text-xs break-all hover:underline">
                  {devResetLink}
                </Link>
              </div>
            )}

            <p className="text-center text-white/50 text-sm">
              <Link to="/login" className="text-yellow-300 hover:underline">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="text-white/70 text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>

            <p className="text-center text-white/50 text-sm">
              <Link to="/login" className="text-yellow-300 hover:underline">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
