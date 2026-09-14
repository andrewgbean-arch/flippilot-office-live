import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";

import SupernovaCard from "@/components/SupernovaCard";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import GoldButton from "@/components/ui/GoldButton.web";

import SupernovaDealerHeader from "@/components/supernova/SupernovaDealerHeader";
import SupernovaMarketTicker from "@/components/supernova/SupernovaMarketTicker";
import DealerModeToggle from "@/components/supernova/DealerModeToggle";

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
} from "react-icons/fi";

type Props = {
  brain?: any;
};

export default function DealerDashboard({ brain }: Props) {
  const navigate = useNavigate();
  const { vehicles, loading } = useInventory();

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

  const motAlerts = safeVehicles.filter((v) => {
    const expiry = v.mot?.expiry;
    if (!expiry) return false;
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days <= 30;
  });

  const reconNeeded =
    brain?.workflow?.reconNeeded ??
    safeVehicles.filter((v) => (v.predictedRepairs?.length ?? 0) > 0);

  const pricingNeeded =
    brain?.workflow?.pricingNeeded ??
    safeVehicles.filter((v) => (v.valuationConfidence ?? 100) < 60);

  const photoNeeded =
    brain?.workflow?.photoNeeded ??
    safeVehicles.filter((v) => (v.photoQuality ?? 100) < 60);

  const financeIssues =
    brain?.workflow?.financeIssues ??
    safeVehicles.filter((v) => (v.auctionDelta ?? 0) > 20);

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
      ? `🔧 ${reconNeeded.length} vehicle${reconNeeded.length === 1 ? "" : "s"} flagged for recon`
      : null,
    pricingNeeded.length > 0
      ? `📉 ${pricingNeeded.length} vehicle${pricingNeeded.length === 1 ? "" : "s"} need pricing review`
      : null,
    photoNeeded.length > 0
      ? `📷 ${photoNeeded.length} vehicle${photoNeeded.length === 1 ? "" : "s"} missing photos`
      : null,
    financeIssues.length > 0
      ? `💰 ${financeIssues.length} vehicle${financeIssues.length === 1 ? "" : "s"} flagged for finance risk`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="p-10 space-y-16">

      <SupernovaDealerHeader />
      <SupernovaMarketTicker items={tickerItems} />
      <DealerModeToggle />

      {/* TODAY'S ACTIONS */}
      <SupernovaSectionDivider label="Today's Actions" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <SupernovaCard
          title="MOT Expiring Soon"
          icon={<FiAlertTriangle className="cosmic-pulse" />}
          accent="red"
          to={`/dealer/workflow/mot/${motAlerts[0]?.id ?? ""}`}
        >
          <p className="text-white/70">{motAlerts.length} vehicles need MOT attention</p>
        </SupernovaCard>

        <SupernovaCard
          title="Recon Needed"
          icon={<FiTool className="cosmic-pulse" />}
          accent="gold"
          to={`/dealer/workflow/recon/${reconNeeded[0]?.id ?? ""}`}
        >
          <p className="text-white/70">{reconNeeded.length} vehicles need repairs</p>
        </SupernovaCard>

        <SupernovaCard
          title="Pricing Needed"
          icon={<FiTrendingUp className="cosmic-pulse" />}
          accent="blue"
          to={`/dealer/workflow/pricing/${pricingNeeded[0]?.id ?? ""}`}
        >
          <p className="text-white/70">{pricingNeeded.length} vehicles need pricing review</p>
        </SupernovaCard>
      </div>

      {/* SECOND ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <SupernovaCard
          title="Photos Needed"
          icon={<FiCamera className="cosmic-pulse" />}
          accent="purple"
          to={`/dealer/workflow/photos/${photoNeeded[0]?.id ?? ""}`}
        >
          <p className="text-white/70">{photoNeeded.length} vehicles need photos</p>
        </SupernovaCard>

        <SupernovaCard
          title="Finance Issues"
          icon={<FiAlertTriangle className="cosmic-pulse" />}
          accent="orange"
          to="/dealer/workflow/finance"
        >
          <p className="text-white/70">{financeIssues.length} vehicles have finance risks</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        <SupernovaCard
          title="Inventory Module"
          icon={<FiList className="cosmic-pulse" />}
          accent="green"
        >
          <GoldButton onPress={() => navigate("/dealer/inventory")}>View Inventory</GoldButton>
          <GoldButton onPress={() => navigate("/new-flip")}>Add Vehicle</GoldButton>
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
          <GoldButton onPress={() => navigate("/dealer/intelligence/crm")}>CRM Intelligence</GoldButton>
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
              reconNeeded[0]?.id &&
              navigate(`/dealer/workflow/recon/${reconNeeded[0].id}`)
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
          <GoldButton onPress={() => navigate("/dealer/intelligence/market")}>Market Intelligence</GoldButton>
          <GoldButton onPress={() => navigate("/dealer/intelligence/pricing")}>Pricing Brain</GoldButton>
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

      <div className="text-white/40 text-xs pt-10">
        FlipPilot Dealer OS • Workflow Engine • Supernova V14 Cosmic
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
