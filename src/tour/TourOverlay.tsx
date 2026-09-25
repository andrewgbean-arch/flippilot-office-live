import type { CSSProperties } from "react";
import { FiCheck, FiChevronRight, FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";
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

  const endLabel = tour.isLastOfRun ? "Finish" : "Next";

  return (
    <>
      <div style={spotlightStyle} aria-hidden />
      <div style={cardStyle} role="dialog" aria-label={`Tour: ${step.title}`}>
        <div className="rounded-xl border border-yellow-400/50 bg-[#0A1128] p-4 text-white shadow-[0_0_30px_rgba(255,215,0,0.35)] sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="truncate uppercase tracking-wide text-yellow-300/80">
              {tour.singleRun && tour.page && !tour.chapter?.pages.some(p => p.id !== tour.page!.id) ? "" : `Chapter ${tour.chapterNumber} · `}
              {tour.page?.title}
            </span>
            <span className="shrink-0 text-white/50">
              {tour.place.at} of {tour.place.of}
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

