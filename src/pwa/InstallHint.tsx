import { useCallback, useState, useSyncExternalStore } from "react";
import { FiX } from "react-icons/fi";

import {
  INSTALL_BUTTON_LABEL,
  INSTALL_HINT_TEXT,
  INSTALL_HINT_TITLE,
  IOS_INSTALL_STEPS,
  decideInstallHint,
  installHintDismissal,
  readBrowserInstallState,
  type InstallHintKind,
} from "./installHintRules";
import { installPromptStore } from "./installPromptStore";

// A small, dismissible card that helps someone put FlipPilot on their phone's
// home screen. Who sees it, and when, is decided in installHintRules.ts.

export type ShownInstallHint = Exclude<InstallHintKind, "none">;

// Just the card. Kept apart from the browser reading so it can be shown (and
// tested) for either kind.
export function InstallHintCard({
  kind,
  onInstall,
  onDismiss,
}: {
  kind: ShownInstallHint;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-label="Install FlipPilot"
      className="relative bg-black/40 border border-yellow-400/30 rounded-xl p-3 pr-10 text-left"
    >
      <p className="text-yellow-200 text-sm font-semibold">{INSTALL_HINT_TITLE}</p>
      <p className="text-white/60 text-xs mt-0.5">{INSTALL_HINT_TEXT}</p>

      {kind === "install-button" ? (
        <button
          type="button"
          onClick={onInstall}
          className="mt-2 px-3 py-1.5 rounded bg-yellow-400 text-black text-sm font-semibold hover:bg-yellow-300"
        >
          {INSTALL_BUTTON_LABEL}
        </button>
      ) : (
        <ol className="mt-2 text-white/80 text-xs space-y-1 list-decimal list-inside">
          {IOS_INSTALL_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10"
      >
        <FiX size={16} />
      </button>
    </section>
  );
}

// Reads the browser once, follows the install prompt as it arrives, and
// remembers a dismissal.
export function useInstallHint(): { kind: InstallHintKind; install: () => void; dismiss: () => void } {
  const installPromptAvailable = useSyncExternalStore(
    installPromptStore.subscribe,
    installPromptStore.isAvailable,
    () => false
  );
  const [browser] = useState(() => readBrowserInstallState());
  const [dismissed, setDismissed] = useState(() => installHintDismissal.isDismissed());

  const dismiss = useCallback(() => {
    installHintDismissal.dismiss();
    setDismissed(true);
  }, []);

  const install = useCallback(() => {
    // Installed, or turned down in the browser's own dialog: either way the
    // question has been asked, so the card goes. (If the dialog could not be
    // opened the prompt is spent and the card disappears by itself.)
    void installPromptStore.prompt().then((outcome) => {
      if (outcome !== "unavailable") dismiss();
    });
  }, [dismiss]);

  const kind = decideInstallHint({
    env: browser.env,
    standalone: browser.standalone,
    dismissed,
    installPromptAvailable,
  });
  return { kind, install, dismiss };
}

// The card as the dashboard uses it: nothing at all unless it should show.
export default function InstallHint({ className = "" }: { className?: string }) {
  const { kind, install, dismiss } = useInstallHint();
  if (kind === "none") return null;
  return (
    <div className={className}>
      <InstallHintCard kind={kind} onInstall={install} onDismiss={dismiss} />
    </div>
  );
}
