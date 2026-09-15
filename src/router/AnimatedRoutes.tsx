import { Routes, Route, Navigate } from "react-router-dom";
import DealerLayout from "@/layouts/DealerLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

/* AUTH */
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import JoinScreen from "@/screens/JoinScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";

/* BILLING */
import BillingScreen from "@/screens/BillingScreen";

/* LEGAL */
import TermsScreen from "@/screens/TermsScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";

/* HOME */
import SearchScreen from "@/screens/SearchScreen";
import ImportScreen from "@/screens/ImportScreen";
import ContactsBoard from "@/contacts/ContactsBoard";
import DiaryBoard from "@/diary/DiaryBoard";

/* PUBLIC BOOKING */
import PublicBookingPage from "@/public/PublicBookingPage";
import PublicDealerPage from "@/public/PublicDealerPage";
import AppointmentsBoard from "@/appointments/AppointmentsBoard";

/* DASHBOARD */
import DealerDashboard from "@/dealer/dashboard/DealerDashboard";

/* FEEDBACK & CONSUMABLES */
import FeedbackBoard from "@/feedback/FeedbackBoard";
import ConsumablesBoard from "@/consumables/ConsumablesBoard";
import WorkshopCalendar from "@/jobs/WorkshopCalendar";

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
import LeadDetails from "@/dealer/leads/LeadDetails";

/* FINANCE */
import FinanceHub from "@/dealer/finance/FinanceHub";
import FinanceCalculator from "@/dealer/finance/FinanceCalculator";
import DealSheet from "@/dealer/finance/DealSheet";
import LenderComparison from "@/dealer/finance/LenderComparison";
import ProfitBreakdown from "@/dealer/finance/ProfitBreakdown";
import TradeInValuation from "@/dealer/finance/TradeInValuation";
import ContractGenerator from "@/dealer/finance/ContractGenerator";

/* MARKETING */
import MarketingHub from "@/dealer/marketing/MarketingHub";
import MarketplaceSync from "@/dealer/marketing/MarketplaceSync";

/* TOOLS + SETTINGS */
import ToolsHub from "@/dealer/tools/ToolsHub";
import Settings from "@/dealer/settings/Settings";

/* BOOKKEEPING */
import BookkeepingScreen from "@/bookkeeping/BookkeepingScreen";
import JobsBoard from "@/jobs/JobsBoard";
import AddCostScreen from "@/bookkeeping/AddCostScreen";
import AddPurchaseScreen from "@/bookkeeping/AddPurchaseScreen";
import AddSaleScreen from "@/bookkeeping/AddSaleScreen";
import AddTransactionScreen from "@/bookkeeping/AddTransactionScreen";
import BookkeepingEntryScreen from "@/bookkeeping/BookkeepingEntryScreen";
import Invoice from "@/bookkeeping/Invoice";
import SupplierAnalytics from "@/bookkeeping/SupplierAnalytics";
import SupplierDetail from "@/bookkeeping/SupplierDetail";

/* STAFF */
import { StaffDashboard } from "@/staff/StaffDashboard";
import AddStaff from "@/staff/AddStaff";
import PermissionsManager from "@/staff/PermissionsManager";
import StaffDetail from "@/staff/StaffDetail";
import RotaPlanner from "@/staff/RotaPlanner";
import MyRota from "@/staff/MyRota";

/* AI */
import AIInsights from "@/dealer/AIInsights";

/* ANALYTICS */
import AnalyticsHub from "@/dealer/analytics/AnalyticsHub";
import SalesAnalytics from "@/dealer/analytics/SalesAnalytics";
import InventoryAnalytics from "@/dealer/analytics/InventoryAnalytics";
import PricingAnalytics from "@/dealer/analytics/PricingAnalytics";
import MarketTrends from "@/dealer/analytics/MarketTrends";
import LeadConversionAnalytics from "@/dealer/analytics/LeadConversionAnalytics";
import StaffAnalytics from "@/dealer/analytics/StaffAnalytics";
import BranchComparison from "@/dealer/analytics/BranchComparison";

