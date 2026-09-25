import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { TOUR_CHAPTERS } from "./tourSteps";
import { chaptersFor, nextChapterStart, placeInChapter, planFor, type PlannedStep, type TourChapter } from "./tourPlan";
import { TourOverlay } from "./TourOverlay";

function seenKey(userId: string) {
  return `flippilot_tour_seen_${userId}`;
}

// Wendy's recorded narration for a step (see scripts/record-tour.mjs). A step
// with no recording yet, or a browser that won't play it, falls back to the
// browser's own voice, so the tour always talks when sound is on.
export function narrationUrl(stepId: string): string {
  return `/tour/audio/${stepId}.mp3`;
}

// A safety net for the browser voice only: some browsers never say when they
// have finished speaking, and the tour must not sit on one step for ever. Slow
// on purpose (110 words a minute): firing early is the only way to cut Wendy
// off mid-sentence, and the real "finished" still moves on the moment it comes.
function estimateSpeechMs(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3000, (words / 110) * 60 * 1000 + 2000);
}

// "menu": the start screen / chapter list. "running": walking through steps.
type Phase = "menu" | "running";

interface TourContextType {
  isActive: boolean;
  phase: Phase;
  chapters: TourChapter[]; // what this person is offered
  doneChapters: ReadonlySet<string>;
  current: PlannedStep | null;
  chapter: TourChapter | null;
  chapterNumber: number; // 1-based, among the chapters offered
  place: { at: number; of: number };
  isFirst: boolean;
  isLastOfRun: boolean;
  singleChapter: boolean;
  targetRect: DOMRect | null;
  sound: boolean;
  paused: boolean;
  startTour: () => void;
  stopTour: () => void;
  setSound: (on: boolean) => void;
  runFullTour: () => void;
  runChapter: (chapterId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipSection: () => void;
  showChapters: () => void;
  togglePause: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vehicles } = useInventory();
  const location = useLocation();
  const navigate = useNavigate();

  const firstVehicleId = vehicles[0]?.id ?? null;
  const chapters = useMemo(() => chaptersFor(TOUR_CHAPTERS, user, firstVehicleId), [user, firstVehicleId]);

  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("menu");
  const [plan, setPlan] = useState<PlannedStep[]>([]);
  const [index, setIndex] = useState(0);
  const [singleChapter, setSingleChapter] = useState(false);
  const [doneChapters, setDoneChapters] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(true);
  const [paused, setPaused] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const autoStartChecked = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  // The seen flag must be written for whoever is logged in when the tour
  // ends, not whoever was when a callback was made (user starts null and
  // arrives after /auth/me). Caught live once: the flag never got written.
  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const current = phase === "running" ? plan[index] ?? null : null;

  const silence = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function markSeen() {
    const id = userIdRef.current;
    try {
      if (id) localStorage.setItem(seenKey(id), "1");
    } catch {
      // storage refused: the tour may offer itself again, nothing worse
    }
  }

  const startTour = useCallback(() => {
    silence();
    setPhase("menu");
    setPaused(false);
    setIsActive(true);
  }, [silence]);

  const stopTour = useCallback(() => {
    silence();
    setIsActive(false);
    setPhase("menu");
    setTargetRect(null);
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silence]);

  const run = useCallback(
    (steps: PlannedStep[], single: boolean) => {
      silence();
      if (steps.length === 0) return;
      setPlan(steps);
      setIndex(0);
      setSingleChapter(single);
      setPaused(false);
      setPhase("running");
    },
    [silence]
  );

  const runFullTour = useCallback(() => run(planFor(TOUR_CHAPTERS, user, firstVehicleId), false), [run, user, firstVehicleId]);
  const runChapter = useCallback(
    (chapterId: string) => run(planFor(TOUR_CHAPTERS, user, firstVehicleId, chapterId), true),
    [run, user, firstVehicleId]
  );

  const showChapters = useCallback(() => {
    silence();
    setTargetRect(null);
    setPhase("menu");
  }, [silence]);

  // Reaching the end of a run: a single chapter goes back to the chapter list
  // (ticked), the full tour finishes.
  const finishRun = useCallback(() => {
    setDoneChapters(prev => new Set([...prev, ...plan.map(p => p.chapterId)]));
    if (singleChapter) showChapters();
    else stopTour();
  }, [plan, singleChapter, showChapters, stopTour]);

