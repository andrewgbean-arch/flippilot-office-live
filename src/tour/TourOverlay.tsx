import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FiCheck, FiChevronRight, FiEyeOff, FiMove, FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useTour } from "./TourProvider";
import type { TourChapter } from "./tourPlan";

const PADDING = 8;

// Roughly how long Wendy takes to read it, for the start screen.
const stepsOf = (chapter: TourChapter) => chapter.pages.flatMap(p => p.steps);
export function minutesFor(chapters: readonly TourChapter[]): number {
  const steps = chapters.flatMap(stepsOf);
  const words = steps.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 150 + steps.length * 0.02));
}

const gold = "bg-yellow-400 text-black hover:bg-yellow-300";
const quiet = "bg-white/10 text-white/85 hover:bg-white/20";

export function TourOverlay() {
  const tour = useTour();
  const { user } = useAuth();

  // Where the person dragged the card to (null: its usual place beside the
  // outlined part). It stays there for the rest of the tour, and a
  // double-click on its handle puts it back.
  const [dragged, setDragged] = useState<{ x: number; y: number } | null>(null);
  const grip = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => {
    if (!tour.isActive) setDragged(null);
  }, [tour.isActive]);

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return; // the handle's own buttons still click
    const card = (e.currentTarget.closest('[role="dialog"]') as HTMLElement | null)?.getBoundingClientRect();
    if (!card) return;
    grip.current = { dx: e.clientX - card.left, dy: e.clientY - card.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!grip.current) return;
    // kept on screen: at least 60px of the card stays reachable
    const x = Math.min(Math.max(e.clientX - grip.current.dx, 8), window.innerWidth - 60);
    const y = Math.min(Math.max(e.clientY - grip.current.dy, 8), window.innerHeight - 60);
    setDragged({ x, y });
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    grip.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  if (!tour.isActive) return null;

  // ---- the start screen: sound, the whole tour, or one chapter -------------
  if (tour.phase === "menu") {
    const firstName = (user?.name ?? "").trim().split(/\s+/)[0];
    const anyDone = tour.doneChapters.size > 0;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="tour-menu-title">
        <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-yellow-400/50 bg-[#0A1128] text-white shadow-[0_0_40px_rgba(255,215,0,0.35)]">
          <div className="px-5 pt-5 sm:px-6">
            <p className="brand-caps text-[11px]">GUIDED TOUR</p>
            <h2 id="tour-menu-title" className="mt-1 text-xl font-bold text-yellow-300">
              {anyDone ? "Pick another chapter" : `Welcome${firstName ? `, ${firstName}` : ""}. Let Wendy show you around`}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Watch it all, or pick just the part you need. You can skip a section or stop at any point, and come back any
              time from Settings → Take the Tour.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sound">
              <button
                role="radio"
                aria-checked={tour.sound}
                onClick={() => tour.setSound(true)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${tour.sound ? gold : quiet}`}
              >
                <FiVolume2 aria-hidden /> Wendy talks me through
              </button>
              <button
                role="radio"
                aria-checked={!tour.sound}
                onClick={() => tour.setSound(false)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${!tour.sound ? gold : quiet}`}
              >
                <FiVolumeX aria-hidden /> Just the words
              </button>
            </div>

            <button onClick={tour.runFullTour} className={`mt-3 w-full rounded-lg px-4 py-3 text-base font-bold transition ${gold}`}>
              Take the full tour · about {minutesFor(tour.chapters)} minutes
            </button>

            <label htmlFor="tour-pick-screen" className="mt-3 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Or tour one screen
            </label>
            <select
              id="tour-pick-screen"
              value=""
              onChange={e => e.target.value && tour.runPage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white"
            >
              <option value="">Pick a screen…</option>
              {tour.chapters.map(chapter => (
                <optgroup key={chapter.id} label={chapter.title}>
                  {chapter.pages.map(page => (
                    <option key={page.id} value={page.id}>
                      {page.title} · {page.steps.length} {page.steps.length === 1 ? "stop" : "stops"}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <p className="mt-4 px-5 text-xs font-semibold uppercase tracking-wider text-white/50 sm:px-6">Or watch a chapter</p>
          <ol className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3 sm:px-4">
            {tour.chapters.map((chapter, i) => {
              const done = tour.doneChapters.has(chapter.id);
              return (
                <li key={chapter.id}>
                  <button
                    onClick={() => tour.runChapter(chapter.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-yellow-400/60 hover:bg-yellow-400/10"
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-green-500 text-black" : "bg-yellow-400/15 text-yellow-300"}`}
                      aria-hidden
                    >
                      {done ? <FiCheck /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">
                        {chapter.title}
                        {done && <span className="sr-only"> (watched)</span>}
                      </span>
                      <span className="block text-xs text-white/60">{chapter.blurb}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/50">{chapter.pages.length} {chapter.pages.length === 1 ? "screen" : "screens"}</span>
                    <FiChevronRight className="shrink-0 text-yellow-300" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 sm:px-6">
            <span className="text-xs text-white/50">Settings → Take the Tour brings this back.</span>
            <button onClick={tour.stopTour} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10">
              {anyDone ? "Done" : "Skip tour"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = tour.current;
  if (!current) return null;
  const { step } = current;

  // ---- a step: the gold outline on the real thing, and the card -------------
  const rect = tour.targetRect;
  const spotlightStyle: CSSProperties = rect
    ? {
        position: "fixed",
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
        borderRadius: 12,
        border: "3px solid #FFD700",
        // an outline only, no dark scrim: the rest of the app stays as it is
        boxShadow: "0 0 20px rgba(255,215,0,0.6)",
        pointerEvents: "none",
        zIndex: 9998,
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
      }
    : { display: "none" };

  // Phones: the card is a sheet along the bottom. Wider screens: beside the
  // highlighted thing, never partly off the screen (a card is position: fixed,
  // so page scroll can't bring a hidden Next button back).
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const phone = viewportW < 640;
  const cardWidth = Math.min(380, viewportW - 32);
  const CARD_BUDGET = 300;
  const EDGE = 16;
  let cardStyle: CSSProperties;
  if (phone) {
    cardStyle = { position: "fixed", left: 8, right: 8, bottom: 8, zIndex: 9999, maxHeight: "60vh", overflowY: "auto" };
  } else if (rect) {
    const placeBelow = viewportH - rect.bottom > CARD_BUDGET || rect.top < CARD_BUDGET;
    const left = Math.min(Math.max(rect.left, EDGE), viewportW - cardWidth - EDGE);
    cardStyle = placeBelow
      ? { position: "fixed", top: Math.min(rect.bottom + PADDING + 12, viewportH - CARD_BUDGET - EDGE), left, width: cardWidth, zIndex: 9999 }
      : { position: "fixed", bottom: Math.max(viewportH - (rect.top - PADDING - 12), EDGE), left, width: cardWidth, zIndex: 9999 };
    cardStyle.maxHeight = viewportH - EDGE * 2;
    cardStyle.overflowY = "auto";
  } else {
    cardStyle = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardWidth, zIndex: 9999 };
  }
  if (dragged) {
    cardStyle = { position: "fixed", left: dragged.x, top: dragged.y, width: cardWidth, zIndex: 9999, maxHeight: viewportH - dragged.y - 8, overflowY: "auto" };
  }

  const endLabel = tour.isLastOfRun ? "Finish" : "Next";

  // Card hidden (sound on): just the outline, and a small note to bring the
  // card back. The note is a button too, for phones with no Space bar.
  if (tour.sound && tour.cardHidden) {
    return (
      <>
        <div style={spotlightStyle} aria-hidden />
        <div className="fixed bottom-24 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full border border-yellow-400/60 bg-[#0A1128]/95 px-2 py-1.5 shadow-[0_0_20px_rgba(255,215,0,0.35)]">
          <button
            onClick={() => tour.setCardHidden(false)}
            className="rounded-full px-3 py-1 text-sm font-semibold text-yellow-300 hover:bg-yellow-400/10"
          >
            Press <kbd className="rounded border border-yellow-400/60 px-1.5 text-xs">Space</kbd> or tap here to bring the card back
          </button>
          {tour.soundBlocked && (
            <button onClick={tour.playSound} className="rounded-full bg-yellow-400 px-3 py-1 text-sm font-bold text-black">
              Tap to hear Wendy
            </button>
          )}
          <button onClick={tour.stopTour} className="rounded-full px-3 py-1 text-sm text-white/70 hover:text-white">
            Skip tour
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={spotlightStyle} aria-hidden />
      <div style={cardStyle} role="dialog" aria-label={`Tour: ${step.title}`}>
        <div className="rounded-xl border border-yellow-400/50 bg-[#0A1128] p-4 text-white shadow-[0_0_30px_rgba(255,215,0,0.35)] sm:p-5">
          <div
            className="-mx-2 -mt-2 mb-2 flex cursor-move touch-none select-none items-center justify-between gap-3 rounded-lg px-2 pt-2 text-xs font-semibold"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setDragged(null)}
            title="Drag to move the card; double-click to put it back"
          >
            <span className="truncate uppercase tracking-wide text-yellow-300/80">
              <FiMove aria-hidden className="mr-1.5 inline align-[-2px] text-yellow-300/60" />
              {tour.singleRun && tour.page && !tour.chapter?.pages.some(p => p.id !== tour.page!.id) ? "" : `Chapter ${tour.chapterNumber} · `}
              {tour.page?.title}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-white/50">
              {tour.place.at} of {tour.place.of}
              {tour.sound && (
                <button
                  onClick={() => tour.setCardHidden(true)}
                  title="Hide the card while Wendy talks (Space brings it back)"
                  className="flex items-center gap-1 rounded-md border border-white/20 px-2 py-0.5 text-white/80 hover:border-yellow-400/60 hover:text-yellow-300"
                >
                  <FiEyeOff aria-hidden /> Hide card
                </button>
              )}
            </span>
          </div>

          {tour.sound && tour.soundBlocked && (
            <button
              onClick={tour.playSound}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-300"
            >
              <FiVolume2 aria-hidden /> Tap to hear Wendy
            </button>
          )}
          <h3 className="mb-1.5 text-lg font-bold text-yellow-300">{step.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-white/85" aria-live="polite">
            {step.narration}
          </p>

          <div className="flex items-center gap-2">
            {!tour.isFirst && (
              <button onClick={tour.prevStep} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${quiet}`}>
                Back
              </button>
            )}
            {tour.sound && (
              <button
                onClick={tour.togglePause}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${quiet}`}
                aria-label={tour.paused ? "Carry on talking" : "Pause"}
              >
                {tour.paused ? <FiPlay aria-hidden /> : <FiPause aria-hidden />}
                {tour.paused ? "Play" : "Pause"}
              </button>
            )}
            <button onClick={tour.nextStep} className={`ml-auto rounded-lg px-4 py-1.5 text-sm font-bold transition ${gold}`}>
              {endLabel}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm">
            <button onClick={tour.skipPage} className="font-semibold text-yellow-300 hover:text-yellow-200">
              {tour.isLastOfRun || tour.place.of === 0 ? "Skip" : "Skip this screen →"}
            </button>
            <span className="flex gap-3">
              <button onClick={tour.showChapters} className="text-white/70 hover:text-white">
                Chapters
              </button>
              <button onClick={tour.stopTour} className="text-white/70 hover:text-white">
                Skip tour
              </button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

