import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { REPORT_TABS, reportTabFor } from "./reportTabs";

// Tabs across the top of every report, so moving between them doesn't mean
// going back to the menu. Wraps the existing report pages unchanged.
export default function ReportsTabs({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const current = reportTabFor(pathname);
  return (
    <>
      <nav aria-label="Reports" className="px-4 sm:px-6 pt-6 -mb-2">
        <p className="brand-caps text-xs mb-2">REPORTS</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {REPORT_TABS.map((t) => {
            const here = t.to === current;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={here ? "page" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition ${
                  here
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-[0_0_14px_rgba(255,215,0,0.45)]"
                    : "bg-black/30 text-white/80 border-white/15 hover:text-yellow-300 hover:border-yellow-300/50"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
