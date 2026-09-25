import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiHelpCircle, FiMessageCircle, FiPlayCircle, FiX, FiMap } from "react-icons/fi";
import { useTour } from "./TourProvider";

// "Help with this page": a button on every screen. It opens a panel with
// Wendy's walk-round of the screen you're on, the written guide for it (what
// it's for, how to do things, tips, who can use what), and a way to ask Wendy
// about it. Screens with no guide yet still offer the full tour and Wendy.
export default function PageHelp() {
  const tour = useTour();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const page = tour.thisPage;
  const guide = page?.guide;

  // Closes on Escape, and when the tour starts (the panel would sit on top of it).
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (tour.isActive) setOpen(false);
  }, [tour.isActive]);

  if (tour.isActive) return null;

  const askWendy = () => {
    setOpen(false);
    const question = page ? `How do I use the ${page.title} page, and what should I look at first?` : "How do I use this page?";
    navigate(`/pilot-brain?ask=${encodeURIComponent(question)}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Help with this page"
        title="Help with this page"
        className="fixed bottom-[4.5rem] right-3 z-40 flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-yellow-400/70 bg-[#0A1128]/95 text-sm font-bold text-yellow-300 shadow-[0_0_18px_rgba(255,215,0,0.45)] transition hover:bg-yellow-400 hover:text-black sm:bottom-24 sm:right-4 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 lg:right-[18rem]"
      >
        {/* A small "?" on a phone, where the full label would cover the page's own buttons. */}
        <FiHelpCircle aria-hidden className="text-2xl sm:text-lg" />
        <span className="hidden sm:inline">Help with this page</span>
      </button>

      {/* Drawn at the top of the page, not inside the page area: that area is
          layered below the side columns, which would sit on top of the panel. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[9990] flex justify-end bg-black/50" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-help-title"
            onClick={e => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-yellow-400/40 bg-[#0A1128] text-white shadow-[0_0_40px_rgba(255,215,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="brand-caps text-[11px]">HELP WITH THIS PAGE</p>
                <h2 id="page-help-title" className="mt-1 text-xl font-bold text-yellow-300">
                  {page?.title ?? "This page"}
                </h2>
              </div>
              <button ref={closeRef} onClick={() => setOpen(false)} aria-label="Close help" className="rounded-lg p-2 text-white/70 hover:bg-white/10">
                <FiX />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="grid gap-2">
                {page && (
                  <button
                    onClick={() => tour.runPage(page.id)}
                    className="flex items-center gap-3 rounded-xl bg-yellow-400 px-4 py-3 text-left font-bold text-black transition hover:bg-yellow-300"
                  >
                    <FiPlayCircle aria-hidden className="shrink-0 text-2xl" />
                    <span>
                      Show me how to use this page
                      <span className="block text-xs font-semibold text-black/70">
                        Wendy talks you round it · {page.steps.length} {page.steps.length === 1 ? "stop" : "stops"}
                      </span>
                    </span>
                  </button>
                )}
                <button
                  onClick={askWendy}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold transition hover:border-yellow-400/60"
                >
                  <FiMessageCircle aria-hidden className="shrink-0 text-xl text-yellow-300" />
                  Ask Wendy about this page
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    tour.startTour();
                  }}
                  className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left font-semibold transition hover:border-yellow-400/60"
                >
                  <FiMap aria-hidden className="shrink-0 text-xl text-yellow-300" />
                  The full tour, or any other screen
                </button>
              </div>

              {guide ? (
                <>
                  <section>
                    <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-white/60">What this page is for</h3>
                    <p className="text-sm leading-relaxed text-white/85">{guide.summary}</p>
                  </section>

                  {guide.howTo.map(item => (
                    <section key={item.question}>
                      <h3 className="mb-1.5 font-bold text-yellow-300">{item.question}</h3>
                      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-white/85">
                        {item.steps.map(stepText => (
                          <li key={stepText}>{stepText}</li>
                        ))}
                      </ol>
                    </section>
                  ))}

                  {guide.tips && guide.tips.length > 0 && (
                    <section className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-3">
                      <h3 className="mb-1 text-sm font-bold text-yellow-300">Tips</h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-white/85">
                        {guide.tips.map(tip => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {guide.access && (
                    <section>
                      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-white/60">Who can do what here</h3>
                      <p className="text-sm text-white/80">{guide.access}</p>
                    </section>
                  )}
                </>
              ) : (
                <p className="text-sm text-white/70">
                  There's no written guide for this page yet. Wendy can talk you through it, or take the full tour.
                </p>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
