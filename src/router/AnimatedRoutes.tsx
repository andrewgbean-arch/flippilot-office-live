import { Routes, Route } from "react-router-dom";
import DealerLayout from "@/layouts/DealerLayout";

/* HOME */
import HomeScreen from "@/screens/HomeScreen";

/* DASHBOARD */
import DealerDashboard from "@/dealer/dashboard/DealerDashboard";

/* INVENTORY */
import InventoryDashboard from "@/dealer/inventory/InventoryDashboard";
import VehicleOverview from "@/dealer/inventory/VehicleOverview";
import VehicleList from "@/dealer/inventory/VehicleList";
import MOTLookup from "@/dealer/inventory/MOTLookup";
import PartsLabourLog from "@/dealer/inventory/PartsLabourLog";
import ReconditioningTracker from "@/dealer/inventory/ReconditioningTracker";
import MarketComparison from "@/dealer/inventory/MarketComparison";
import VehicleTimeline from "@/dealer/inventory/VehicleTimeline";

/* SALES */
import SalesHub from "@/dealer/sales/SalesHub";
import SalesPipeline from "@/dealer/leads/SalesPipeline";
import LeadsDashboard from "@/dealer/leads/LeadsDashboard";
import AddLead from "@/dealer/leads/AddLead";

/* FINANCE */
import FinanceHub from "@/dealer/finance/FinanceHub";
import FinanceCalculator from "@/dealer/finance/FinanceCalculator";

/* MARKETING */
import MarketingHub from "@/dealer/marketing/MarketingHub";

/* TOOLS + SETTINGS */
import ToolsHub from "@/dealer/tools/ToolsHub";
import Settings from "@/dealer/settings/Settings";

/* BOOKKEEPING */
import BookkeepingScreen from "@/bookkeeping/BookkeepingScreen";
import AddCostScreen from "@/bookkeeping/AddCostScreen";
import AddPurchaseScreen from "@/bookkeeping/AddPurchaseScreen";
import AddSaleScreen from "@/bookkeeping/AddSaleScreen";
import AddTransactionScreen from "@/bookkeeping/AddTransactionScreen";

/* STAFF */
import { StaffDashboard } from "@/staff/StaffDashboard";
import AddStaff from "@/staff/AddStaff";
import PermissionsManager from "@/staff/PermissionsManager";
import StaffDetail from "@/staff/StaffDetail";

/* RISK + AI */
import RiskHub from "@/dealer/risk/RiskHub";
import AIInsights from "@/dealer/AIInsights";

/* ANALYTICS */
import AnalyticsHub from "@/dealer/analytics/AnalyticsHub";

/* INTELLIGENCE */
import MarketIntelligence from "@/dealer/intelligence/MarketIntelligence";
import DealerMotorsDashboard from "@/dealer/intelligence/DealerMotorsDashboard";
import PricingBrain from "@/dealer/intelligence/PricingBrain";
import DealerCRMIntelligence from "@/dealer/intelligence/DealerCRMIntelligence";
import DealerRiskHub from "@/dealer/intelligence/DealerRiskHub";

/* WORKFLOWS */
import FinanceWorkflow from "@/dealer/workflow/FinanceWorkflow";
import PhotosWorkflow from "@/dealer/workflow/photos/PhotosWorkflow";
import PricingWorkflow from "@/dealer/workflow/PricingWorkflow";
import ReconWorkflow from "@/features/dealer-ai/recon/ReconWorkflow";
import MOTWorkflow from "@/dealer/workflow/MOTWorkflow";
import MOTWorkflowPortfolio from "@/dealer/workflow/MOTWorkflowPortfolio";

/* DEALER AI */
import VehicleDetailScreen from "@/features/vehicles/VehicleDetailScreen";
import MOTTimeline from "@/features/dealer-ai/mot/MOTTimeline";

/* MISC */
import NewVehicle from "@/bookkeeping/vehicles/NewVehicle";
import MotScanner from "@/bookkeeping/vehicles/MotLookup";
import DealerPublicPage from "@/dealer/marketplace/DealerPublicPage";

