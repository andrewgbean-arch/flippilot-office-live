import type { CSSProperties } from "react";
import { useTour } from "./TourProvider";

const PADDING = 8;

export function TourOverlay() {
  const { isActive, step, stepIndex, totalSteps, hasSound, targetRect, nextStep, prevStep, stopTour, answerSoundPrompt } =
    useTour();

  if (!isActive) return null;

  // Sound prompt — shown once, before anything navigates or speaks, so
  // the answer is known before the first step ever tries to act on it.
  if (hasSound === null) {
    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999 }}
        className="flex items-center justify-center"
      >
        <div className="bg-[#0A1128] border border-yellow-400/40 rounded-xl p-6 shadow-[0_0_30px_rgba(255,215,0,0.35)] text-white max-w-sm mx-4 text-center">
          <h3 className="text-lg font-bold text-yellow-300 mb-2">Before we start…</h3>
          <p className="text-white/80 text-sm mb-5">
            Do you have sound? If so, this tour will talk you through everything — otherwise
            we'll show you around with text instead.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => answerSoundPrompt(false)}
              className="px-4 py-2 rounded bg-white/10 text-white/80 hover:bg-white/20 text-sm font-semibold transition"
            >
              No sound — use text
            </button>
            <button
              onClick={() => answerSoundPrompt(true)}
              className="px-4 py-2 rounded bg-yellow-400 text-black hover:bg-yellow-300 text-sm font-bold transition"
            >
              Yes, I have sound
            </button>
          </div>
          <button onClick={stopTour} className="mt-4 text-white/60 hover:text-white/70 text-xs transition">
            Skip tour
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  // Spotlight only — no dark scrim behind it. A gold outline around
  // whatever's being highlighted, the rest of the real app stays fully
  // visible and normal-coloured.
  const spotlightStyle: CSSProperties = targetRect
    ? {
        position: "fixed",
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
        borderRadius: 12,
        border: "3px solid #FFD700",
        boxShadow: "0 0 20px rgba(255,215,0,0.6)",
        pointerEvents: "none",
        zIndex: 9998,
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
      }
    : { display: "none" };

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  // Voice-only mode: no text card at all, just the spotlight flowing
  // from item to item, plus a small always-present skip pill — the
  // one piece of UI that has to survive removing everything else, so
  // there's still a way out of the tour without needing sound.
  if (hasSound) {
    return (
      <>
        <div style={spotlightStyle} />
        <div
          style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999 }}
          className="flex items-center gap-3 bg-[#0A1128] border border-yellow-400/40 rounded-full px-4 py-2 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
        >
          <span className="text-yellow-300/70 text-xs font-semibold">
            {stepIndex + 1} / {totalSteps}
          </span>
          <button onClick={stopTour} className="text-white/60 hover:text-white text-xs font-semibold transition">
            Skip tour
          </button>
        </div>
      </>
    );
  }

  // No-sound mode: today's original text card and manual controls,
  // just without the dark background behind it.
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const calloutWidth = Math.min(360, viewportW - 32);

  // Reserve a budget for the card's own height so it's never placed
  // partly below the viewport — a target taller than the screen (e.g.
  // the whole Dealer Modules grid) can have targetRect.bottom or .top
  // land off-screen, which used to push the Next button out of view
  // with no way to reach it (the card is position: fixed, so page
  // scroll doesn't move it). Confirmed live: step 5 of the tour.
  const CARD_BUDGET = 260;
  const EDGE_MARGIN = 16;

  let calloutStyle: CSSProperties;
  if (targetRect) {
    const spaceBelow = viewportH - targetRect.bottom;
    const placeBelow = spaceBelow > 220 || targetRect.top < 220;
    const left = Math.min(Math.max(targetRect.left, 16), viewportW - calloutWidth - 16);
    calloutStyle = placeBelow
      ? {
          position: "fixed",
          top: Math.min(
            targetRect.bottom + PADDING + 12,
            viewportH - CARD_BUDGET - EDGE_MARGIN
          ),
          left,
          width: calloutWidth,
          maxHeight: viewportH - EDGE_MARGIN * 2,
          overflowY: "auto",
          zIndex: 9999,
        }
      : {
          position: "fixed",
          bottom: Math.max(viewportH - (targetRect.top - PADDING - 12), EDGE_MARGIN),
          left,
          width: calloutWidth,
          maxHeight: viewportH - EDGE_MARGIN * 2,
          overflowY: "auto",
          zIndex: 9999,
        };
  } else {
    calloutStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: calloutWidth,
      maxHeight: viewportH - EDGE_MARGIN * 2,
      overflowY: "auto",
      zIndex: 9999,
    };
  }

  return (
    <>
      <div style={spotlightStyle} />
      <div style={calloutStyle}>
        <div className="bg-[#0A1128] border border-yellow-400/40 rounded-xl p-5 shadow-[0_0_30px_rgba(255,215,0,0.35)] text-white">
          <span className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wide block mb-2">
            Step {stepIndex + 1} of {totalSteps}
          </span>

          <h3 className="text-lg font-bold text-yellow-300 mb-2">{step.title}</h3>
          <p className="text-white/80 text-sm mb-4">{step.narration}</p>

          <div className="flex items-center justify-between">
            <button onClick={stopTour} className="text-white/50 hover:text-white/80 text-sm transition">
              Skip tour
            </button>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/80 hover:bg-white/20 text-sm font-semibold transition"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-4 py-1.5 rounded bg-yellow-400 text-black hover:bg-yellow-300 text-sm font-bold transition"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
