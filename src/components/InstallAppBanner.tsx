import { useInstallPrompt } from "@/lib/useInstallPrompt";

// Renders nothing until the browser has genuinely offered an install
// prompt (see useInstallPrompt) — never a dead button. Deliberately
// its own small component rather than inline in each screen, since
// this shows up on both LoginScreen and SignupScreen.
export function InstallAppBanner() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  if (installed || !canInstall) return null;

  return (
    <div className="w-full max-w-sm bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-yellow-300 text-sm font-semibold">Install to your desktop</p>
        <p className="text-white/50 text-xs">Opens in its own window, no browser tabs needed.</p>
      </div>
      <button
        type="button"
        onClick={promptInstall}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400 transition"
      >
        Install
      </button>
    </div>
  );
}
