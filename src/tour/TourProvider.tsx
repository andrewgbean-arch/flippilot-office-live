import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { TOUR_CHAPTERS } from "./tourSteps";
import { chaptersFor, nextPageStart, pageForPath, placeOnPage, planFor, type PlannedStep, type RunScope, type TourChapter, type TourPage } from "./tourPlan";
import { TourOverlay } from "./TourOverlay";

type CarLike = { id: string; status?: string | null; images?: string[] | null; mot?: { history?: unknown[] | null } | null };

export function showcaseCarId(vehicles: readonly CarLike[]): string | null {
  const inStock = vehicles.filter(v => String(v.status ?? "").toLowerCase() !== "sold");
  const rich = inStock.find(v => (v.images?.length ?? 0) > 1 && (v.mot?.history?.length ?? 0) > 0);
  return (rich ?? inStock.find(v => (v.images?.length ?? 0) > 0) ?? inStock[0] ?? vehicles[0])?.id ?? null;
}

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

// Only something actually on screen counts: the side columns are hidden on a
// phone, and outlining a hidden element would draw a box around nothing.
function shown(el: Element | null | undefined): Element | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? el : null;
}

const norm = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// The card a heading belongs to: the nearest box around it with a border or a
// background of its own, inside the page (never the page itself).
function cardAround(el: Element): Element {
  const main = document.querySelector("main");
  for (let node = el.parentElement; node && node !== main && node !== document.body; node = node.parentElement) {
    const css = getComputedStyle(node);
    const bordered = parseFloat(css.borderTopWidth) > 0 || parseFloat(css.borderLeftWidth) > 0;
    const filled = css.backgroundColor !== "rgba(0, 0, 0, 0)" && css.backgroundColor !== "transparent";
    if ((bordered || filled) && node.children.length > 1) return node;
  }
  return el.parentElement ?? el;
}

