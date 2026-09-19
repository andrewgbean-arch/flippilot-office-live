// Two pieces of standing knowledge for Pilot Brain (Wendy) that aren't
// figures: where things live in the app, and where she herself is going.
//
// The app map mirrors the dealer sidebars exactly, and
// pilotBrainGuide.test.ts reads the real sidebar files and fails if they
// drift apart, so a link added to the app can't be left out of what she
// tells Boss. Support-admin links are left out on purpose: they only show
// to FlipPilot's own staff, never to a dealer.

export interface AppMapSection {
  section: string;
  items: string[];
}

// The left sidebar (components/DealerSidebar.tsx).
export const APP_MAP: AppMapSection[] = [
  { section: "Dashboard", items: ["Dealer Dashboard"] },
  { section: "Pilot Brain", items: ["Talk to Pilot Brain", "Operations (Approvals)", "Strategy (Goals & Briefing)"] },
  { section: "Jobs", items: ["Jobs Board", "Workshop Calendar"] },
  { section: "Consumables", items: ["Stock & Ordering"] },
  { section: "Customers", items: ["Customer Database"] },
  { section: "Contacts", items: ["Suppliers & Contacts"] },
  { section: "Diary", items: ["My Diary"] },
  { section: "Message Board", items: ["Team Message Board", "Contact a Team Member", "Contact FlipPilot Support"] },
  { section: "Vehicles", items: ["Inventory Hub", "Import from CSV"] },
  {
    section: "Sales",
    items: ["Sales Hub", "Add Lead", "Leads Dashboard", "Sales Pipeline", "Viewing & Test Drive Requests"],
  },
  {
    section: "Finance Suite",
    items: [
      "Finance Hub",
      "Finance Calculator",
      "Deal Sheet",
      "Lender Comparison",
      "Profit Breakdown",
      "Trade-In Valuation",
      "Contract Generator",
    ],
  },
  {
    section: "Staff",
    items: ["My Rota", "Staff Dashboard", "Message a Teammate", "Add Staff", "Rota Planner", "Permissions"],
  },
  {
    section: "Intelligence",
    items: [
      "Market Intelligence",
      "Motors Dashboard",
      "Pricing Brain",
      "CRM Intelligence",
      "Risk Intelligence",
      "Master Brain",
    ],
  },
  {
    section: "Analytics",
    items: [
      "Analytics Hub",
      "Sales Analytics",
      "Inventory Analytics",
      "Pricing Analytics",
      "Market Trends",
      "Lead Conversion",
      "Staff Analytics",
      "Branch Comparison",
    ],
  },
  { section: "Marketing", items: ["Marketing Hub", "Marketplace Sync"] },
  { section: "Bookkeeping", items: ["Bookkeeping Hub"] },
  { section: "Risk", items: ["Risk Hub"] },
  { section: "AI", items: ["AI Insights"] },
  { section: "Tools", items: ["Tools Hub"] },
  { section: "Settings", items: ["Settings", "Billing"] },
  { section: "Workflows", items: ["Finance Workflow"] },
];

// The right sidebar (components/DealerRightSidebar.tsx): quick links, then
// an "at a glance" panel of three live figures.
export const RIGHT_SIDEBAR_QUICK_LINKS = [
  "Add Vehicle",
  "Add Lead",
  "Vehicle List",
  "Jobs Board",
  "My Rota",
  "Consumables",
  "Search",
];
export const RIGHT_SIDEBAR_GLANCE = ["Open Jobs", "Pending Bookings", "MOT Attention"];

export function appMapPromptSection(): string {
  const left = APP_MAP.map(s => `${s.section}: ${s.items.join(", ")}`).join("; ");
  return [
    `WHERE THINGS LIVE IN FLIPPILOT — the left sidebar, exactly as Boss sees it (each section opens to the links listed; a few links may not show for every staff role): ${left}.`,
    `The right-hand sidebar has quick links (${RIGHT_SIDEBAR_QUICK_LINKS.join(", ")}) and an at-a-glance panel showing ${RIGHT_SIDEBAR_GLANCE.join(", ")} — the snapshot below carries the same information.`,
    `When Boss asks where to find something or how to do it, point to the exact sidebar section and link name from this list, and never invent a screen or menu that isn't here. Knowing where a screen is doesn't mean you can see what's inside it: the customer database, wages, private messages and pictures stay off-limits to you, as set out below.`,
  ].join(" ");
}

export function roadmapPromptSection(): string {
  return [
    `YOUR ROADMAP, so you never mis-describe what exists: V1-V7 above are built and live. V8, "Digital Twin", is PLANNED and NOT BUILT. It is a Simulator that tests a decision side by side before real money is risked (for example "what if we buy another £150k of stock?", with every assumption printed and confidence shown as low, medium or high — never a made-up percentage), a Devil's Advocate ("challenge me": the case for, the case against, assumptions, unknowns, downside, an alternative and your view), and a Decision Journal (each significant decision recorded with what was expected, then reviewed about 90 days later against what actually happened).`,
    `None of the three exists yet. If Boss asks for one, say plainly that it is planned and not built, then offer what you can genuinely do today: the existing one-variable what-if scenarios, and challenging his thinking in conversation from the real evidence. Never present a projection as a simulation result and never claim to keep a decision journal. Versions unlock on evidence, not dates, and V8 waits until the data underneath it is trustworthy. Whatever you become, Boss decides.`,
  ].join(" ");
}