export default function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DealerLayout />}>

        {/* HOME */}
        <Route index element={<HomeScreen />} />

        {/* DASHBOARD */}
        <Route path="dealer-dashboard" element={<DealerDashboard />} />

        {/* INVENTORY */}
        <Route path="dealer/inventory" element={<InventoryDashboard />} />
        <Route path="dealer/inventory/list" element={<VehicleList />} />
        <Route path="dealer/inventory/mot-lookup" element={<MOTLookup />} />
        <Route path="dealer/inventory/parts-labour" element={<PartsLabourLog />} />
        <Route path="dealer/inventory/reconditioning" element={<ReconditioningTracker />} />
        <Route path="dealer/inventory/market-comparison" element={<MarketComparison />} />
        <Route path="dealer/inventory/timeline" element={<VehicleTimeline />} />
        <Route path="dealer/inventory/:id" element={<VehicleOverview />} />

        {/* SALES */}
        <Route path="dealer/sales" element={<SalesHub />} />
        <Route path="dealer/sales/add" element={<AddLead />} />
        <Route path="dealer/sales/pipeline" element={<SalesPipeline />} />
        <Route path="dealer/sales/crm" element={<DealerCRMIntelligence />} />
        <Route path="dealer/sales/leads" element={<LeadsDashboard />} />

        {/* FINANCE */}
        <Route path="dealer/finance" element={<FinanceHub />} />
        <Route path="dealer/finance/calculator" element={<FinanceCalculator />} />

        {/* MARKETING */}
        <Route path="dealer/marketing" element={<MarketingHub />} />

        {/* TOOLS */}
        <Route path="dealer/tools" element={<ToolsHub />} />

        {/* SETTINGS */}
        <Route path="dealer/settings" element={<Settings />} />

        {/* BOOKKEEPING */}
        <Route path="bookkeeping" element={<BookkeepingScreen />} />
        <Route path="bookkeeping/add-cost" element={<AddCostScreen />} />
        <Route path="bookkeeping/add-purchase" element={<AddPurchaseScreen />} />
        <Route path="bookkeeping/add-sale" element={<AddSaleScreen />} />
        <Route path="bookkeeping/add-transaction" element={<AddTransactionScreen />} />

        {/* STAFF */}
        <Route path="dealer/staff" element={<StaffDashboard brain={{}} />} />
        <Route path="dealer/staff/add" element={<AddStaff />} />
        <Route path="dealer/staff/permissions" element={<PermissionsManager />} />
        <Route path="dealer/staff/:id" element={<StaffDetail />} />

        {/* RISK */}
        <Route path="dealer/risk" element={<RiskHub />} />

        {/* AI */}
        <Route path="ai-insights" element={<AIInsights />} />

        {/* INTELLIGENCE */}
        <Route path="dealer/intelligence" element={<MarketIntelligence />} />
        <Route path="dealer/intelligence/market" element={<MarketIntelligence />} />
        <Route path="dealer/intelligence/motors" element={<DealerMotorsDashboard />} />
        <Route path="dealer/intelligence/pricing" element={<PricingBrain />} />
        <Route path="dealer/intelligence/crm" element={<DealerCRMIntelligence />} />
        <Route path="dealer/intelligence/risk" element={<DealerRiskHub />} />

        {/* ANALYTICS */}
        <Route path="dealer/analytics" element={<AnalyticsHub />} />

        {/* WORKFLOWS */}
        <Route path="dealer/workflow/finance" element={<FinanceWorkflow />} />
        <Route path="dealer/workflow/photos/:id" element={<PhotosWorkflow />} />
        <Route path="dealer/workflow/pricing/:id" element={<PricingWorkflow />} />
        <Route path="dealer/workflow/recon/:id" element={<ReconWorkflow />} />
        <Route path="dealer/workflow/mot/:id" element={<MOTWorkflow />} />
        <Route path="dealer/workflow/mot" element={<MOTWorkflowPortfolio />} />

        {/* DEALER AI */}
        <Route path="dealer-ai/vehicle/:id" element={<VehicleDetailScreen />} />
        <Route path="dealer-ai/mot/:id" element={<MOTTimeline />} />

        {/* MISC */}
        <Route path="new-flip" element={<NewVehicle />} />
        <Route path="mot-scanner" element={<MotScanner />} />
        <Route path="marketplace" element={<DealerPublicPage />} />

      </Route>
    </Routes>
  );
}