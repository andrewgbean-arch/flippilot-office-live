import { useEffect, useState } from "react";

// The browser's own "Install app" icon lives in the address bar, easy
// to miss entirely — real feedback from testing this live. Chrome/Edge
// fire `beforeinstallprompt` when a page qualifies (real manifest +
// service worker, see public/manifest.webmanifest and public/sw.js),
// but only if we call preventDefault() and hold onto the event
// ourselves — otherwise the browser shows its own (easy-to-miss) UI
// and this hook never gets a chance to offer a visible button instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // Chrome/Edge only allow a captured prompt to be used once — clear
    // it either way, "dismissed" doesn't mean the user can retry it.
    setDeferredPrompt(null);
  }

  return {
    // Only true once the browser has genuinely offered the prompt —
    // never show an install button that would do nothing on click
    // (Firefox/Safari, or a browser that already has it installed).
    canInstall: deferredPrompt !== null,
    installed,
    promptInstall,
  };
}
