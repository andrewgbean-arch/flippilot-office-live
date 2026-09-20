import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { BASE_URL } from "@/lib/apiBaseUrl";

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to reset password.");
        return;
      }
      setSuccess(true);
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
          <h1 className="text-2xl font-bold text-yellow-300">Set a new password</h1>
        </div>

        {success ? (
          <>
            <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 mb-4">
              Password reset — you can sign in with it now.
            </p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
            >
              Go to Sign In
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label htmlFor="reset-new-password" className="text-white/70 text-sm block mb-1">New Password</label>
              <input
                id="reset-new-password"
                name="newPassword"
                autoComplete="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm-new-password" className="text-white/70 text-sm block mb-1">Confirm New Password</label>
              <input
                id="reset-confirm-new-password"
                name="confirmPassword"
                autoComplete="new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {submitting ? "Resetting…" : "Reset Password"}
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
