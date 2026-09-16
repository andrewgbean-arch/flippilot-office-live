import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { TOUR_STEPS, type TourStep } from "./tourSteps";
import { TourOverlay } from "./TourOverlay";

function resolveRoute(step: TourStep, firstVehicleId: string | null): string | null {
  return typeof step.route === "function" ? step.route({ firstVehicleId }) : step.route;
}

function seenKey(userId: string) {
  return `flippilot_tour_seen_${userId}`;
}

// A rough words-per-minute estimate used only as a safety-net timer —
// some browsers/voices never fire SpeechSynthesisUtterance's onend
// event reliably, so a voice-only tour that waited on it alone could
// get stuck on one step forever. The real advance still happens on
// onend when it does fire; this just guarantees it can't hang.
// Deliberately conservative (110wpm, not a natural-speech-rate 150) —
// confirmed live that real TTS narration for a handful of steps ran
// longer than a 150wpm estimate predicted, so this timer occasionally
// won the race against the real onend and cut the last word or two
// off mid-sentence. Erring toward "fires a little late" is the safe
// direction, since onend still advances immediately the moment real
// speech actually finishes — this timer firing early is the only way
// to audibly cut narration short.
function estimateSpeechMs(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3000, (words / 110) * 60 * 1000 + 2000);
}

interface TourContextType {
  isActive: boolean;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  // null = not yet answered (the "Do you have sound?" prompt is showing)
  hasSound: boolean | null;
  startTour: () => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  answerSoundPrompt: (hasSound: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vehicles } = useInventory();
  const location = useLocation();
  const navigate = useNavigate();

  const firstVehicleId = vehicles[0]?.id ?? null;

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSound, setHasSound] = useState<boolean | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const autoStartChecked = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const step = isActive && hasSound !== null ? TOUR_STEPS[stepIndex] ?? null : null;

  function clearAdvanceTimer() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  const stopSpeaking = useCallback(() => {
    clearAdvanceTimer();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function markSeen() {
    const id = userIdRef.current;
    if (id) localStorage.setItem(seenKey(id), "1");
  }

  const startTour = useCallback(() => {
    setStepIndex(0);
    setHasSound(null);
    setIsActive(true);
  }, []);

  const stopTour = useCallback(() => {
    stopSpeaking();
    setIsActive(false);
    setHasSound(null);
    setTargetRect(null);
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const nextStep = useCallback(() => {
    clearAdvanceTimer();
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
    clearAdvanceTimer();
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Answering the prompt is what actually kicks the walkthrough off —
  // nothing navigates or speaks before this, so a dealer who hasn't
  // decided yet isn't hearing narration for a step they can't see the
  // point of.
  const answerSoundPrompt = useCallback((sound: boolean) => {
    setHasSound(sound);
  }, []);

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

  // Drives navigation, narration, and (in voice-only mode) auto-advance
  // for the active step — runs whenever the step changes or the sound
  // preference is answered, not on every render.
  useEffect(() => {
    if (!isActive || hasSound === null || !step) return;

    const resolvedRoute = resolveRoute(step, firstVehicleId);
    if (resolvedRoute === null) {
      // e.g. the vehicle-record step with no vehicle in stock yet to
      // show — skip straight past it rather than navigating nowhere.
      nextStep();
      return;
    }

    if (location.pathname !== resolvedRoute) {
      navigate(resolvedRoute);
    }

    if (!hasSound) return; // card + manual buttons, no narration

    if (!("speechSynthesis" in window)) {
      // No speech support at all despite asking for sound — still flow
      // item to item rather than silently freezing on step one forever.
      advanceTimer.current = setTimeout(nextStep, estimateSpeechMs(step.narration));
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(step.narration);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => {
      // Clear the safety-net timer below before replacing it — otherwise
      // its id just gets overwritten here while it's still scheduled,
      // and it fires again later on its own, advancing an extra step.
      clearAdvanceTimer();
      advanceTimer.current = setTimeout(nextStep, 400);
    };
    // Some browsers never fire onend for a given voice/utterance — this
    // guarantees the tour still moves on rather than hanging on one
    // step indefinitely.
    advanceTimer.current = setTimeout(nextStep, estimateSpeechMs(step.narration) + 2500);
    window.speechSynthesis.speak(utter);

    return () => {
      window.speechSynthesis.cancel();
      clearAdvanceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hasSound, step?.id, firstVehicleId]);

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
        targetRect,
        hasSound,
        startTour,
        stopTour,
        nextStep,
        prevStep,
        answerSoundPrompt,
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
