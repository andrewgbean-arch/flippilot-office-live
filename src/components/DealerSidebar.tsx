import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";

import {
  FiHome,
  FiBook,
  FiDollarSign,
  FiUsers,
  FiTrendingUp,
  FiActivity,
  FiAlertTriangle,
  FiStar,
  FiTool,
  FiSettings,
  FiChevronDown,
  FiChevronRight,
  FiLayers,
  FiGrid,
  FiCheckSquare,
  FiMessageSquare,
  FiPackage,
  FiPhoneCall,
} from "react-icons/fi";

export default function DealerSidebar() {
  const { pathname } = useLocation();

  const isHome =
    pathname === "/" ||
    pathname === "" ||
    pathname === "/home" ||
    pathname === "/index";

  const sections = [
    {
      label: "Dashboard",
      icon: FiHome,
      items: [{ to: "/dealer-dashboard", label: "Dealer Dashboard" }],
    },

    {
      label: "Jobs",
      icon: FiCheckSquare,
      items: [
        { to: "/jobs", label: "Jobs Board" },
        { to: "/workshop-calendar", label: "Workshop Calendar" },
      ],
    },

    {
      label: "Consumables",
      icon: FiPackage,
      items: [
        { to: "/consumables", label: "Stock & Ordering" },
      ],
    },

    {
      label: "Contacts",
      icon: FiPhoneCall,
      items: [
        { to: "/contacts", label: "Suppliers & Contacts" },
      ],
    },

    {
      label: "Diary",
      icon: FiBook,
      items: [
        { to: "/diary", label: "My Diary" },
      ],
    },

    {
      label: "Feedback",
      icon: FiMessageSquare,
      items: [
        { to: "/feedback", label: "What Can We Do Better?" },
      ],
    },

    {
      label: "Vehicles",
      icon: FiGrid,
      items: [
        { to: "/dealer/inventory", label: "Inventory Hub" },
      ],
    },

    {
      label: "Sales",
      icon: FiTrendingUp,
      items: [
        { to: "/dealer/sales", label: "Sales Hub" },
        { to: "/dealer/sales/add", label: "Add Lead" },
        { to: "/dealer/sales/leads", label: "Leads Dashboard" },
        { to: "/dealer/sales/pipeline", label: "Sales Pipeline" },
        { to: "/appointments", label: "Viewing & Test Drive Requests" },
      ],
    },

    {
      label: "Finance Suite",
      icon: FiDollarSign,
      items: [
        { to: "/dealer/finance", label: "Finance Hub" },
        { to: "/dealer/finance/calculator", label: "Finance Calculator" },
        { to: "/dealer/finance/deal-sheet", label: "Deal Sheet" },
        { to: "/dealer/finance/lender-comparison", label: "Lender Comparison" },
        { to: "/dealer/finance/profit-breakdown", label: "Profit Breakdown" },
        { to: "/dealer/finance/trade-in", label: "Trade-In Valuation" },
        { to: "/dealer/finance/contract", label: "Contract Generator" },
      ],
    },

    {
      label: "Staff",
      icon: FiUsers,
      items: [
        { to: "/my-rota", label: "My Rota" },
        { to: "/dealer/staff", label: "Staff Dashboard" },
        { to: "/dealer/staff/add", label: "Add Staff" },
        { to: "/dealer/staff/planner", label: "Rota Planner" },
        { to: "/dealer/staff/permissions", label: "Permissions" },
      ],
    },

    {
      label: "Intelligence",
      icon: FiActivity,
      items: [
        { to: "/dealer/intelligence/market", label: "Market Intelligence" },
        { to: "/dealer/intelligence/motors", label: "Motors Dashboard" },
        { to: "/dealer/intelligence/pricing", label: "Pricing Brain" },
        { to: "/dealer/intelligence/crm", label: "CRM Intelligence" },
        { to: "/dealer/intelligence/risk", label: "Risk Intelligence" },
        { to: "/dealer/intelligence/brain", label: "Master Brain" },
      ],
    },

    {
      label: "Analytics",
      icon: FiTrendingUp,
      items: [
        { to: "/dealer/analytics", label: "Analytics Hub" },
        { to: "/dealer/analytics/sales", label: "Sales Analytics" },
        { to: "/dealer/analytics/inventory", label: "Inventory Analytics" },
        { to: "/dealer/analytics/pricing", label: "Pricing Analytics" },
        { to: "/dealer/analytics/market-trends", label: "Market Trends" },
        { to: "/dealer/analytics/lead-conversion", label: "Lead Conversion" },
        { to: "/dealer/analytics/staff", label: "Staff Analytics" },
        { to: "/dealer/analytics/branches", label: "Branch Comparison" },
      ],
    },

    {
      label: "Marketing",
      icon: FiStar,
      items: [
        { to: "/dealer/marketing", label: "Marketing Hub" },
        { to: "/dealer/marketing/sync", label: "Marketplace Sync" },
      ],
    },

    {
      label: "Bookkeeping",
      icon: FiBook,
      items: [
        { to: "/bookkeeping", label: "Bookkeeping Hub" },
      ],
    },

    {
      label: "Risk",
      icon: FiAlertTriangle,
      items: [
        { to: "/dealer/risk", label: "Risk Hub" },
      ],
    },

    {
      label: "AI",
      icon: FiLayers,
      items: [
        { to: "/ai-insights", label: "AI Insights" },
      ],
    },

    {
      label: "Tools",
      icon: FiTool,
      items: [
        { to: "/dealer/tools", label: "Tools Hub" },
      ],
    },

    {
      label: "Settings",
      icon: FiSettings,
      items: [
        { to: "/dealer/settings", label: "Settings" },
        { to: "/billing", label: "Billing" },
      ],
    },

    {
      label: "Workflows",
      icon: FiChevronRight,
      items: [
        { to: "/dealer/workflow/finance", label: "Finance Workflow" },
      ],
    },
  ];

  const [open, setOpen] = useState<Record<string, boolean>>({});
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
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-yellow-300 tracking-wide drop-shadow-lg">
            Dealer OS
          </h1>
        </div>
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
        <nav className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scroll">
          {sections.map((section) => {
            const Icon = section.icon;
            const isOpen = open[section.label];

            return (
              <div key={section.label}>
                <button
                  onClick={() => toggle(section.label)}
                  className="
                    flex items-center justify-between w-full
                    text-white/80 font-semibold tracking-wide
                    px-2 py-2 rounded-md
                    hover:text-yellow-300 transition
                  "
                >
                  <span className="flex items-center gap-2">
                    <Icon className="text-yellow-300" />
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
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `
                          px-3 py-2 rounded-lg border transition-all duration-200
                          text-sm
                          ${
                            isActive
                              ? "bg-black/60 border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                              : "bg-black/20 border-white/10 text-white/80 hover:bg-black/40 hover:text-yellow-300 hover:border-yellow-300/40"
                          }
                        `
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      <div className="mt-auto pt-10 text-white/40 text-xs">
        FlipPilot © 2026
      </div>
    </aside>
  );
}