/* INTELLIGENCE */
import MarketIntelligence from "@/dealer/intelligence/MarketIntelligence";
import DealerMotorsDashboard from "@/dealer/intelligence/DealerMotorsDashboard";
import PricingBrain from "@/dealer/intelligence/PricingBrain";
import DealerCRMIntelligence from "@/dealer/intelligence/DealerCRMIntelligence";
import DealerRiskHub from "@/dealer/intelligence/DealerRiskHub";
import MasterBrainRoute from "@/dealer/intelligence/MasterBrainRoute";

/* WORKFLOWS */
import FinanceWorkflow from "@/dealer/workflow/FinanceWorkflow";
import PhotosWorkflow from "@/dealer/workflow/photos/PhotosWorkflow";
import PricingWorkflow from "@/dealer/workflow/PricingWorkflow";
import ReconWorkflow from "@/features/dealer-ai/recon/ReconWorkflow";
import MOTWorkflow from "@/dealer/workflow/MOTWorkflow";
import MOTWorkflowPortfolio from "@/dealer/workflow/MOTWorkflowPortfolio";

/* DEALER AI */
import MOTTimeline from "@/features/dealer-ai/mot/MOTTimeline";

/* MISC */
import NewVehicle from "@/bookkeeping/vehicles/NewVehicle";
import MotScanner from "@/bookkeeping/vehicles/MotLookup";
import DealerPublicPage from "@/dealer/public/DealerPublicPage";

/* NOT FOUND */
import NotFoundScreen from "@/screens/NotFoundScreen";

