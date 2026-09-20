import { inStockAtLeast, unsold, withMotAdvisories, withoutAskingPrice, withoutPhotos } from "@/dealer/inventory/stockFacts";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";
import { useJobs } from "@/context/JobsContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { useLeads } from "@/context/LeadsContext";
import { useAppointments } from "@/context/AppointmentsContext";
import { useDealer } from "@/context/DealerContext";
import { useAuth } from "@/context/AuthContext";
import { toDateKey } from "@/planner/dateUtils";

import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import GoldButton from "@/components/ui/GoldButton.web";

import SupernovaMarketTicker from "@/components/supernova/SupernovaMarketTicker";
import DealerModeToggle from "@/components/supernova/DealerModeToggle";
import PilotBrainWatcherCard from "@/pilotbrain/PilotBrainWatcherCard";
import PilotBrainMarketCard from "@/pilotbrain/PilotBrainMarketCard";
import InstallHint from "@/pwa/InstallHint";

import {
  FiTool,
  FiAlertTriangle,
  FiCamera,
  FiTrendingUp,
  FiList,
  FiUsers,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiCheckSquare,
  FiCalendar,
} from "react-icons/fi";

type Props = {
  brain?: any;
};

const HERO_ACCENTS: Record<string, string> = {
  green: "border-green-400/40 text-green-300 hover:shadow-[0_0_25px_rgba(74,222,128,0.35)]",
  red: "border-red-400/40 text-red-300 hover:shadow-[0_0_25px_rgba(248,113,113,0.35)]",
  blue: "border-blue-400/40 text-blue-300 hover:shadow-[0_0_25px_rgba(96,165,250,0.35)]",
  gold: "border-yellow-400/40 text-yellow-300 hover:shadow-[0_0_25px_rgba(250,204,21,0.35)]",
  purple: "border-purple-400/40 text-purple-300 hover:shadow-[0_0_25px_rgba(192,132,252,0.35)]",
};

