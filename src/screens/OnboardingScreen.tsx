import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Shown once, right after signup (SignupScreen navigates here instead
// of straight to the dashboard). There's no persisted "onboarding
// complete" flag anywhere — a returning user just lands on the
// dashboard directly, which is fine for a first pass; adding a stored
// flag is a small follow-up if this ever needs to survive someone
// closing the tab mid-wizard.
export default function OnboardingScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const firstName = user?.name?.split(" ")[0] || "there";

  const steps = [
    {
      title: `Welcome, ${firstName}`,
      body: (
        <>
          <p className="text-white/70 mb-4">
            Your dealership is set up and ready to go. Here's a quick look at
            what FlipPilot Dealer OS does:
          </p>
          <ul className="space-y-2 text-white/70 text-sm">
            <li>🚗 <span className="text-white">Inventory</span> — track every vehicle you buy, recondition, and sell.</li>
            <li>📊 <span className="text-white">Bookkeeping</span> — purchases, costs, sales, and VAT, calculated automatically.</li>
            <li>🧠 <span className="text-white">AI Insights</span> — real pricing, risk, and market signals from your own stock.</li>
            <li>👥 <span className="text-white">Leads</span> — track buyers from first enquiry to sale.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Add your first vehicle",
      body: (
        <>
          <p className="text-white/70 mb-4">
            Everything in FlipPilot — bookkeeping, AI valuations, profit
            tracking — starts with a real vehicle in your inventory. You can
            add one now, or explore first and add it later.
          </p>
          <Link
            to="/new-flip"
            className="inline-block px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
          >
            Add a Vehicle Now
          </Link>
        </>
      ),
    },
    {
      title: "You're all set",
      body: (
        <>
          <p className="text-white/70 mb-4">
            One more thing worth knowing: if you're not working alone, you
            can invite a teammate into this exact dealership — not a
            separate one — from{" "}
            <span className="text-white">Settings → Team</span> once you're in.
          </p>
          <p className="text-white/50 text-sm">
            You're on a 14-day free trial. No card needed until you're ready
            to subscribe.
          </p>
        </>
      ),
    },
  ];

  // step is always kept within [0, steps.length - 1] by the Next/Skip
  // handlers below, so this index access is always in bounds.
  const current = steps[step]!;
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-md bg-black/40 border border-yellow-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_30px_rgba(255,215,0,0.15)]">
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-yellow-400" : "bg-white/10"}`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-yellow-300 mb-4">{current.title}</h1>
        {current.body}

        <div className="flex justify-between items-center mt-8">
          <button
            onClick={() => navigate("/", { replace: true })}
            className="text-white/40 text-sm hover:text-white/70 transition"
          >
            Skip
          </button>

          <button
            onClick={() => {
              if (isLast) {
                navigate("/", { replace: true });
              } else {
                setStep((s) => s + 1);
              }
            }}
            className="px-5 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
          >
            {isLast ? "Go to Dashboard" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
