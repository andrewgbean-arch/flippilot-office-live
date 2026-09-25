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


import PilotBrainWatcherCard from "@/pilotbrain/PilotBrainWatcherCard";
import PilotBrainMarketCard from "@/pilotbrain/PilotBrainMarketCard";
import InstallHint from "@/pwa/InstallHint";
import GettingStartedCard from "./GettingStartedCard";

import {
  FiTool,
  FiAlertTriangle,
  FiCamera,
  FiTrendingUp,
  FiUsers,
  FiDollarSign,
  FiCheckSquare,
  FiCalendar,
  FiPlusCircle,
  FiUserPlus,
  FiMessageCircle,
} from "react-icons/fi";
import { formatMoney } from "@/lib/formatMoney";
import { canSeeMoney } from "@/lib/permissions";

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
  // Sales live in the Bookkeeping ledger, which only the owner, managers and
  // finance are sent. Everyone else sees the stock side (a car marked sold is
  // out of stock) instead of a profit and a sold count that would read £0 and 0.
  const money = canSeeMoney(user);
  const soldVehicleIds = new Set(sales.map((s) => s.vehicleId));
  const inStock = money ? safeVehicles.filter((v) => !soldVehicleIds.has(v.id)) : unsold(safeVehicles);
  const stockValue = inStock.reduce((sum, v) => sum + (v.priceRetail ?? 0), 0);

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

  // Recently added to stock, newest first, with the real date each car was
  // added. This box used to be "Recent Activity": when no activity feed was
  // passed in (it never was) it listed five cars stamped with the current
  // time, so it looked as if they had just happened.
  const recentlyAdded = [...forSale]
    .filter((v) => v.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5);

  // Everything that needs doing, as small tiles: coloured when there is
  // something to do, quiet when the count is nought. Was seven large cards.
  const attention: { label: string; count: number; to: string; tone: string; icon: ReactNode }[] = [
    { label: "MOT due or expired", count: motAlerts.length, to: motAlerts[0]?.id ? `/dealer/workflow/mot/${motAlerts[0].id}` : "/dealer/inventory/list", tone: "red", icon: <FiAlertTriangle /> },
    { label: "MOT advisories", count: reconNeeded.length, to: reconNeeded[0]?.id ? `/dealer/workflow/mot/${reconNeeded[0].id}` : "/dealer/inventory/list", tone: "gold", icon: <FiTool /> },
    { label: "No asking price", count: pricingNeeded.length, to: pricingNeeded[0]?.id ? `/dealer/workflow/pricing/${pricingNeeded[0].id}` : "/dealer/inventory/list", tone: "blue", icon: <FiTrendingUp /> },
    { label: "Need photos", count: photoNeeded.length, to: "/photo-studio", tone: "purple", icon: <FiCamera /> },
    { label: "In stock 90+ days", count: financeIssues.length, to: "/dealer/inventory/list", tone: "orange", icon: <FiAlertTriangle /> },
    { label: overdueJobs.length > 0 ? `Open jobs (${overdueJobs.length} overdue)` : "Open jobs", count: openJobs.length, to: "/jobs", tone: overdueJobs.length > 0 ? "red" : "blue", icon: <FiCheckSquare /> },
  ];
  const TONES: Record<string, string> = {
    red: "border-red-400/60 bg-red-500/10 text-red-200",
    gold: "border-yellow-400/60 bg-yellow-400/10 text-yellow-200",
    blue: "border-sky-400/60 bg-sky-500/10 text-sky-200",
    purple: "border-purple-400/60 bg-purple-500/10 text-purple-200",
    orange: "border-orange-400/60 bg-orange-500/10 text-orange-200",
  };

  const quickActions: { label: string; to: string; icon: ReactNode; tour?: string }[] = [
    { label: "Add Vehicle", to: "/new-flip", icon: <FiPlusCircle />, tour: "tour-add-vehicle" },
    { label: "Add Lead", to: "/dealer/sales/add", icon: <FiUserPlus /> },
    ...(money ? [{ label: "Record a Sale", to: "/bookkeeping/add-sale", icon: <FiDollarSign /> }] : []),
    { label: "Ask Wendy", to: "/pilot-brain", icon: <FiMessageCircle /> },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">

      {/* HOME-SCREEN CARD — only on a phone or tablet that has not installed
          the app or dismissed this, and gone for good once dismissed. */}
      <InstallHint className="-mb-2" />

      {/* GREETING */}
      {/* ...plus the four things done most often. These replace the
          "Dealer Modules" cards, which only repeated the menu. */}
      <div data-tour="tour-welcome" className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            Good {timeOfDay}, {greetingName}
          </h1>
          <p className="text-white/50 mt-1">
            {dealer?.name ?? "Your dealership"} — here's where things stand today.
          </p>
        </div>
        <div data-tour="tour-dealer-modules" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              data-tour={a.tour}
              onClick={() => navigate(a.to)}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-bold text-black bg-gradient-to-b from-yellow-300 to-yellow-500 shadow-[0_0_14px_rgba(255,215,0,0.35)] hover:from-yellow-200 hover:to-yellow-400 transition"
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* HEADLINE NUMBERS */}
      {/* On a phone the five tiles sit two to a row; the odd one out spans the
          full row instead of sitting alone beside an empty gap. */}
      <div
        data-tour="tour-headline-stats"
        className={`grid grid-cols-2 ${money ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1`}
      >
        <HeroStat
          label="Stock Value"
          value={formatMoney(stockValue)}
          icon={<FiDollarSign />}
          accent="green"
          onClick={() => navigate("/dealer/inventory/list")}
        />
        {money ? (
          <>
            <HeroStat
              label="Profit This Month"
              value={formatMoney(profitThisMonth, { pence: "auto" })}
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
          </>
        ) : (
          <HeroStat
            label="Cars in Stock"
            value={inStock.length}
            icon={<FiCheckSquare />}
            accent="blue"
            onClick={() => navigate("/dealer/inventory/list")}
          />
        )}
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

      {/* NEEDS YOUR ATTENTION */}
      <section data-tour="tour-todays-actions" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="brand-caps text-xs mb-3">NEEDS YOUR ATTENTION</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {attention.map((a) => {
            const busy = a.count > 0;
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => navigate(a.to)}
                className={`text-left rounded-xl border px-4 py-3 transition hover:brightness-125 ${
                  busy ? TONES[a.tone] : "border-white/10 bg-black/20 text-white/50"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold">
                  {a.icon}
                  {a.label}
                </span>
                <span className={`block mt-1 text-2xl font-extrabold ${busy ? "text-white" : "text-white/40"}`}>
                  {a.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* GETTING STARTED — the four things that make Pilot Brain useful,
          ticked off from the real records; gone once they are all done. */}
      <GettingStartedCard />

      {/* WENDY: what she is watching, and the market check, side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <PilotBrainWatcherCard />
        <PilotBrainMarketCard />
      </div>

      {/* RECENTLY ADDED TO STOCK */}
      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="brand-caps text-xs mb-3">RECENTLY ADDED TO STOCK</h2>
        <div className="bg-black/20 border border-white/10 rounded-xl p-4 backdrop-blur-xl">
          {recentlyAdded.length === 0 ? (
            <p className="text-white/60 text-sm">No cars in stock yet. Add your first one with Add Vehicle.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              {recentlyAdded.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigate(`/dealer/inventory/${v.id}`)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white/80 hover:bg-black/50 transition"
                >
                  <div className="font-semibold text-yellow-300 truncate">{`${v.make} ${v.model}`}</div>
                  <div className="text-xs text-white/50">
                    Added {new Date(v.createdAt as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
