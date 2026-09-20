import { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";
import { hudPills, hudSummaryLine, type DealerHudStats, type HudTone } from "@/lib/dealerHudStats";

type HudProps = {
  // True only while the stock is still being fetched for the first time, so
  // the bar doesn't announce "no vehicles" before the cars have arrived.
  loading: boolean;
  stats: DealerHudStats;
};

const pill =
  "px-2.5 py-2 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300";

const TONES: Record<HudTone, string> = {
  neutral: "bg-slate-500/20 text-slate-200 border-slate-400/60",
  good: "bg-emerald-500/20 text-emerald-300 border-emerald-500/60",
  warn: "bg-amber-500/20 text-amber-300 border-amber-500/60",
  bad: "bg-red-500/20 text-red-300 border-red-500/60",
};

// One slim bar of facts counted from the dealer's own stock: all the pills on
// a line at desktop widths, and one summary line on a phone that opens to show
// them. (It used to carry a market trend, a FlipScore, a risk level and a
// "Brain" mode, none of which were measurements; see lib/dealerHudStats.ts.)
export default function SupernovaDealerHUD({ loading, stats }: HudProps) {
  const [open, setOpen] = useState(false);

  const empty = !loading && stats.inStock === 0;

  return (
    <section
      aria-label="Stock snapshot"
      className="w-full rounded-xl bg-black/60 border border-yellow-500/25 backdrop-blur-md"
    >
      <div className="flex items-center gap-3 px-3 sm:px-4 py-1.5 sm:py-2">
        <span className="hidden sm:inline shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
          Stock snapshot
        </span>

        {loading ? (
          <p role="status" className="py-1.5 text-sm text-white/75">
            Loading your stock…
          </p>
        ) : empty ? (
          <p className="py-1.5 text-sm text-white/75">
            No vehicles in stock right now.{" "}
            <Link to="/new-flip" className="text-yellow-300 underline underline-offset-2">
              Add a vehicle
            </Link>{" "}
            and its figures will show here.
          </p>
        ) : (
          <>
            {/* PHONES: one line that opens to the full set. */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="hud-pills"
              onClick={() => setOpen((v) => !v)}
              className="sm:hidden flex-1 min-h-[44px] flex items-center justify-between gap-2 text-left text-sm text-white/85"
            >
              <span>{hudSummaryLine(stats)}</span>
              <FiChevronDown
                aria-hidden="true"
                className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>

            <div
              id="hud-pills"
              className={`${open ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-2 pb-2 sm:pb-0`}
            >
              {hudPills(stats).map((p) => (
                <Link key={p.key} to={p.to} className={`${pill} ${TONES[p.tone]}`} title={p.title}>
                  {p.text}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