  const goTo = useCallback(
    (i: number) => {
      silence();
      // a chapter the run has moved past is done
      const leaving = plan[index]?.chapterId;
      if (leaving && plan[i]?.chapterId !== leaving) setDoneChapters(prev => new Set([...prev, leaving]));
      setIndex(i);
    },
    [silence, plan, index]
  );

  const nextStep = useCallback(() => {
    if (index + 1 >= plan.length) finishRun();
    else goTo(index + 1);
  }, [index, plan.length, finishRun, goTo]);

  const prevStep = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [index, goTo]);

  const skipSection = useCallback(() => {
    const next = nextChapterStart(plan, index);
    if (next === null) finishRun();
    else goTo(next);
  }, [plan, index, finishRun, goTo]);

  const togglePause = useCallback(() => setPaused(p => !p), []);

  // Shows itself once per person, the first time they land on the dashboard,
  // as the start screen (never straight into talking): they choose the whole
  // tour, a chapter, or to skip it.
  useEffect(() => {
    if (autoStartChecked.current) return;
    if (!user?.id) return;
    if (location.pathname !== "/dealer-dashboard") return;
    autoStartChecked.current = true;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(user.id)) === "1";
    } catch {
      seen = false;
    }
    if (!seen) startTour();
  }, [user?.id, location.pathname, startTour]);

  // The latest nextStep, for the timers below (a timer set during one step
  // must move on from THAT step, whatever has re-rendered since).
  const nextRef = useRef(nextStep);
  useEffect(() => {
    nextRef.current = nextStep;
  }, [nextStep]);

  // Each step: go to its page, then (with sound on and not paused) play
  // Wendy's recording, and move on a moment after she finishes.
  useEffect(() => {
    if (!isActive || !current) return;
    if (location.pathname !== current.route) navigate(current.route);
    if (!sound || paused) return;

    const step = current.step;
    const advance = () => nextRef.current();
    const onDone = () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(advance, 700);
    };
    const speakWithBrowser = () => {
      if (!("speechSynthesis" in window)) {
        advanceTimer.current = setTimeout(advance, estimateSpeechMs(step.narration));
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(step.narration);
      utter.onend = onDone;
      advanceTimer.current = setTimeout(advance, estimateSpeechMs(step.narration) + 2500);
      window.speechSynthesis.speak(utter);
    };

    const player = typeof Audio === "undefined" ? null : new Audio(narrationUrl(step.id));
    if (!player) {
      speakWithBrowser();
    } else {
      audio.current = player;
      player.onended = onDone;
      player.onerror = () => {
        if (audio.current !== player) return;
        audio.current = null;
        speakWithBrowser();
      };
      player.play().catch(() => {
        // autoplay refused or no recording: the browser voice instead
        if (audio.current !== player) return;
        audio.current = null;
        speakWithBrowser();
      });
    }
    return silence;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, current?.step.id, index, sound, paused]);

  // Finds the step's spotlight target once its page has drawn, and keeps the
  // outline on it through scrolling and resizing.
  useEffect(() => {
    if (!isActive || !current || !current.step.target) {
      setTargetRect(null);
      return;
    }
    const target = current.step.target;
    const find = () =>
      document.querySelector(target.startsWith("css:") ? target.slice(4) : `[data-tour="${target}"]`);

    let cancelled = false;
    let attempts = 0;
    function locate() {
      if (cancelled) return;
      const el = find();
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTargetRect(el.getBoundingClientRect());
      } else if (attempts < 40) {
        attempts++;
        requestAnimationFrame(locate);
      } else {
        setTargetRect(null);
      }
    }
    setTargetRect(null);
    requestAnimationFrame(locate);

    function reposition() {
      const el = find();
      if (el) setTargetRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isActive, current?.step.id, location.pathname]);

  useEffect(() => silence, [silence]);

  const chapter = current ? chapters.find(c => c.id === current.chapterId) ?? null : null;
  const chapterNumber = chapter ? chapters.findIndex(c => c.id === chapter.id) + 1 : 0;

  return (
    <TourContext.Provider
      value={{
        isActive,
        phase,
        chapters,
        doneChapters,
        current,
        chapter,
        chapterNumber,
        place: current ? placeInChapter(plan, index) : { at: 0, of: 0 },
        isFirst: index === 0,
        isLastOfRun: index === plan.length - 1,
        singleChapter,
        targetRect,
        sound,
        paused,
        startTour,
        stopTour,
        setSound,
        runFullTour,
        runChapter,
        nextStep,
        prevStep,
        skipSection,
        showChapters,
        togglePause,
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