function HeroStat({
  label,
  value,
  icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent: keyof typeof HERO_ACCENTS;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-black/30 border rounded-xl p-4 transition backdrop-blur-xl ${HERO_ACCENTS[accent]}`}
    >
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </button>
  );
}

export default function DealerDashboard({ brain }: Props) {
  const navigate = useNavigate();
  const { vehicles, loading } = useInventory();
  const { jobs } = useJobs();
  const { sales, getProfitForVehicle } = useBookkeeping();
  const { leads } = useLeads();
  const { appointments } = useAppointments();
  const { dealer } = useDealer();
  const { user } = useAuth();

  const safeVehicles = vehicles ?? [];

  if (loading) {
    return (
      <div className="text-center text-white/60 py-20">
        Loading workflow…
      </div>
    );
  }

  // -----------------------------
  // WORKFLOW SIGNALS (SAFE)
  // -----------------------------

  // Everything below is about cars still for sale: a sold car with an advisory
  // or no photo is not something anyone can act on.
  const forSale = unsold(safeVehicles);
  const now = new Date();

  const motAlerts = forSale.filter((v) => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  });

  // Each of these is a real, checkable fact about a car. They used to read fields
  // (predictedRepairs, valuationConfidence, auctionDelta) that were invented and
  // never based on the car, so "need repairs" and "have finance risks" were
  // constants dressed as findings.
  const reconNeeded = withMotAdvisories(forSale);
  const pricingNeeded = withoutAskingPrice(forSale);

  // Real photo count, not `photoQuality` — that field is a fake
  // condition/status-derived number from dealerAI.ts's simulated
  // enrichment, completely unrelated to whether real photos were
  // ever uploaded, and never recalculated after a vehicle's own real
  // `images` change on Edit. A vehicle genuinely needs photos when it
  // has none, full stop.
  const photoNeeded = withoutPhotos(forSale);

  const financeIssues = inStockAtLeast(forSale, 90, now);

  // The Jobs Board (day-to-day tasks assigned to real staff accounts)
  // previously had no presence on the main dashboard at all — a manager
  // had to remember to check /jobs separately from everything else
  // they check first thing. Uses the same local-date-key helper as the
  // rota planner (toDateKey) rather than toISOString(), which rolls a
  // date back under UK BST — see dateUtils.ts for the bug that caused.
  const todayKey = toDateKey(new Date());
  const openJobs = jobs.filter((j) => j.status !== "done");
  const overdueJobs = openJobs.filter((j) => j.dueDate && j.dueDate < todayKey);

  // ⭐ HEADLINE NUMBERS — the "at a glance" row a dealer actually wants
  // the instant they log in: what my stock is worth, what I've made
  // this month, and what needs a reply today. All computed from the
  // same real bookkeeping/leads/appointments data used elsewhere in
  // this app, not a separate "AI" framing of it.
  const soldVehicleIds = new Set(sales.map((s) => s.vehicleId));
  const stockValue = safeVehicles
    .filter((v) => !soldVehicleIds.has(v.id))
    .reduce((sum, v) => sum + (v.priceRetail ?? 0), 0);

  const monthPrefix = new Date().toISOString().slice(0, 7); // "2026-09"
  const salesThisMonth = sales.filter((s) => s.date?.startsWith(monthPrefix));
  // A vehicle can be sold without a matching purchase record (e.g.
  // imported from a CSV, which only creates the inventory row) — those
  // just don't contribute a figure here rather than being counted as
  // £0 profit, so this stays an honest (if occasionally partial) total
  // rather than a silently wrong one.
  const profitThisMonth = salesThisMonth.reduce(
    (sum, s) => sum + (getProfitForVehicle(s.vehicleId)?.profit ?? 0),
    0
  );

  const openLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const todaysAppointments = appointments.filter(
    (a) => a.requestedDate === todayKey && a.status !== "declined"
  );

  const greetingName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

 const recentActivity: {
  id: string;
  title: string;
  timestamp: string;
}[] =
  brain?.workflow?.activityFeed ??
  safeVehicles.slice(0, 5).map((v) => ({
    id: v.id,
    title: `${v.make} ${v.model}`,
    timestamp: new Date().toLocaleString(),
  }));

  // Real ticker content built from the same real per-vehicle signals
  // the "Today's Actions" cards below already use — was previously a
  // single hardcoded string with a fabricated "3.2%" that never changed.
  const tickerItems = [
    `🚗 ${safeVehicles.length} vehicle${safeVehicles.length === 1 ? "" : "s"} in stock`,
    motAlerts.length > 0
      ? `⚠️ ${motAlerts.length} vehicle${motAlerts.length === 1 ? "" : "s"} need MOT attention`
      : null,
    reconNeeded.length > 0
      ? `🔧 ${reconNeeded.length} vehicle${reconNeeded.length === 1 ? "" : "s"} with MOT advisories`
      : null,
    pricingNeeded.length > 0
      ? `📉 ${pricingNeeded.length} vehicle${pricingNeeded.length === 1 ? "" : "s"} with no asking price`
      : null,
    photoNeeded.length > 0
      ? `📷 ${photoNeeded.length} vehicle${photoNeeded.length === 1 ? "" : "s"} missing photos`
      : null,
    financeIssues.length > 0
      ? `💰 ${financeIssues.length} vehicle${financeIssues.length === 1 ? "" : "s"} in stock for 90+ days`
      : null,
    overdueJobs.length > 0
      ? `📋 ${overdueJobs.length} job${overdueJobs.length === 1 ? "" : "s"} overdue`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="space-y-8 lg:space-y-12">

      {/* HOME-SCREEN CARD — only on a phone or tablet that has not installed
          the app or dismissed this, and gone for good once dismissed. The
          negative margin pulls the greeting back up under it, since this
          container spaces its children a long way apart. */}
      <InstallHint className="-mb-4" />

      {/* GREETING */}
      <div data-tour="tour-welcome">
        <h1 className="text-3xl font-extrabold text-white">
          Good {timeOfDay}, {greetingName}
        </h1>
        <p className="text-white/50 mt-1">
          {dealer?.name ?? "Your dealership"} — here's where things stand today.
        </p>
      </div>

      {/* HEADLINE NUMBERS */}
      {/* On a phone the five tiles sit two to a row; the odd one out spans the
          full row instead of sitting alone beside an empty gap. */}
      <div
        data-tour="tour-headline-stats"
        className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1"
      >
        <HeroStat
          label="Stock Value"
          value={`£${stockValue.toLocaleString()}`}
          icon={<FiDollarSign />}
          accent="green"
          onClick={() => navigate("/dealer/inventory/list")}
        />
        <HeroStat
          label="Profit This Month"
          value={`£${profitThisMonth.toLocaleString()}`}
          icon={<FiTrendingUp />}
          accent={profitThisMonth >= 0 ? "green" : "red"}
          onClick={() => navigate("/bookkeeping")}
        />
        <HeroStat
          label="Sold This Month"
          value={salesThisMonth.length}
          icon={<FiCheckSquare />}
          accent="blue"
          onClick={() => navigate("/bookkeeping")}
        />
        <HeroStat
          label="Open Leads"
          value={openLeads.length}
          icon={<FiUsers />}
          accent="gold"
          onClick={() => navigate("/dealer/sales")}
        />
        <HeroStat
          label="Today's Appointments"
          value={todaysAppointments.length}
          icon={<FiCalendar />}
          accent="purple"
          onClick={() => navigate("/appointments")}
        />
      </div>

      <SupernovaMarketTicker items={tickerItems} />
      <PilotBrainWatcherCard />
      <PilotBrainMarketCard />
      <DealerModeToggle />

      {/* TODAY'S ACTIONS */}
      <SupernovaSectionDivider label="Today's Actions" />
      <div data-tour="tour-todays-actions" className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <SupernovaCard
          title="MOT Expiring Soon"
          icon={<FiAlertTriangle className="cosmic-pulse" />}
          accent="red"
          {...(motAlerts[0]?.id ? { to: `/dealer/workflow/mot/${motAlerts[0].id}` } : {})}
        >
          <p className="text-white/70">{motAlerts.length} vehicles need MOT attention</p>
        </SupernovaCard>

        <SupernovaCard
          title="MOT Advisories"
          icon={<FiTool className="cosmic-pulse" />}
          accent="gold"
          {...(reconNeeded[0]?.id ? { to: `/dealer/workflow/mot/${reconNeeded[0].id}` } : {})}
        >
          <p className="text-white/70">{reconNeeded.length} vehicles have MOT advisories</p>
        </SupernovaCard>

        <SupernovaCard
          title="No Asking Price"
          icon={<FiTrendingUp className="cosmic-pulse" />}
          accent="blue"
          {...(pricingNeeded[0]?.id ? { to: `/dealer/workflow/pricing/${pricingNeeded[0].id}` } : {})}
        >
          <p className="text-white/70">{pricingNeeded.length} vehicles have no asking price</p>
        </SupernovaCard>
      </div>

      {/* SECOND ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <SupernovaCard
          title="Photos Needed"
          icon={<FiCamera className="cosmic-pulse" />}
          accent="purple"
          {...(photoNeeded[0]?.id ? { to: `/dealer/workflow/photos/${photoNeeded[0].id}` } : {})}
        >
          <p className="text-white/70">{photoNeeded.length} vehicles need photos</p>
        </SupernovaCard>

        <SupernovaCard
          title="Ageing Stock"
          icon={<FiAlertTriangle className="cosmic-pulse" />}
          accent="orange"
          to="/dealer/inventory/list"
        >
          <p className="text-white/70">{financeIssues.length} vehicles in stock for 90+ days</p>
        </SupernovaCard>

        <SupernovaCard
          title="Inventory Overview"
          icon={<FiList className="cosmic-pulse" />}
          accent="green"
          to="/dealer/inventory"
        >
          <p className="text-white/70">{safeVehicles.length} vehicles in stock</p>
        </SupernovaCard>
      </div>

      {/* THIRD ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <SupernovaCard
          title="Open Jobs"
          icon={<FiCheckSquare className="cosmic-pulse" />}
          accent={overdueJobs.length > 0 ? "red" : "blue"}
          to="/jobs"
        >
          <p className="text-white/70">
            {openJobs.length} open{overdueJobs.length > 0 ? ` • ${overdueJobs.length} overdue` : ""}
          </p>
        </SupernovaCard>
      </div>

      {/* RECENT ACTIVITY */}
      <SupernovaSectionDivider label="Recent Activity" />

      <div className="bg-black/20 border border-white/10 rounded-xl p-6 backdrop-blur-xl">
        {recentActivity.length === 0 ? (
          <p className="text-white/60 text-sm">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/dealer/inventory/${a.id}`)}
                className="w-full text-left px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white/80 hover:bg-black/50 transition"
              >
                <div className="font-semibold text-yellow-300">{a.title}</div>
                <div className="text-xs text-white/50">{a.timestamp}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DEALER MODULES */}
      <SupernovaSectionDivider label="Dealer Modules" />

      <div data-tour="tour-dealer-modules" className="grid grid-cols-1 md:grid-cols-2 gap-10">

        <SupernovaCard
          title="Inventory Module"
          icon={<FiList className="cosmic-pulse" />}
          accent="green"
        >
          <GoldButton onPress={() => navigate("/dealer/inventory")}>View Inventory</GoldButton>
          <div data-tour="tour-add-vehicle">
            <GoldButton onPress={() => navigate("/new-flip")}>Add Vehicle</GoldButton>
          </div>
          <GoldButton onPress={() => navigate("/dealer/inventory/mot-lookup")}>MOT Lookup</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/inventory/list")}>Vehicle List</GoldButton>
        </SupernovaCard>

        <SupernovaCard
          title="Sales Module"
          icon={<FiUsers className="cosmic-pulse" />}
          accent="blue"
        >
          <GoldButton onPress={() => navigate("/dealer/sales/add")}>Add Lead</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/sales/pipeline")}>Sales Pipeline</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/intelligence/crm")}>Lead Summary</GoldButton>
        </SupernovaCard>

        <SupernovaCard
          title="Finance Module"
          icon={<FiDollarSign className="cosmic-pulse" />}
          accent="gold"
        >
          <GoldButton onPress={() => navigate("/dealer/finance/calculator")}>Finance Calculator</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/finance/deal-sheet")}>Deal Sheet</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/finance/lender-comparison")}>Lender Comparison</GoldButton>
        </SupernovaCard>

        <SupernovaCard
          title="Recon Module"
          icon={<FiTool className="cosmic-pulse" />}
          accent="red"
        >
          <GoldButton
            onPress={() =>
              forSale[0]?.id &&
              navigate(`/dealer/workflow/recon/${forSale[0].id}`)
            }
          >
            Recon Workflow
          </GoldButton>
          <GoldButton onPress={() => navigate("/bookkeeping/add-cost")}>Add Cost</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/inventory/parts-labour")}>Parts & Labour Log</GoldButton>
        </SupernovaCard>

        <SupernovaCard
          title="Intelligence Module"
          icon={<FiBarChart2 className="cosmic-pulse" />}
          accent="purple"
        >
          <GoldButton onPress={() => navigate("/dealer/intelligence/motors")}>Motors Dashboard</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/intelligence/risk")}>Risk Hub</GoldButton>
        </SupernovaCard>

        <SupernovaCard
          title="Bookkeeping Module"
          icon={<FiSettings className="cosmic-pulse" />}
          accent="orange"
        >
          <GoldButton onPress={() => navigate("/bookkeeping/add-purchase")}>Add Purchase</GoldButton>
          <GoldButton onPress={() => navigate("/bookkeeping/add-sale")}>Add Sale</GoldButton>
          <GoldButton onPress={() => navigate("/bookkeeping/add-transaction")}>Add Transaction</GoldButton>
        </SupernovaCard>

      </div>

      <style>{`
        .cosmic-pulse {
          animation: cosmicPulse 3s ease-in-out infinite;
        }
        @keyframes cosmicPulse {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
      `}</style>

    </div>
  );
}
