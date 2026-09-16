// One walkthrough of the real app, spanning multiple real pages. Each
// step names a route (the tour navigates there itself — the dealer
// never has to find their own way through the sidebar mid-tour) and a
// data-tour id the corresponding page's real content is tagged with,
// so the spotlight always lands on something genuinely on screen
// rather than a guessed position.
export interface TourStep {
  id: string;
  route: string;
  target: string; // matches a data-tour="..." attribute on the page
  title: string;
  narration: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/dealer-dashboard",
    target: "tour-welcome",
    title: "Welcome to FlipPilot",
    narration:
      "Welcome to FlipPilot Dealer OS. This is your dashboard — it's the first thing you'll see every time you log in. Let's take a quick look around.",
  },
  {
    id: "headline-stats",
    route: "/dealer-dashboard",
    target: "tour-headline-stats",
    title: "Your numbers, at a glance",
    narration:
      "These five tiles show your real stock value, profit this month, sales, open leads, and today's appointments — all computed live from your own data.",
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
    id: "vehicle-list",
    route: "/dealer/inventory/list",
    target: "tour-vehicle-list",
    title: "Your vehicle list",
    narration:
      "This is your full inventory. Every vehicle shows its MOT status and ULEZ compliance at a glance — click any one to see its full record.",
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
    id: "sales",
    route: "/dealer/sales",
    target: "tour-sales",
    title: "Leads and sales",
    narration:
      "This is your sales hub. Add a new lead, track them through your pipeline, and see recent activity — all in one place.",
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
    id: "staff",
    route: "/dealer/staff",
    target: "tour-staff",
    title: "Your team",
    narration:
      "Manage your staff here, or invite a new teammate from Settings. Each person gets their own login inside your dealership.",
  },
  {
    id: "settings",
    route: "/dealer/settings",
    target: "tour-settings",
    title: "Settings",
    narration:
      "And that's the tour. You can always come back here to Settings and take this tour again, or share it with a new team member.",
  },
];
