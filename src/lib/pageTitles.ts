// What each page is called in the browser tab and to a screen reader.
//
// Every tab used to be titled "FlipPilot Dealer OS", so a dealer with Stock,
// Bookkeeping and Leads open in three tabs couldn't tell which was which, and
// a screen reader heard nothing when the page changed.
//
// Keys are route paths exactly as written in router/AnimatedRoutes.tsx
// (with the leading slash added), with `:param` segments for ids.
// pageTitles.test.ts fails if a route is added there without a title here.

export const APP_NAME = "FlipPilot";

export const PAGE_TITLES: Record<string, string> = {
  // Signed out / public
  "/login": "Sign in",
  "/signup": "Create your account",
  "/join": "Join your team",
  "/forgot-password": "Reset your password",
  "/reset-password": "Choose a new password",
  "/onboarding": "Welcome",
  "/terms": "Terms of service",
  "/privacy": "Privacy policy",
  "/book/:dealershipId": "Book a visit",
  "/store/:dealershipId": "Vehicles for sale",

  // Home
  "/": "Dashboard",
  "/search": "Search",
  "/dealer-dashboard": "Dashboard",

  // Stock
  "/dealer/inventory": "Stock overview",
  "/dealer/inventory/list": "Vehicle list",
  "/dealer/inventory/mot-lookup": "MOT lookup",
  "/dealer/inventory/parts-labour": "Parts and labour",
  "/dealer/inventory/:id": "Vehicle",

  // Sales
  "/dealer/sales": "Sales",
  "/dealer/sales/add": "Add a lead",
  "/dealer/sales/pipeline": "Sales pipeline",
  "/dealer/sales/crm": "Lead summary",
  "/dealer/sales/leads": "Leads",
  "/dealer/sales/leads/:id": "Lead",

  // Finance
  "/dealer/finance": "Finance suite",
  "/dealer/finance/calculator": "Finance calculator",
  "/dealer/finance/deal-sheet": "Deal sheet",
  "/dealer/finance/lender-comparison": "Lender comparison",
  "/dealer/finance/profit-breakdown": "Profit breakdown",
  "/dealer/finance/trade-in": "Trade-in",
  "/dealer/finance/contract": "Sales contract",

  // Marketing, tools, settings, billing
  "/dealer/marketing": "Marketing",
  "/dealer/marketing/sync": "Marketing sync",
  "/dealer/tools": "Tools",
  "/dealer/settings": "Settings",
  "/dealer/settings/email": "Email settings",
  "/billing": "Billing",

  // Books
  "/bookkeeping": "Bookkeeping",
  "/bookkeeping/add-cost": "Add a cost",
  "/bookkeeping/add-purchase": "Add a purchase",
  "/bookkeeping/add-sale": "Add a sale",
  "/bookkeeping/add-transaction": "Add a transaction",
  "/bookkeeping/entry/:vehicleId": "Vehicle ledger",
  "/bookkeeping/invoice/:vehicleId": "Invoice",
  "/bookkeeping/suppliers": "Suppliers",
  "/supplier/:id": "Supplier",

  // Day to day
  "/jobs": "Jobs board",
  "/consumables": "Consumables",
  "/import": "Import",
  "/contacts": "Contacts",
  "/customers": "Customers",
  "/diary": "Diary",
  "/workshop-calendar": "Workshop calendar",
  "/appointments": "Appointments",
  "/feedback": "Message board",
  "/support": "Support",

  // Pilot Brain
  "/pilot-brain": "Pilot Brain",
  "/pilot-brain/operations": "Pilot Brain: operations",
  "/pilot-brain/strategy": "Pilot Brain: strategy",
  "/pilot-brain/decisions": "Decision journal",

  // Team
  "/dealer/staff": "Staff",
  "/dealer/staff/message": "Staff messages",
  "/dealer/staff/add": "Add a staff member",
  "/dealer/staff/permissions": "Staff permissions",
  "/dealer/staff/planner": "Rota planner",
  "/my-rota": "My rota",
  "/dealer/staff/:id": "Staff member",

  // Insight and analytics
  "/dealer/risk": "Risk hub",
  "/dealer/intelligence": "Intelligence",
  "/dealer/intelligence/motors": "Motors dashboard",
  "/dealer/intelligence/crm": "Lead summary",
  "/dealer/intelligence/risk": "Risk hub",
  "/dealer/analytics": "Analytics",
  "/dealer/analytics/sales": "Sales analytics",
  "/dealer/analytics/inventory": "Stock analytics",
  "/dealer/analytics/lead-conversion": "Lead conversion",
  "/dealer/analytics/staff": "Staff analytics",
  "/dealer/analytics/branches": "Staff by branch",

  // Workflow
  "/dealer/workflow/finance": "Finance workflow",
  "/dealer/workflow/photos/:id": "Vehicle photos",
  "/dealer/workflow/pricing/:id": "Vehicle pricing",
  "/dealer/workflow/recon/:id": "Vehicle reconditioning",
  "/dealer/workflow/mot/:id": "Vehicle MOT",
  "/dealer/workflow/mot": "MOT workflow",
  "/dealer-ai/mot/:id": "MOT timeline",

  // Misc
  "/new-flip": "Add a vehicle",
  "/mot-scanner": "MOT scanner",
  "/marketplace": "Marketplace",

  // Platform admin
  "/admin/support": "Support admin",
  "/admin/dealerships": "Dealerships admin",
};

export const NOT_FOUND_TITLE = "Page not found";

// "/dealer/inventory/list/" -> "/dealer/inventory/list"; "" -> "/".
function normalise(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

// Does the concrete path fit a `/a/:id/b` style pattern, segment for segment?
function matches(pattern: string, path: string): boolean {
  const want = pattern.split("/");
  const have = path.split("/");
  if (want.length !== have.length) return false;
  return want.every((part, i) => (part.startsWith(":") ? (have[i] ?? "").length > 0 : part === have[i]));
}

// The page's own name for a location, or null when nothing matches it.
export function pageNameFor(pathname: string): string | null {
  const path = normalise(pathname);
  const exact = PAGE_TITLES[path];
  if (exact !== undefined) return exact;
  for (const pattern of Object.keys(PAGE_TITLES)) {
    if (pattern.includes(":") && matches(pattern, path)) return PAGE_TITLES[pattern] ?? null;
  }
  return null;
}

// What goes in the browser tab: "Vehicle list · FlipPilot".
export function documentTitleFor(pathname: string): string {
  return `${pageNameFor(pathname) ?? NOT_FOUND_TITLE} · ${APP_NAME}`;
}
