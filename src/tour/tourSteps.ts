// One walkthrough of the real app, spanning multiple real pages. Each
// step names a route (the tour navigates there itself — the dealer
// never has to find their own way through the sidebar mid-tour) and a
// data-tour id the corresponding page's real content is tagged with,
// so the spotlight always lands on something genuinely on screen
// rather than a guessed position.
export interface TourStep {
  id: string;
  // Some steps (a real vehicle's own page) can't be a fixed URL — the
  // route is resolved at tour-run time against this dealer's actual
  // data. Returning null means "skip this step" (e.g. no vehicles in
  // stock yet to show a vehicle page for) rather than navigating
  // somewhere broken.
  route: string | ((ctx: TourRouteContext) => string | null);
  target: string; // matches a data-tour="..." attribute on the page
  title: string;
  narration: string;
}

export interface TourRouteContext {
  firstVehicleId: string | null;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/dealer-dashboard",
    target: "tour-welcome",
    title: "Welcome to FlipPilot",
    narration:
      "Welcome to FlipPilot Dealer OS. This is your dashboard — it's the first thing you'll see every time you log in. Let's take a proper look around, including the buttons and tabs you'll actually use day to day.",
  },
  {
    id: "headline-stats",
    route: "/dealer-dashboard",
    target: "tour-headline-stats",
    title: "Your numbers, at a glance",
    narration:
      "These five tiles show your real stock value, profit this month, sales, open leads, and today's appointments — all computed live from your own data. Click any tile to jump straight to it.",
  },
  {
    id: "todays-actions",
    route: "/dealer-dashboard",
    target: "tour-todays-actions",
    title: "Today's Actions",
    narration:
      "These cards flag exactly what needs your attention right now — vehicles with an MOT expiring soon, recon that's needed, and pricing that needs a review. Click a card to jump straight to that vehicle.",
  },
  {
    id: "add-vehicle",
    route: "/dealer-dashboard",
    target: "tour-add-vehicle",
    title: "Adding a vehicle",
    narration:
      "When you're ready to add a car to your stock, this is the button. You can also bring in a whole list at once using CSV import from Settings.",
  },
  {
    id: "dealer-modules",
    route: "/dealer-dashboard",
    target: "tour-dealer-modules",
    title: "Every part of the app, from here",
    narration:
      "These module cards are quick access to everything — inventory, sales, finance, recon, market intelligence, and bookkeeping. We'll walk through the main ones now.",
  },
  {
    id: "vehicle-list",
    route: "/dealer/inventory/list",
    target: "tour-vehicle-list",
    title: "Your vehicle list",
    narration:
      "This is your full stock. Every vehicle shows its price, how long it has been in stock and its MOT status at a glance, with ULEZ compliance when the fuel type is known. Search, filter and sort from the bar above.",
  },
  {
    id: "vehicle-list-buttons",
    // These buttons live on a vehicle's row, so a dealer with no stock
    // yet (every new account now starts that way) has nothing to
    // spotlight — skip it, same as the vehicle-record step below.
    route: (ctx) => (ctx.firstVehicleId ? "/dealer/inventory/list" : null),
    target: "tour-vehicle-list-buttons",
    title: "Opening a vehicle",
    narration:
      "Tap any vehicle, or its Overview button, to open its full record. The MOT button jumps straight to its MOT history and health score.",
  },
  {
    id: "vehicle-overview-tabs",
    route: (ctx) => (ctx.firstVehicleId ? `/dealer/inventory/${ctx.firstVehicleId}` : null),
    target: "tour-vehicle-tabs",
    title: "A vehicle's full record",
    narration:
      "Once you're on a vehicle, these tabs cover everything about it — an overview, its full MOT history, AI insights, every cost logged against it, its profit breakdown, and editing its details.",
  },
  {
    id: "consumables",
    route: "/consumables",
    target: "tour-consumables",
    title: "Stock and parts",
    narration:
      "Track parts and consumables here — stock levels, reorder thresholds, and a full movement history every time stock is used or received.",
  },
  {
    id: "consumables-buttons",
    route: "/consumables",
    target: "tour-consumables-buttons",
    title: "Adding stock",
    narration:
      "Add a single item here, or import your whole parts list at once from a CSV file.",
  },
  {
    id: "sales",
    route: "/dealer/sales",
    target: "tour-sales",
    title: "Leads and sales",
    narration: "This is your sales hub — an overview of your pipeline and recent lead activity.",
  },
  {
    id: "sales-actions",
    route: "/dealer/sales",
    target: "tour-sales-actions",
    title: "Working your leads",
    narration:
      "Add a new lead the moment you get one, view every lead you have, or see your whole sales pipeline from here.",
  },
  {
    id: "bookkeeping",
    route: "/bookkeeping",
    target: "tour-bookkeeping",
    title: "Bookkeeping",
    narration:
      "Record purchases, costs, and sales here. VAT is calculated automatically, including the margin scheme most independent dealers trade under.",
  },
  {
    id: "bookkeeping-actions",
    route: "/bookkeeping",
    target: "tour-bookkeeping-actions",
    title: "Recording money in and out",
    narration:
      "Add Purchase when you buy a car, Add Cost for recon or parts, Add Sale when one sells, and Add Transaction for anything else like rent or insurance.",
  },
  {
    id: "staff",
    route: "/dealer/staff",
    target: "tour-staff",
    title: "Your team",
    narration: "Manage your staff here, or invite a new teammate from Settings.",
  },
  {
    id: "settings",
    route: "/dealer/settings",
    target: "tour-settings",
    title: "Settings",
    narration: "This is Settings — your dealership profile, account security, and team all live here.",
  },
  {
    id: "settings-cards",
    route: "/dealer/settings",
    target: "tour-settings-cards",
    title: "Everything in one place",
    narration:
      "Edit your dealer profile, change your password, invite a teammate, import a CSV, or come back to this tour any time — right here. That's the whole tour, thanks for watching.",
  },
];
