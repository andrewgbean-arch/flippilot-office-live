import { InstallHintCard } from "@/pwa/InstallHint";
import type { InstallHintKind } from "@/pwa/installHintRules";

// Shown after an invited person has created their login, when there is
// something to offer them: on a phone or tablet, the chance to put FlipPilot on
// the home screen. (On a computer, or where it is already installed, they go
// straight in and never see this.)
export default function JoinSuccessStep({
  dealershipName,
  hint,
  onInstall,
  onDismissHint,
  onContinue,
}: {
  dealershipName: string;
  hint: InstallHintKind;
  onInstall: () => void;
  onDismissHint: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="text-center space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-yellow-300">
          {dealershipName ? `You're in — welcome to ${dealershipName}` : "You're in — welcome"}
        </h1>
        <p className="text-white/60 text-sm mt-1">Your login is ready.</p>
      </div>

      {hint !== "none" && <InstallHintCard kind={hint} onInstall={onInstall} onDismiss={onDismissHint} />}

      <button
        type="button"
        onClick={onContinue}
        className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
      >
        Continue to FlipPilot
      </button>
    </div>
  );
}