// Finds what a stop outlines (see TourStep.target in tourPlan.ts).
export function findTarget(target: string): Element | null {
  if (target.startsWith("css:")) return shown(document.querySelector(target.slice(4)));
  if (target.startsWith("heading:")) {
    const want = norm(target.slice(8));
    const scope = document.querySelector("main") ?? document.body;
    const heading = [...scope.querySelectorAll("h1,h2,h3,h4,.brand-caps,.sn-panel__title")].find(
      h => shown(h) && norm(h.textContent).startsWith(want)
    );
    return heading ? shown(heading.tagName === "H1" ? heading : cardAround(heading)) : null;
  }
  if (target.startsWith("button:")) {
    const want = norm(target.slice(7));
    return shown([...document.querySelectorAll("button,a[href],[role=tab]")].find(b => shown(b) && norm(b.textContent).startsWith(want)));
  }
  return shown(document.querySelector(`[data-tour="${target}"]`));
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
  page: TourPage | null; // the screen being toured
  place: { at: number; of: number }; // the stop, on its screen
  thisPage: TourPage | null; // the screen the person is on now, if it has a tour
  isFirst: boolean;
  isLastOfRun: boolean;
  singleRun: boolean; // one chapter or one screen, rather than everything
  targetRect: DOMRect | null;
  sound: boolean;
  paused: boolean;
  startTour: () => void;
  stopTour: () => void;
  setSound: (on: boolean) => void;
  runFullTour: () => void;
  runChapter: (chapterId: string) => void;
  runPage: (pageId: string) => void;
  tourThisPage: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipPage: () => void;
  showChapters: () => void;
  togglePause: () => void;
  // The browser refused to play sound without a tap (phones, some embedded
  // browsers): the card shows a "Tap to hear Wendy" button.
  soundBlocked: boolean;
  playSound: () => void;
  // With sound on, the card can be hidden so only the gold outline shows while
  // Wendy talks; Space (or a tap on the note) brings it back.
  cardHidden: boolean;
  setCardHidden: (hidden: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { vehicles } = useInventory();
  const location = useLocation();
  const navigate = useNavigate();

  // The car the tour shows off: one still in stock with photos and an MOT
  // record if there is one, so every stop on a car's screens has something
  // to point at; otherwise any car still in stock; otherwise any car.
  const firstVehicleId = useMemo(() => showcaseCarId(vehicles), [vehicles]);
  const chapters = useMemo(() => chaptersFor(TOUR_CHAPTERS, user, firstVehicleId), [user, firstVehicleId]);

  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("menu");
  const [plan, setPlan] = useState<PlannedStep[]>([]);
  const [index, setIndex] = useState(0);
  const [singleRun, setSingleRun] = useState(false);
  const [doneChapters, setDoneChapters] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(true);
  const [paused, setPaused] = useState(false);
  const [cardHidden, setCardHidden] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const autoStartChecked = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ONE player for the whole tour. Browsers only let a page make sound when it
  // starts from a tap: a new player made a moment later (after the screen has
  // moved) is refused, silently on iPhones and in some embedded browsers, and
  // the browser voice is refused the same way. This player is started inside
  // the tap that starts the tour or moves it on, and once it has played it
  // may keep playing.
  const player = useRef<HTMLAudioElement | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

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
    if (player.current) {
      player.current.onended = null;
      player.current.onerror = null;
      player.current.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function getPlayer(): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;
    if (!player.current) player.current = new Audio();
    return player.current;
  }

  // Inside a tap: load this stop's recording and start it at once, which is
  // what lets the browser play sound for the rest of the tour.
  function startNarration(stepId: string | undefined) {
    if (!stepId || !sound) return;
    const audio = getPlayer();
    if (!audio) return;
    audio.src = narrationUrl(stepId);
    audio.dataset.step = stepId;
    audio.play().then(() => setSoundBlocked(false)).catch(() => {});
  }

  function markSeen() {
    const id = userIdRef.current;
    try {
      if (id) localStorage.setItem(seenKey(id), "1");
    } catch {
      // storage refused: the tour may offer itself again, nothing worse
    }
  }

  const startTour = useCallback(() => {
    // opened by hand: the first-visit check below must never fire on top of it
    autoStartChecked.current = true;
    silence();
    setPhase("menu");
    setPaused(false);
    setIsActive(true);
  }, [silence]);

  const stopTour = useCallback(() => {
    silence();
    setCardHidden(false);
    setIsActive(false);
    setPhase("menu");
    setTargetRect(null);
    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silence]);

  const run = useCallback(
    (scope: RunScope) => {
      const steps = planFor(TOUR_CHAPTERS, user, firstVehicleId, scope);
      silence();
      if (steps.length === 0) return;
      autoStartChecked.current = true;
      startNarration(steps[0]!.step.id);
      setPlan(steps);
      setIndex(0);
      setSingleRun(scope.chapterId !== undefined || scope.pageId !== undefined);
      setPaused(false);
      setIsActive(true);
      setPhase("running");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silence, user, firstVehicleId, sound]
  );

  const runFullTour = useCallback(() => run({}), [run]);
  const runChapter = useCallback((chapterId: string) => run({ chapterId }), [run]);
  const runPage = useCallback((pageId: string) => run({ pageId }), [run]);

  // The screen the person is looking at, if the tour covers it.
  const thisPage = useMemo(
    () => pageForPath(TOUR_CHAPTERS, location.pathname, firstVehicleId, user),
    [location.pathname, firstVehicleId, user]
  );

  const tourThisPage = useCallback(() => {
    if (thisPage) runPage(thisPage.id);
    else startTour();
  }, [thisPage, runPage, startTour]);

  const showChapters = useCallback(() => {
    silence();
    setCardHidden(false);
    setTargetRect(null);
    setPhase("menu");
  }, [silence]);

  // Reaching the end of a run: one chapter goes back to the chapter list
  // (ticked); one screen, or the whole tour, just finishes.
  const finishRun = useCallback(() => {
    setDoneChapters(prev => new Set([...prev, ...plan.map(p => p.chapterId)]));
    const oneChapter = singleRun && new Set(plan.map(p => p.pageId)).size > 1;
    if (oneChapter) showChapters();
    else stopTour();
  }, [plan, singleRun, showChapters, stopTour]);

  const goTo = useCallback(
    (i: number) => {
      silence();
      if (!paused) startNarration(plan[i]?.step.id);
      // a chapter the run has moved past is done
      const leaving = plan[index]?.chapterId;
      if (leaving && plan[i]?.chapterId !== leaving) setDoneChapters(prev => new Set([...prev, leaving]));
      setIndex(i);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silence, plan, index, paused, sound]
  );

  const nextStep = useCallback(() => {
    if (index + 1 >= plan.length) finishRun();
    else goTo(index + 1);
  }, [index, plan.length, finishRun, goTo]);

  const prevStep = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [index, goTo]);

  const skipPage = useCallback(() => {
    const next = nextPageStart(plan, index);
    if (next === null) finishRun();
    else goTo(next);
  }, [plan, index, finishRun, goTo]);

  const togglePause = useCallback(() => {
    // carrying on is a tap too: start the sound inside it
    if (paused && sound && player.current) player.current.play().then(() => setSoundBlocked(false)).catch(() => {});
    setPaused(p => !p);
  }, [paused, sound]);

  const playSound = useCallback(() => {
    const audio = getPlayer();
    const stepId = plan[index]?.step.id;
    if (!audio || !stepId) return;
    if (audio.dataset.step !== stepId) {
      audio.src = narrationUrl(stepId);
      audio.dataset.step = stepId;
    }
    setPaused(false);
    audio.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, index]);

  // Shows itself once per person, the first time they land on the dashboard,
  // as the start screen (never straight into talking): they choose the whole
  // tour, a chapter, or to skip it.
  useEffect(() => {
    if (autoStartChecked.current) return;
    if (!user?.id) return;
    // A tour already open (started from Settings, say) walks onto the
    // dashboard for its first step: that is not a first visit, and must not
    // throw them back to the start screen.
    if (isActive) {
      autoStartChecked.current = true;
      return;
    }
    if (location.pathname !== "/dealer-dashboard") return;
    autoStartChecked.current = true;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(user.id)) === "1";
    } catch {
      seen = false;
    }
    if (!seen) startTour();
  }, [user?.id, location.pathname, startTour, isActive]);

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

    const audio = getPlayer();
    if (!audio) {
      speakWithBrowser();
      return silence;
    }
    if (audio.dataset.step !== step.id) {
      audio.src = narrationUrl(step.id);
      audio.dataset.step = step.id;
    }
    let live = true;
    audio.onended = onDone;
    // No recording for this stop (a line added since the last recording):
    // the browser's voice reads it instead.
    audio.onerror = () => {
      if (live) speakWithBrowser();
    };
    audio
      .play()
      .then(() => live && setSoundBlocked(false))
      .catch((err: unknown) => {
        if (!live) return;
        // Refused without a tap: say so on the card rather than going quiet
        // (the browser voice would be refused the same way).
        if (err instanceof DOMException && err.name === "NotAllowedError") setSoundBlocked(true);
      });
    return () => {
      live = false;
      silence();
    };
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
    const find = () => findTarget(target);

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

  useEffect(() => {
    if (!sound) setCardHidden(false);
  }, [sound]);

  // Space brings a hidden card back, unless someone is typing in a box.
  useEffect(() => {
    if (!isActive || !cardHidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setCardHidden(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, cardHidden]);

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
        page: current ? chapter?.pages.find(p => p.id === current.pageId) ?? null : null,
        place: current ? placeOnPage(plan, index) : { at: 0, of: 0 },
        thisPage,
        isFirst: index === 0,
        isLastOfRun: index === plan.length - 1,
        singleRun,
        targetRect,
        sound,
        paused,
        startTour,
        stopTour,
        setSound,
        runFullTour,
        runChapter,
        runPage,
        tourThisPage,
        nextStep,
        prevStep,
        skipPage,
        showChapters,
        togglePause,
        soundBlocked,
        playSound,
        cardHidden,
        setCardHidden,
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
