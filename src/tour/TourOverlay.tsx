import type { CSSProperties } from "react";
import { useTour } from "./TourProvider";

const PADDING = 8;

export function TourOverlay() {
  const { isActive, step, stepIndex, totalSteps, muted, targetRect, nextStep, prevStep, stopTour, toggleMuted } =
    useTour();

  if (!isActive || !step) return null;

  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  // Spotlight cutout: a box the exact size of the target with a huge
  // box-shadow spreading dark over everything else — the target itself
  // stays fully visible and un-dimmed, without needing an SVG mask.
  const spotlightStyle: CSSProperties = targetRect
    ? {
        position: "fixed",
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
        borderRadius: 12,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
        border: "2px solid #FFD700",
        pointerEvents: "none",
        zIndex: 9998,
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
      }
    : {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 9998,
      };

  // Callout sits below the target when there's room, otherwise above —
  // clamped so it never runs off the side of a narrow viewport.
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const calloutWidth = Math.min(360, viewportW - 32);

  let top: number;
  let left: number;

  if (targetRect) {
    const spaceBelow = viewportH - targetRect.bottom;
    const placeBelow = spaceBelow > 220 || targetRect.top < 220;
    top = placeBelow ? targetRect.bottom + PADDING + 12 : targetRect.top - PADDING - 12;
    left = Math.min(Math.max(targetRect.left, 16), viewportW - calloutWidth - 16);
    if (!placeBelow) top -= 0; // anchor handled via translateY below
    return (
      <>
        <div style={spotlightStyle} />
        <div
          style={{
            position: "fixed",
            top: placeBelow ? top : undefined,
            bottom: placeBelow ? undefined : viewportH - top,
            left,
            width: calloutWidth,
            zIndex: 9999,
          }}
        >
          <Callout
            step={step}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            muted={muted}
            isFirst={isFirst}
            isLast={isLast}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={stopTour}
            onToggleMute={toggleMuted}
          />
        </div>
      </>
    );
  }

  // No target located yet (still loading, or genuinely not on screen)
  // — centre the callout instead of pointing at nothing.
  return (
    <>
      <div style={spotlightStyle} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: calloutWidth,
          zIndex: 9999,
        }}
      >
        <Callout
          step={step}
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          muted={muted}
          isFirst={isFirst}
          isLast={isLast}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={stopTour}
          onToggleMute={toggleMuted}
        />
      </div>
    </>
  );
}

function Callout({
  step,
  stepIndex,
  totalSteps,
  muted,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onSkip,
  onToggleMute,
}: {
  step: { title: string; narration: string };
  stepIndex: number;
  totalSteps: number;
  muted: boolean;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="bg-[#0A1128] border border-yellow-400/40 rounded-xl p-5 shadow-[0_0_30px_rgba(255,215,0,0.35)] text-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-300/70 text-xs font-semibold uppercase tracking-wide">
          Step {stepIndex + 1} of {totalSteps}
        </span>
        <button
          onClick={onToggleMute}
          className="text-white/50 hover:text-white text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition"
          title={muted ? "Turn narration on" : "Turn narration off"}
        >
          {muted ? "🔇 Muted" : "🔊 Voice on"}
        </button>
      </div>

      <h3 className="text-lg font-bold text-yellow-300 mb-2">{step.title}</h3>
      <p className="text-white/80 text-sm mb-4">{step.narration}</p>

      <div className="flex items-center justify-between">
        <button onClick={onSkip} className="text-white/50 hover:text-white/80 text-sm transition">
          Skip tour
        </button>
        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 rounded bg-white/10 text-white/80 hover:bg-white/20 text-sm font-semibold transition"
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className="px-4 py-1.5 rounded bg-yellow-400 text-black hover:bg-yellow-300 text-sm font-bold transition"
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