export default function AnimatedRoutes() {
  return (
    <Routes>
      {/* PUBLIC BOOKING — no account, no sidebar/nav chrome, the one
          page a customer reaches directly */}
      <Route path="/book/:dealershipId" element={<PublicBookingPage />} />
      <Route path="/store/:dealershipId" element={<PublicDealerPage />} />

      {/* AUTH — outside DealerLayout, no sidebar/nav chrome */}
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="/join" element={<JoinScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingScreen />
          </ProtectedRoute>
        }
      />
      <Route path="/terms" element={<TermsScreen />} />
      <Route path="/privacy" element={<PrivacyScreen />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DealerLayout />
          </ProtectedRoute>
        }
      >

        {/* HOME — was a decorative launcher (HomeScreen.tsx) with three
            hardcoded "Dealership Score 82 / Strong" style stat tiles and
            a stale "Supernova Dealer Intelligence V12" tagline, sitting
            apart from the real DealerDashboard that already computes all
            of that for real. Redirecting instead of rendering it inline
            keeps this at its own URL (/dealer-dashboard), so the global
            footer/quick-links sidebar behave the same here as everywhere
            else in the app rather than being suppressed by the "isHome"
            checks that hid them specifically for the old launcher page. */}
        <Route index element={<Navigate to="/dealer-dashboard" replace />} />

        {/* SEARCH */}
        <Route path="search" element={<SearchScreen />} />

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
        <Route path="dealer/sales/leads/:id" element={<LeadDetails />} />

        {/* FINANCE */}
        <Route path="dealer/finance" element={<FinanceHub />} />
        <Route path="dealer/finance/calculator" element={<FinanceCalculator />} />
        <Route path="dealer/finance/deal-sheet" element={<DealSheet />} />
        <Route path="dealer/finance/lender-comparison" element={<LenderComparison />} />
        <Route path="dealer/finance/profit-breakdown" element={<ProfitBreakdown />} />
        <Route path="dealer/finance/trade-in" element={<TradeInValuation />} />
        <Route path="dealer/finance/contract" element={<ContractGenerator />} />

        {/* MARKETING */}
        <Route path="dealer/marketing" element={<MarketingHub />} />
        <Route path="dealer/marketing/sync" element={<MarketplaceSync />} />

        {/* TOOLS */}
        <Route path="dealer/tools" element={<ToolsHub />} />

        {/* SETTINGS */}
        <Route path="dealer/settings" element={<Settings />} />
        <Route path="billing" element={<BillingScreen />} />

        {/* BOOKKEEPING */}
        <Route path="bookkeeping" element={<BookkeepingScreen />} />
        <Route path="jobs" element={<JobsBoard />} />
        <Route path="feedback" element={<FeedbackBoard />} />
        <Route path="consumables" element={<ConsumablesBoard />} />
        <Route path="import" element={<ImportScreen />} />
        <Route path="contacts" element={<ContactsBoard />} />
        <Route path="diary" element={<DiaryBoard />} />
        <Route path="workshop-calendar" element={<WorkshopCalendar />} />
        <Route path="appointments" element={<AppointmentsBoard />} />
        <Route path="bookkeeping/add-cost" element={<AddCostScreen />} />
        <Route path="bookkeeping/add-purchase" element={<AddPurchaseScreen />} />
        <Route path="bookkeeping/add-sale" element={<AddSaleScreen />} />
        <Route path="bookkeeping/add-transaction" element={<AddTransactionScreen />} />
        <Route path="bookkeeping/entry/:vehicleId" element={<BookkeepingEntryScreen />} />
        <Route path="bookkeeping/invoice/:vehicleId" element={<Invoice />} />
        <Route path="bookkeeping/suppliers" element={<SupplierAnalytics />} />
        <Route path="supplier/:id" element={<SupplierDetail />} />

        {/* STAFF */}
        <Route path="dealer/staff" element={<StaffDashboard />} />
        <Route path="dealer/staff/add" element={<AddStaff />} />
        <Route path="dealer/staff/permissions" element={<PermissionsManager />} />
        <Route path="dealer/staff/planner" element={<RotaPlanner />} />
        <Route path="my-rota" element={<MyRota />} />
        <Route path="dealer/staff/:id" element={<StaffDetail />} />

        {/* RISK */}
        <Route path="dealer/risk" element={<DealerRiskHub />} />

        {/* AI */}
        <Route path="ai-insights" element={<AIInsights />} />

        {/* INTELLIGENCE */}
        <Route path="dealer/intelligence" element={<MarketIntelligence />} />
        <Route path="dealer/intelligence/market" element={<MarketIntelligence />} />
        <Route path="dealer/intelligence/motors" element={<DealerMotorsDashboard />} />
        <Route path="dealer/intelligence/pricing" element={<PricingBrain />} />
        <Route path="dealer/intelligence/crm" element={<DealerCRMIntelligence />} />
        <Route path="dealer/intelligence/risk" element={<DealerRiskHub />} />
        <Route path="dealer/intelligence/brain" element={<MasterBrainRoute />} />

        {/* ANALYTICS */}
        <Route path="dealer/analytics" element={<AnalyticsHub />} />
        <Route path="dealer/analytics/sales" element={<SalesAnalytics />} />
        <Route path="dealer/analytics/inventory" element={<InventoryAnalytics />} />
        <Route path="dealer/analytics/pricing" element={<PricingAnalytics />} />
        <Route path="dealer/analytics/market-trends" element={<MarketTrends />} />
        <Route path="dealer/analytics/lead-conversion" element={<LeadConversionAnalytics />} />
        <Route path="dealer/analytics/staff" element={<StaffAnalytics />} />
        <Route path="dealer/analytics/branches" element={<BranchComparison />} />

        {/* WORKFLOWS */}
        <Route path="dealer/workflow/finance" element={<FinanceWorkflow />} />
        <Route path="dealer/workflow/photos/:id" element={<PhotosWorkflow />} />
        <Route path="dealer/workflow/pricing/:id" element={<PricingWorkflow />} />
        <Route path="dealer/workflow/recon/:id" element={<ReconWorkflow />} />
        <Route path="dealer/workflow/mot/:id" element={<MOTWorkflow />} />
        <Route path="dealer/workflow/mot" element={<MOTWorkflowPortfolio />} />

        {/* DEALER AI */}
        <Route path="dealer-ai/mot/:id" element={<MOTTimeline />} />

        {/* MISC */}
        <Route path="new-flip" element={<NewVehicle />} />
        <Route path="mot-scanner" element={<MotScanner />} />
        <Route path="marketplace" element={<DealerPublicPage />} />

        {/* NOT FOUND */}
        <Route path="*" element={<NotFoundScreen />} />

      </Route>
    </Routes>
  );
}