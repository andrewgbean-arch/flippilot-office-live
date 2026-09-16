import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { TOUR_STEPS, type TourStep } from "./tourSteps";
import { TourOverlay } from "./TourOverlay";

function seenKey(userId: string) {
  return `flippilot_tour_seen_${userId}`;
}

interface TourContextType {
  isActive: boolean;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  muted: boolean;
  targetRect: DOMRect | null;
  startTour: () => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  toggleMuted: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Muted defaults on for anyone who's ever muted before, on this
  // browser — a dealer who mutes it once during the tour shouldn't
  // have to re-mute on every re-trigger.
  const [muted, setMuted] = useState(() => localStorage.getItem("flippilot_tour_muted") === "1");
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const autoStartChecked = useRef(false);

  // stopTour/nextStep are memoized (so they're stable to pass around as
  // callbacks) but still need to read whichever user is CURRENTLY
  // logged in when they're actually called, not whichever user existed
  // when the callback was first created — user starts null and only
  // resolves after the async /auth/me call, so a callback that closed
  // over `user` directly from its own dependency array would silently
  // keep using that first, empty value forever. Caught live: the seen
  // flag never actually got written, so skipping/finishing the tour
  // didn't stop it re-starting on the next reload.
  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const step = isActive ? TOUR_STEPS[stepIndex] ?? null : null;

  // Speaks the current step's narration via the browser's own
  // text-to-speech (Web Speech API) — real, immediate, no external
  // voice service or API key needed, unlike this app's other AI
  // integrations. Cancels any in-flight utterance first so steps
  // never talk over each other if someone clicks Next quickly.
  const speak = useCallback((text: string) => {
    if (muted) return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }, [muted]);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function markSeen() {
    const id = userIdRef.current;
    if (id) localStorage.setItem(seenKey(id), "1");
  }

  const startTour = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const stopTour = useCallback(() => {
    stopSpeaking();
    setIsActive(false);
    setTargetRect(null);
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TOUR_STEPS.length) {
        stopTour();
        return i;
      }
      return i + 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTour]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("flippilot_tour_muted", next ? "1" : "0");
      if (next) stopSpeaking();
      return next;
    });
  }, [stopSpeaking]);

  // Auto-start once per real user, the first time they land on the
  // real dashboard — never re-fires once they've seen it (or skipped
  // it) on this browser. Per-browser rather than a real backend field:
  // a new staff member on a different device seeing it again once more
  // is a fine trade-off for not needing a backend change just to track
  // "has seen the tour".
  useEffect(() => {
    if (autoStartChecked.current) return;
    if (!user?.id) return;
    if (location.pathname !== "/dealer-dashboard") return;
    autoStartChecked.current = true;
    const seen = localStorage.getItem(seenKey(user.id)) === "1";
    if (!seen) startTour();
  }, [user?.id, location.pathname, startTour]);

  // Drives navigation for the active step, and speaks its narration —
  // runs whenever the step changes, not on every render.
  useEffect(() => {
    if (!isActive || !step) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
    speak(step.narration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, step?.id]);

  // Finds the current step's real target element after navigation.
  // The destination page may not have finished mounting the instant
  // navigate() resolves, so this polls briefly rather than assuming
  // the element exists on the very next render.
  useEffect(() => {
    if (!isActive || !step) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    function locate() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step!.target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (attempts < 20) {
        attempts++;
        requestAnimationFrame(locate);
      } else {
        setTargetRect(null);
      }
    }

    setTargetRect(null);
    requestAnimationFrame(locate);

    // Keeps the spotlight aligned with its target through layout
    // shifts (a card loading in above it, a window resize) while the
    // step is active, rather than freezing at a now-stale position.
    function reposition() {
      const el = document.querySelector(`[data-tour="${step!.target}"]`);
      if (el) setTargetRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isActive, step?.id, location.pathname]);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        step,
        stepIndex,
        totalSteps: TOUR_STEPS.length,
        muted,
        targetRect,
        startTour,
        stopTour,
        nextStep,
        prevStep,
        toggleMuted,
      }}
    >
      {children}
      <TourOverlay />
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}
