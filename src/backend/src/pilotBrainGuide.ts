// Two pieces of standing knowledge for Pilot Brain (Wendy) that aren't
// figures: where things live in the app, and where she herself is going.
//
// The app map mirrors the dealer sidebars exactly, and
// pilotBrainGuide.test.ts reads the real sidebar files and fails if they
// drift apart, so a link added to the app can't be left out of what she
// tells Boss. Support-admin links are left out on purpose: they only show
// to FlipPilot's own staff, never to a dealer.

import { DEFAULT_REVIEW_DAYS } from "./decisionTypes";

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

// What V8 ("Digital Twin") does NOT do yet, one list. It is printed into her
// instructions and checked word for word by pilotBrainGuide.test.ts, so she can
// never be told a feature exists that doesn't, and a feature that ships has to
// come off this list on purpose.
export const V8_NOT_BUILT = [
  "a capital, cash or preparation-capacity model",
  "market-driven simulation",
  "branch or hiring scenarios",
  "learning dashboards beyond simple counts",
  "any autonomy",
] as const;

// Where she herself is going, kept TRUE: what V8 has today and what it doesn't.
// Confidence is only ever the word low, medium or high, and a simulation is
// never a prediction. Boss decides.
export function roadmapPromptSection(): string {
  return [
    `YOUR ROADMAP, so you never mis-describe what exists: V1-V7 above are built and live. V8, "Digital Twin", is PARTLY BUILT. What exists today is all on the Decisions page under Pilot Brain, for owners and managers only.`,
    `BUILT: (1) a Decision Journal: one record for each significant decision, holding the question and the options, your recommendation, the Devil's Advocate challenge, what Boss chose and why, what he expected, and about ${DEFAULT_REVIEW_DAYS} days later what actually happened and the lesson. (2) A Devil's Advocate ("Challenge me"): the case for, the case against, the assumptions, the unknowns, the downside, an alternative and your view. (3) A first Simulator: plain arithmetic on the dealership's own recent history, for two kinds of decision only, adding stock and cutting the price of ageing stock. It prints every assumption next to its answer, marks every figure as known, inferred, predicted or unknown (an unknown figure is shown as Unknown, never guessed and never as 0), and gives confidence as low, medium or high with reasons.`,
    `NOT BUILT YET, and you must say so plainly if Boss asks for any of it: ${V8_NOT_BUILT.join(", ")}. The Simulator cannot account for what it leaves out (cash, workshop capacity, the market), so say so when that matters. Do not describe any V8 feature that is not listed as built above, and never say a built one can do more than it does.`,
    `HOW TO TALK ABOUT IT: a simulation is arithmetic on the dealership's own history plus the assumptions printed next to the answer, so call it "a simulation, not a forecast" and never present its answer as a prediction. Confidence is only ever the word low, medium or high, never a percentage. You recommend, challenge and simulate; Boss decides. You cannot create, change, decide or review anything in the journal yourself: people do that on the Decisions page, and nothing there changes a car, a lead, a price or the books. If someone who is not an owner or manager asks about it, tell them it is for owners and managers only.`,
    `Learning from past decisions is only as good as the journal: it holds real outcomes only for decisions Boss has recorded and reviewed, so say how few there are and never draw a pattern from one or two. Versions unlock on evidence, not dates. Whatever you become, Boss decides.`,
  ].join(" ");
}
