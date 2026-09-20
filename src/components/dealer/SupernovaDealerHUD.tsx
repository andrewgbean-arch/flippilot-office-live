import { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown } from "react-icons/fi";

type HudProps = {
  aiSync?: "idle" | "syncing" | "error" | "running";
  marketTrend?: "rising" | "flat" | "falling";
  riskLevel?: "low" | "medium" | "high";
  flipScore?: number;
  motHealth?: "good" | "watch" | "bad";
  // How many vehicles the figures are averaged over. With none there is
  // nothing to summarise, so the bar says so instead of showing zeros that
  // read as real results.
  // `undefined` while stock is still loading (then the pills show, syncing).
  vehicleCount?: number | undefined;
};

const pill =
  "px-2.5 py-2 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition hover:brightness-125";

// The HUD used to be two full-width cards on every dealer page (a title block
// with a marketing caption, then a second line repeating the same three
// numbers), which pushed the page's own content roughly half a screen down.
// It is now one slim bar: all the pills on a line at desktop widths, and one
// summary line on a phone that opens to show them.
export default function SupernovaDealerHUD({
  aiSync = "idle",
  marketTrend = "flat",
  riskLevel = "low",
  flipScore = 0,
  motHealth = "good",
  vehicleCount,
}: HudProps) {
  const [open, setOpen] = useState(false);

  const syncColor =
    aiSync === "running" || aiSync === "syncing"
      ? "bg-yellow-400/20 text-yellow-200 border-yellow-400/60 animate-pulse"
      : aiSync === "error"
      ? "bg-red-500/20 text-red-300 border-red-500/60"
      : "bg-green-500/20 text-green-300 border-green-500/60";

  const marketColor =
    marketTrend === "rising"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60"
      : marketTrend === "falling"
      ? "bg-red-500/20 text-red-300 border-red-500/60"
      : "bg-slate-500/20 text-slate-200 border-slate-400/60";

  const riskColor =
    riskLevel === "high"
      ? "bg-red-500/20 text-red-300 border-red-500/60"
      : riskLevel === "medium"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/60";

  const motColor =
    motHealth === "good"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60"
      : motHealth === "bad"
      ? "bg-red-500/20 text-red-300 border-red-500/60"
      : "bg-amber-500/20 text-amber-300 border-amber-500/60";

  const syncLabel =
    aiSync === "error" ? "Insights: problem" : aiSync === "idle" ? "Insights: up to date" : "Insights: updating…";

  const empty = vehicleCount === 0;

  return (
    <section
      aria-label="Stock snapshot"
      className="w-full rounded-xl bg-black/60 border border-yellow-500/25 backdrop-blur-md"
    >
      <div className="flex items-center gap-3 px-3 sm:px-4 py-1.5 sm:py-2">
        <span className="hidden sm:inline shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
          Stock snapshot
        </span>

        {empty ? (
          <p className="py-1.5 text-sm text-white/75">
            Add vehicles to your stock to switch on the fleet insights.
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
              <span>
                Market {marketTrend} · Risk {riskLevel} · MOT {motHealth}
              </span>
              <FiChevronDown
                aria-hidden="true"
                className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>

            <div
              id="hud-pills"
              className={`${open ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-2 pb-2 sm:pb-0`}
            >
              <div className={`${pill} ${syncColor}`} title="Whether the numbers below are up to date with your stock">
                <span className="h-2 w-2 rounded-full bg-current" />
                <span>{syncLabel}</span>
              </div>

              {/* MARKET: computed from each vehicle's own flip-score-driven
                  demand estimate, not a live market-data feed (this app has no
                  market-data API yet), hence "(est.)". */}
              <Link
                to="/dealer/intelligence/market"
                className={`${pill} ${marketColor}`}
                title="Estimated from each vehicle's flip score. Not a live market-data feed."
              >
                Market: {marketTrend} (est.)
              </Link>

              <Link
                to="/dealer/intelligence/risk"
                className={`${pill} ${riskColor}`}
                title="A rough guide from each car's mileage, age and MOT advisories and failures, averaged across your stock. Low is under 30, medium 30 to 59, high 60 or more."
              >
                Risk: {riskLevel}
              </Link>

              <Link
                to="/ai-insights"
                className={`${pill} bg-purple-500/20 text-purple-200 border-purple-400/60`}
                title="A rough 0 to 100 guide from each car's trade-to-retail price gap and MOT status, averaged across your stock. Market demand isn't fed in yet, so scores run low: compare cars with each other rather than reading it as a grade."
              >
                FlipScore: {flipScore}/100
              </Link>

              <Link
                to="/dealer/workflow/mot"
                className={`${pill} ${motColor}`}
                title="The most urgent MOT status in your stock: bad means at least one has expired, watch means one is due soon, good means none are."
              >
                MOT: {motHealth}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
