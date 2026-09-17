import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { InstallAppBanner } from "@/components/InstallAppBanner";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login(email, password);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-black text-white px-6">
      <InstallAppBanner />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-black/40 border border-yellow-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_30px_rgba(255,215,0,0.15)] space-y-5"
      >
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-yellow-300">FlipPilot Dealer OS</h1>
          <p className="text-white/60 text-sm mt-1">Sign in to your dealership</p>
        </div>

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
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
          />
        </div>

        <div>
          <label className="text-white/70 text-sm block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>

        <p className="text-center text-white/50 text-sm">
          <Link to="/forgot-password" className="text-yellow-300 hover:underline">
            Forgot password?
          </Link>
        </p>

        <p className="text-center text-white/50 text-sm">
          No account yet?{" "}
          <Link to="/signup" className="text-yellow-300 hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
