import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useIsSupportAdmin } from "@/lib/useIsSupportAdmin";
import { useTour } from "@/tour/TourProvider";
import { REPORT_TABS, reportTabFor } from "@/dealer/reports/reportTabs";
import { useAuth } from "@/context/AuthContext";
import { canOpenPage } from "@/lib/pageAccess";

// A menu entry that starts the guided tour instead of opening a page.
const TOUR_LINK = "#tour";

import {
  FiHome,
  FiDollarSign,
  FiUsers,
  FiTrendingUp,
  FiActivity,
  FiTool,
  FiSettings,
  FiChevronDown,
  FiChevronRight,
  FiGrid,
  FiCpu,
  FiUserCheck,
} from "react-icons/fi";

export default function DealerSidebar() {
  const { pathname } = useLocation();
  const isSupportAdmin = useIsSupportAdmin();
  const { startTour } = useTour();
  const { user } = useAuth();

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  // Nine groups (was twenty). Every page that existed is still reachable;
  // pages that were exact copies of another now redirect to it (see
  // AnimatedRoutes). pilotBrainGuide.ts mirrors this list for Wendy and its
  // test reads this file, so keep the `label:` / `{ to, label }` shapes.
  // "direct" groups are a single link with no sub-menu.
  const allSections: { label: string; icon: typeof FiHome; direct?: boolean; items: { to: string; label: string }[] }[] = [
    {
      label: "Dashboard",
      icon: FiHome,
      direct: true,
      items: [{ to: "/dealer-dashboard", label: "Dashboard" }],
    },

    {
      label: "Wendy · Pilot Brain",
      icon: FiCpu,
      items: [
        { to: "/pilot-brain", label: "Ask Wendy" },
        { to: "/pilot-brain/operations", label: "Approvals" },
        { to: "/pilot-brain/strategy", label: "Goals & Briefing" },
        { to: "/pilot-brain/decisions", label: "Decision Journal" },
      ],
    },

    {
      label: "Stock",
      icon: FiGrid,
      items: [
        { to: "/dealer/inventory", label: "Stock Overview" },
        { to: "/dealer/inventory/list", label: "Vehicle List" },
        { to: "/photo-studio", label: "Photo Studio" },
        { to: "/dealer/inventory/mot-lookup", label: "MOT Lookup" },
        { to: "/dealer/tools", label: "Stock Tools" },
        { to: "/import", label: "Import from CSV" },
      ],
    },

    {
      label: "Sales",
      icon: FiTrendingUp,
      items: [
        { to: "/dealer/sales", label: "Sales Overview" },
        { to: "/dealer/sales/leads", label: "Leads" },
        { to: "/dealer/sales/add", label: "Add Lead" },
        { to: "/dealer/sales/pipeline", label: "Pipeline" },
        { to: "/appointments", label: "Viewings & Test Drives" },
        { to: "/dealer/sales/wanted", label: "Wanted Cars" },
        { to: "/dealer/marketing", label: "Your Public Page" },
        { to: "/dealer/marketing/sync", label: "Portal Stock Feed" },
      ],
    },

    {
      label: "Customers",
      icon: FiUserCheck,
      items: [
        { to: "/customers", label: "Customer Database" },
        { to: "/contacts", label: "Suppliers & Contacts" },
      ],
    },

    {
      label: "Workshop",
      icon: FiTool,
      items: [
        { to: "/jobs", label: "Jobs Board" },
        { to: "/workshop-calendar", label: "Workshop Calendar" },
        { to: "/consumables", label: "Parts & Consumables" },
      ],
    },

    {
      label: "Money",
      icon: FiDollarSign,
      items: [
        { to: "/bookkeeping", label: "Bookkeeping" },
        { to: "/dealer/finance/profit-breakdown", label: "Profit Breakdown" },
        { to: "/dealer/finance/calculator", label: "Finance Calculator" },
        { to: "/dealer/finance/deal-sheet", label: "Deal Sheet" },
        { to: "/dealer/finance/lender-comparison", label: "Lender Comparison" },
        { to: "/dealer/finance/trade-in", label: "Trade-In Valuation" },
        { to: "/dealer/finance/contract", label: "Contract Generator" },
      ],
    },

    {
      label: "Team",
      icon: FiUsers,
      items: [
        { to: "/my-rota", label: "My Rota" },
        { to: "/diary", label: "My Diary" },
        { to: "/feedback", label: "Team Message Board" },
        { to: "/dealer/staff/message", label: "Message a Teammate" },
        { to: "/dealer/staff", label: "Staff" },
        { to: "/dealer/staff/planner", label: "Rota Planner" },
        { to: "/dealer/staff/add", label: "Add Staff" },
        { to: "/dealer/staff/permissions", label: "Who Can See What" },
      ],
    },

    {
      label: "Reports",
      icon: FiActivity,
      items: REPORT_TABS.map(({ to, label }) => ({ to, label })),
    },

    {
      label: "Settings",
      icon: FiSettings,
      items: [
        { to: "/dealer/settings", label: "Settings" },
        { to: "/billing", label: "Billing" },
        { to: "/support", label: "Help & Support" },
        { to: TOUR_LINK, label: "Take the Tour" },
        // Only ever rendered once the backend has actually confirmed
        // this account is the platform admin — see useIsSupportAdmin.
        ...(isSupportAdmin
          ? [
              { to: "/admin/support", label: "Support Inbox (Admin)" },
              { to: "/admin/dealerships", label: "Dealerships (Admin)" },
            ]
          : []),
      ],
    },
  ];

  // Only what this person's role can open (pageAccess.ts); a group left with
  // nothing in it goes too.
  const sections = allSections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.to === TOUR_LINK || canOpenPage(user, item.to)) }))
    .filter((section) => section.items.length > 0);

  // "You are here": the one menu item that best matches the current page
  // (longest matching address, so /dealer/sales/leads lights up Leads
  // Dashboard, not Sales Hub too), and the group it lives in.
  const reportTab = reportTabFor(pathname);
  const matches = (to: string) => to === reportTab || pathname === to || pathname.startsWith(`${to}/`);
  let currentTo = "";
  let currentSection = "";
  for (const section of sections) {
    for (const item of section.items ?? []) {
      if (matches(item.to) && item.to.length > currentTo.length) {
        currentTo = item.to;
        currentSection = section.label;
      }
    }
  }

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    currentSection ? { [currentSection]: true } : {}
  );
  // Moving to a page in a closed group opens that group, so the highlight
  // is always visible; groups the dealer opened themselves stay open.
  useEffect(() => {
    if (currentSection) setOpen((prev) => (prev[currentSection] ? prev : { ...prev, [currentSection]: true }));
  }, [currentSection]);
  const toggle = (label: string) =>
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside
      className="
        w-64 h-screen flex flex-col p-6 relative
        bg-gradient-to-b from-black/60 to-black/30
        backdrop-blur-xl border-r border-yellow-400/20
        shadow-[0_0_40px_rgba(255,215,0,0.25)]
        animate-fadeIn
      "
    >
      <div
        className="
          absolute right-0 top-0 h-full w-[3px]
          bg-yellow-400 opacity-90
          shadow-[0_0_25px_rgba(255,215,0,0.9)]
        "
      />

      {!isHome && (
        <Link to="/dealer-dashboard" className="mb-8 flex flex-col items-center" aria-label="FlipPilot Dealer OS, go to the dashboard">
          {/* The FlipPilot gold logo in its Dealer OS form (FPD monogram, no
              consumer tagline), with gold-foil spaced capitals under it like the
              FlipPilot app's SCAN · CHECK · FLIP.
              The app name, not a heading: each page carries its own h1. */}
          <img src="/brand/flippilot-logo.webp" alt="" width={140} height={131} className="w-[140px] h-auto drop-shadow-[0_0_18px_rgba(255,215,0,0.35)]" />
          <p className="brand-caps -mt-1 text-[13px]">DEALER OS</p>
        </Link>
      )}

      {isHome && (
        <nav className="flex flex-col gap-4 mt-10">
          <NavLink to="/jobs" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Jobs
          </NavLink>
          <NavLink to="/dealer/inventory" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Inventory
          </NavLink>
          <NavLink to="/dealer/sales" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Sales
          </NavLink>
          <NavLink to="/dealer/intelligence" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Intelligence
          </NavLink>
          <NavLink to="/dealer/analytics" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Analytics
          </NavLink>
          <NavLink to="/dealer/tools" className="text-white/80 hover:text-yellow-300 transition px-2 py-2">
            Tools
          </NavLink>
        </nav>
      )}

      {!isHome && (
        <nav data-tour="tour-sidebar" className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scroll">
          {sections.map((section) => {
            const Icon = section.icon;
            const isOpen = open[section.label];

            const firstItem = section.items[0];
            if (section.direct && firstItem) {
              const here = firstItem.to === currentTo;
              return (
                <Link
                  key={section.label}
                  to={firstItem.to}
                  aria-current={here ? "page" : undefined}
                  className={`flex items-center gap-2 w-full font-semibold tracking-wide px-2 py-2 rounded-md border-l-4 hover:text-yellow-300 transition ${
                    here ? "text-yellow-300 border-yellow-400 bg-yellow-400/10" : "text-white/80 border-transparent"
                  }`}
                >
                  <Icon className="text-yellow-300" />
                  {section.label}
                </Link>
              );
            }

            return (
              <div key={section.label}>
                <button
                  onClick={() => toggle(section.label)}
                  aria-expanded={!!isOpen}
                  className={`
                    flex items-center justify-between w-full
                    font-semibold tracking-wide
                    px-2 py-2 rounded-md border-l-4
                    hover:text-yellow-300 transition
                    ${
                      section.label === currentSection
                        ? "text-yellow-300 border-yellow-400 bg-yellow-400/10"
                        : "text-white/80 border-transparent"
                    }
                  `}
                >
                  <span className="flex items-center gap-2 text-left leading-tight">
                    <Icon className="text-yellow-300 shrink-0" />
                    {section.label}
                  </span>

                  {isOpen ? (
                    <FiChevronDown className="text-yellow-300" />
                  ) : (
                    <FiChevronRight className="text-yellow-300" />
                  )}
                </button>

                {isOpen && (
                  <div className="flex flex-col mt-2 ml-4 gap-2">
                    {section.items.map((item) => item.to === TOUR_LINK ? (
                      <button
                        key={item.to}
                        type="button"
                        onClick={startTour}
                        className="text-left px-3 py-2 rounded-lg border transition-all duration-200 text-sm bg-black/20 border-white/10 text-white/80 hover:bg-black/40 hover:text-yellow-300 hover:border-yellow-300/40"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        key={item.to}
                        to={item.to}
                        aria-current={item.to === currentTo ? "page" : undefined}
                        className={
                          `
                          px-3 py-2 rounded-lg border transition-all duration-200
                          text-sm
                          ${
                            item.to === currentTo
                              ? "bg-black/60 border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                              : "bg-black/20 border-white/10 text-white/80 hover:bg-black/40 hover:text-yellow-300 hover:border-yellow-300/40"
                          }
                        `}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      <div className="mt-auto pt-10 text-white/60 text-xs">
        FlipPilot © 2026
      </div>
    </aside>
  );
}