import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = "http://localhost:4001";

export default function JoinScreen() {
  const { joinDealership } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [dealershipName, setDealershipName] = useState<string | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("This invite link is missing a token.");
      setCheckingInvite(false);
      return;
    }

    fetch(`${BASE_URL}/auth/invite/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setDealershipName(data.dealershipName);
          setStaffRole(data.staffRole ?? null);
          if (data.inviteeName) {
            setGreetingName(data.inviteeName);
            setName(data.inviteeName);
          }
        } else {
          setInviteError(data.error || "This invite link is invalid or has expired.");
        }
      })
      .catch(() => setInviteError("Couldn't reach the server — is the backend running?"))
      .finally(() => setCheckingInvite(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const result = await joinDealership(token, name, email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-sm bg-black/40 border border-yellow-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_30px_rgba(255,215,0,0.15)]">

        {checkingInvite ? (
          <p className="text-white/60 text-center">Checking invite link…</p>
        ) : inviteError ? (
          <>
            <h1 className="text-xl font-bold text-red-300 text-center mb-3">Invite Link Invalid</h1>
            <p className="text-white/60 text-sm text-center mb-4">{inviteError}</p>
            <p className="text-center text-white/50 text-sm">
              <Link to="/login" className="text-yellow-300 hover:underline">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-2">
              <h1 className="text-2xl font-bold text-yellow-300">
                {greetingName ? `Hi ${greetingName}, join ${dealershipName}` : `Join ${dealershipName}`}
              </h1>
              <p className="text-white/60 text-sm mt-1">Create your account to get started</p>
              {staffRole && (
                <p className="text-white/40 text-xs mt-2">
                  You're being added as: <span className="text-yellow-300/80 capitalize">{staffRole}</span>
                </p>
              )}
            </div>

            {error && (
              <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="text-white/70 text-sm block mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
              />
            </div>

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

            <div>
              <label className="text-white/70 text-sm block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
              />
              <p className="text-white/40 text-xs mt-1">At least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
            >
              {submitting ? "Joining…" : "Join Dealership"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
