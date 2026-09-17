import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { InstallAppBanner } from "@/components/InstallAppBanner";

export default function SignupScreen() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const result = await signup(name, dealershipName, email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate("/onboarding", { replace: true });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-black text-white px-6">
      <InstallAppBanner />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-black/40 border border-yellow-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_30px_rgba(255,215,0,0.15)] space-y-5"
      >
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-yellow-300">Create your account</h1>
          <p className="text-white/60 text-sm mt-1">Set up FlipPilot Dealer OS</p>
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
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none"
          />
        </div>

        <div>
          <label className="text-white/70 text-sm block mb-1">Dealership Name</label>
          <input
            type="text"
            value={dealershipName}
            onChange={e => setDealershipName(e.target.value)}
            required
            placeholder="e.g. Bean Motors"
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-yellow-400/60 outline-none placeholder:text-white/30"
          />
        </div>

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
          {submitting ? "Creating account…" : "Create Account"}
        </button>

        <p className="text-center text-white/40 text-xs">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="text-yellow-300/80 hover:underline">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-yellow-300/80 hover:underline">Privacy Policy</Link>.
        </p>

        <p className="text-center text-white/50 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-yellow-300 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
