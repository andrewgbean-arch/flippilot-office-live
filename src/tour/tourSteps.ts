// The guided tour: every page of the app, in chapters, read by Wendy.
//
// Every line must be TRUE of the app as it is. When a page changes, change its
// step here too; scripts/record-tour.ts then re-records only the lines whose
// words changed. A step whose page someone's role can't open is left out for
// them (tourPlan.ts), so no-one is walked into a lock panel.
//
// Targets: a data-tour="..." id on the page, "css:<selector>", or "" for a card
// in the middle of the screen. If a target isn't on screen (a card the dealer
// has hidden, the side columns on a phone) the card simply sits in the middle.

import type { TourChapter, TourRouteContext } from "./tourPlan";
import { canSeeMoney, isOwner } from "@/lib/permissions";

export type { TourStep, TourChapter } from "./tourPlan";

const car = (path: (id: string) => string) => (ctx: TourRouteContext) => (ctx.firstVehicleId ? path(ctx.firstVehicleId) : null);
const pageTitle = "css:main h1";

export const TOUR_CHAPTERS: TourChapter[] = [
  {
    id: "around",
    title: "Finding your way around",
    blurb: "The dashboard, the menus, the bell and your account.",
    steps: [
      {
        id: "welcome",
        route: "/dealer-dashboard",
        target: "tour-welcome",
        title: "Welcome to FlipPilot",
        narration:
          "Hi, I'm Wendy. Welcome to FlipPilot Dealer OS. This is your dashboard, the first thing you see when you log in. I'll show you where everything is, what each part does, and a few tricks that save time.",
      },
      {
        id: "headline-money",
        route: "/dealer-dashboard",
        target: "tour-headline-stats",
        showIf: user => canSeeMoney(user),
        title: "Your numbers at a glance",
        narration:
          "These tiles are worked out live from your own records: your stock at its asking prices, profit and sales this month from your books, open leads, and today's appointments. Click any tile to jump straight to what's behind it.",
      },
      {
        id: "headline-team",
        route: "/dealer-dashboard",
        target: "tour-headline-stats",
        showIf: user => !canSeeMoney(user),
        title: "Your numbers at a glance",
        narration:
          "These tiles are worked out live from your own records: your stock at its asking prices, how many cars are in stock, open leads, and today's appointments. Click any tile to jump straight to what's behind it.",
      },
      {
        id: "attention",
        route: "/dealer-dashboard",
        target: "tour-todays-actions",
        title: "Needs your attention",
        narration:
          "This row is your to-do list. It counts MOTs due or expired, MOT advisories, cars with no asking price, cars without photos, stock over ninety days, and open jobs. A tile lights up when there's something to do, and clicking it takes you there.",
      },
      {
        id: "quick-actions",
        route: "/dealer-dashboard",
        target: "tour-dealer-modules",
        title: "The things you do most",
        narration:
          "These gold buttons are the everyday jobs: add a vehicle, add a lead, and ask me a question. If you look after the money you'll also see Record a Sale here.",
      },
      {
        id: "getting-started",
        route: "/dealer-dashboard",
        target: "tour-getting-started",
        title: "Getting started",
        narration:
          "While you're new, a Getting started card ticks itself off from your real records as you go, like marking how bookings went, and a photo and an MOT date on every car. Each one makes me more useful. Once it's done, or you hide it, it goes away.",
      },
      {
        id: "watcher",
        route: "/dealer-dashboard",
        target: "tour-watcher",
        title: "I keep watch",
        narration:
          "This card is me keeping watch. Every time the dashboard opens I look over your stock, leads, bookings and jobs, give the business a health score, and flag anything slipping, like an enquiry nobody has answered. The important ones also land in your bell.",
      },
      {
        id: "menu",
        route: "/dealer-dashboard",
        target: "tour-sidebar",
        title: "The menu",
        narration:
          "Everything lives in the menu on the left, in groups: me, stock, sales, customers, the workshop, money, your team, reports and settings. Click a group to open it. You only see the pages your role can open. On a phone, the menu button at the top opens it.",
      },
      {
        id: "snapshot-bar",
        route: "/dealer-dashboard",
        target: "css:section[aria-label=\"Stock snapshot\"]",
        title: "The stock snapshot",
        narration:
          "This strip sits at the top of every page: how many cars you have in stock, their average days in stock, and any MOTs expired or due soon. Each one is clickable.",
      },
      {
        id: "quick-links",
        route: "/dealer-dashboard",
        target: "tour-quick-links",
        title: "Quick links",
        narration:
          "On a wider screen, the column on the right has quick links to the pages you use most, and an at a glance panel with open jobs, bookings waiting for a reply, and MOTs needing attention.",
      },
      {
        id: "bottom-bar",
        route: "/dealer-dashboard",
        target: "tour-bottom-bar",
        title: "The bottom bar",
        narration:
          "The bar along the bottom is always there: add a vehicle, ask me, check an MOT, or search your vehicles and leads, from any page.",
      },
      {
        id: "bell",
        route: "/dealer-dashboard",
        target: "tour-bell",
        title: "Your alerts",
        narration:
          "The bell collects your alerts: a new booking from your website, a message from a teammate, your rota being published, a leave request answered, and things I've spotted. It checks for new ones every minute or so. Click an alert to clear it.",
      },
      {
        id: "account",
        route: "/dealer-dashboard",
        target: "css:button[aria-label^=\"Account menu for\"]",
        title: "Your account",
        narration:
          "Your name at the top right opens your account menu, with Settings and Log out. The Refresh button next to it reloads your stock if someone else has just changed it.",
      },
    ],
  },

  {
    id: "wendy",
    title: "Wendy, your Pilot Brain",
    blurb: "Asking me things, briefings, approvals and goals.",
    steps: [
      {
        id: "ask-wendy",
        route: "/pilot-brain",
        target: "css:.sn-hero",
        title: "Ask me anything",
        narration:
          "This is where you talk to me. I read your own records, your stock, leads, bookings and jobs, so ask real questions: which cars are sticking, which leads need a call, how this month compares with last. Press Enter to send, and Shift and Enter for a new line.",
      },
      {
        id: "wendy-reports",
        route: "/pilot-brain",
        target: "tour-wendy-reports",
        title: "Briefings and reviews",
        narration:
          "Morning Briefing gives you a quick run-down of the day. Get Review looks back over a day, week, month or quarter, and Today's Priorities ranks what to do first. Switch my voice on and I'll read my replies out loud. In Chrome or Edge you can talk to me with the microphone.",
      },
      {
        id: "wendy-honest",
        route: "/pilot-brain",
        target: "",
        title: "What I will and won't do",
        narration:
          "I never change anything on my own. I can prepare a few small changes, like a car's asking price or a lead's status, but a manager or the owner approves them first. I only see what your role can see, and I'll always tell you how sure I am.",
      },
      {
        id: "approvals",
        route: "/pilot-brain/operations",
        target: "tour-prepare-work",
        title: "Approvals",
        narration:
          "Prepare Today's Work has me draft useful jobs from your records: a follow-up for a lead that's gone quiet, a cost that needs a category, a gap in the rota, a booking left without an answer. Nothing happens until a manager or the owner approves it, and approved work can be undone. A follow-up becomes a job on the Jobs Board, it's never sent for you.",
      },
      {
        id: "goals",
        route: "/pilot-brain/strategy",
        target: "css:.sn-hero",
        title: "Goals and briefing",
        narration:
          "Here's the bigger picture: health scores for the business, your greatest opportunity and risk, and what to focus on. Owners and managers can set goals, like cars sold or profit this month, and I'll show whether you're on track.",
      },
      {
        id: "decisions",
        route: "/pilot-brain/decisions",
        target: "css:.sn-hero",
        title: "The Decision Journal",
        narration:
          "For owners and managers: write a big decision down with your options, ask for my view, or press Challenge me and I'll argue the other side. Record what you chose, and at the review date, what actually happened. Over time it shows how good your calls are.",
      },
    ],
  },

  {
    id: "stock",
    title: "Your stock and photos",
    blurb: "Adding cars, a car's full record, Photo Studio and MOTs.",
    steps: [
      {
        id: "add-vehicle",
        route: "/new-flip",
        target: pageTitle,
        title: "Adding a vehicle",
        narration:
          "To add a car, type the registration and press Lookup MOT. I'll fill in the make, model, year, colour and mileage from the government records. Add the prices, the VAT scheme and some photos, then save.",
      },
      {
        id: "stock-overview",
        route: "/dealer/inventory",
        target: pageTitle,
        title: "Stock overview",
        narration:
          "Stock Overview counts what needs doing across your unsold cars: MOTs due, advisories, missing prices, missing photos and anything over ninety days, with buttons to the tools you'll want next.",
      },
      {
        id: "vehicle-list",
        route: "/dealer/inventory/list",
        target: "tour-vehicle-list",
        title: "Your vehicle list",
        narration:
          "This is your full stock. Each car shows its price, days in stock, which turn amber then red as it ages, its MOT and ULEZ status. Search by make, model or registration, filter by in stock or sold, and sort however you like.",
      },
      {
        id: "vehicle-row",
        route: car(() => "/dealer/inventory/list"),
        target: "tour-vehicle-list-buttons",
        title: "Opening a car",
        narration: "Click a car, or its Overview button, to open its full record. The MOT button goes straight to its MOT history.",
      },
      {
        id: "car-page",
        route: car(id => `/dealer/inventory/${id}`),
        target: "tour-vehicle-tabs",
        title: "A car's full record",
        narration:
          "Every car has its own page. The tabs cover its overview and photos, its full MOT history, market pricing from real dealer listings, and editing its details. If you look after the money, its costs and profit are here too.",
      },
      {
        id: "car-passport",
        route: car(id => `/dealer/inventory/${id}`),
        target: "tour-vehicle-tabs",
        title: "The Car Passport",
        narration:
          "The Car Passport tab makes a public web page for the car, with its MOT history and ULEZ status, and the work you've done to it. Switch it live, then print a QR card for the windscreen so buyers can scan it on the forecourt. What you paid is never shown.",
      },
      {
        id: "car-edit",
        route: car(id => `/dealer/inventory/${id}`),
        target: "tour-vehicle-tabs",
        title: "Editing a car",
        narration:
          "On the Edit tab you change its details and price, add photos, and write the listing description. Press Generate with AI and I'll draft the advert from the car's real details, for you to check and change.",
      },
      {
        id: "photo-studio",
        route: "/photo-studio",
        target: pageTitle,
        title: "Photo Studio",
        narration:
          "Photo Studio shows every car in stock, with the ones needing photos first, and how many of the eight key shots each one has. Open a car to work on its pictures.",
      },
      {
        id: "photo-studio-car",
        route: car(id => `/photo-studio/${id}`),
        target: "css:section[aria-label=\"Editor\"]",
        title: "Making photos shine",
        narration:
          "Drag the photos into order and star the main one. Then brighten, straighten and crop, add a banner like Just Arrived or Reduced, put your name in the corner, and cover the number plate. Save it as a new photo or replace the original.",
      },
      {
        id: "photo-posts",
        route: car(id => `/photo-studio/${id}`),
        target: "tour-social-posts",
        title: "Posts for social media",
        narration:
          "One click makes a square post or a story for Facebook and Instagram, with the photo, price, mileage and your phone number. It downloads to your device, ready to post yourself. There's a checklist of the eight shots every car should have.",
      },
      {
        id: "mot-lookup",
        route: "/dealer/inventory/mot-lookup",
        target: "css:input[placeholder^=\"Enter registration\"]",
        title: "MOT lookup",
        narration:
          "Type any registration to see its full government MOT history: advisories, failures and the mileage over the years. If the car is in your stock, its record updates too. Checking a customer's car doesn't add it to your stock.",
      },
      {
        id: "stock-tools",
        route: "/dealer/tools",
        target: pageTitle,
        title: "Stock tools",
        narration:
          "Stock Tools has shortcuts, a simple VIN decoder that reads the make and model year for some brands, and a stock optimiser showing your slow movers over forty days and your fast movers under twenty.",
      },
      {
        id: "import",
        route: "/import",
        target: pageTitle,
        title: "Bringing in a list",
        narration:
          "Already have your stock or parts in a spreadsheet? Save it as a CSV and import it here. I'll match the columns, show you a preview, and nothing is saved until you press Import.",
      },
    ],
  },

  {
    id: "sales",
    title: "Sales and leads",
    blurb: "Leads, bookings, Wanted Cars and your public page.",
    steps: [
      {
        id: "sales-hub",
        route: "/dealer/sales",
        target: "tour-sales",
        title: "Your sales",
        narration: "The sales overview counts your leads: total, active, hot and won, and shows the five newest.",
      },
      {
        id: "sales-actions",
        route: "/dealer/sales",
        target: "tour-sales-actions",
        title: "Working your leads",
        narration: "From here you can add a lead the moment someone calls, see every lead, open the pipeline, or check who's waiting for a car.",
      },
      {
        id: "leads",
        route: "/dealer/sales/leads",
        target: "css:.sn-hero",
        title: "Every lead",
        narration:
          "Every lead has its own card. Open one to update its status, link it to a car in your stock, and run an affordability check with the customer's budget, deposit and outgoings.",
      },
      {
        id: "add-lead",
        route: "/dealer/sales/add",
        target: "css:.sn-form",
        title: "Adding a lead",
        narration:
          "Adding a lead takes seconds: a name, where they came from, a phone or email, and the car they're after. Knowing where each lead came from lets me tell you which sources actually sell cars.",
      },
      {
        id: "pipeline",
        route: "/dealer/sales/pipeline",
        target: pageTitle,
        title: "The pipeline",
        narration: "The pipeline shows how many leads sit at each stage, from new to sold, and your conversion rate.",
      },
      {
        id: "bookings",
        route: "/appointments",
        target: "css:.sn-hero",
        title: "Viewings and test drives",
        narration:
          "Customers book viewings and test drives from your public page, and they arrive here. Confirm or move each one. Share your booking link, and set your opening hours and slot length. Every booking also becomes a lead.",
      },
      {
        id: "outcomes",
        route: "/appointments",
        target: "css:.sn-hero",
        title: "Marking how it went",
        narration:
          "After a viewing, mark whether they showed up, bought, or didn't turn up. It only takes a click, and it's how I learn which bookings turn into sales.",
      },
      {
        id: "wanted",
        route: "/dealer/sales/wanted",
        target: "css:.sn-hero",
        title: "Wanted cars",
        narration:
          "When a customer asks to be told if you get a certain car, they appear here. When a matching car comes into stock, I'll tell the team. Call, text or email them in one tap. Nothing is sent automatically, and their details are removed after twelve months.",
      },
      {
        id: "public-page",
        route: "/dealer/marketing",
        target: pageTitle,
        title: "Your public page",
        narration:
          "This is your public store page, live on the web: your stock, a booking button and a wanted form. Copy the link and put it on your website, social media and adverts.",
      },
      {
        id: "portal-feed",
        route: "/dealer/marketing/sync",
        target: pageTitle,
        title: "Portal stock feed",
        narration:
          "The stock feed is a file of your unsold cars, fresh every time it's opened. Download it, or copy its link for a portal that takes a stock feed. We don't send anything to the portals for you yet.",
      },
    ],
  },

  {
    id: "customers",
    title: "Customers and the workshop",
    blurb: "Customers, suppliers, jobs, the workshop calendar and parts.",
    steps: [
      {
        id: "customers",
        route: "/customers",
        target: "css:.sn-hero",
        title: "Customers",
        narration:
          "Your customer database keeps each person's details and, importantly, whether they've agreed to hear from you by email or WhatsApp, and how they agreed. Only a manager or the owner can erase a customer.",
      },
      {
        id: "contacts",
        route: "/contacts",
        target: "css:.sn-hero",
        title: "Suppliers and contacts",
        narration: "Keep your parts suppliers, auction houses, transport, valeters and anyone else here, so everyone can find a number fast.",
      },
      {
        id: "jobs",
        route: "/jobs",
        target: pageTitle,
        title: "The jobs board",
        narration:
          "The jobs board has three columns: to do, in progress and done. Give a job a car, a person, a priority and a due date. Overdue jobs turn red.",
      },
      {
        id: "workshop-calendar",
        route: "/workshop-calendar",
        target: "css:.sn-hero",
        title: "Workshop calendar",
        narration: "Give a job a workshop day, time and bay, and it appears on this week view. Unscheduled jobs wait underneath until you book them in.",
      },
      {
        id: "consumables",
        route: "/consumables",
        target: "tour-consumables",
        title: "Parts and consumables",
        narration:
          "Track your parts and consumables here. Click a stock figure to record stock in or out, and set a reorder level so you know when you're running low.",
      },
      {
        id: "consumables-order",
        route: "/consumables",
        target: "tour-consumables-buttons",
        title: "Ordering",
        narration:
          "Low items gather in Ready to Order, grouped by supplier. Tick them, set quantities, and Email Order writes one email per supplier in your own mail app.",
      },
    ],
  },

  {
    id: "money",
    title: "Money and finance",
    blurb: "Your books and VAT, profit, and the finance tools.",
    steps: [
      {
        id: "bookkeeping",
        route: "/bookkeeping",
        target: "tour-bookkeeping",
        title: "Your books",
        narration:
          "This is your bookkeeping: what you've spent, your profit and margin on cars you've sold, and what's bought but not yet sold. Click any row for its details and invoice. Only the owner, managers and finance can see it.",
      },
      {
        id: "bookkeeping-actions",
        route: "/bookkeeping",
        target: "tour-bookkeeping-actions",
        title: "Money in and out",
        narration:
          "Add Purchase when you buy a car, Add Cost for recon and parts, Add Sale when one sells, and Add Transaction for anything else, like rent. When you record a sale, I work out the VAT for you, including the margin scheme, and number the invoice.",
      },
      {
        id: "profit-breakdown",
        route: "/dealer/finance/profit-breakdown",
        target: pageTitle,
        title: "Profit breakdown",
        narration: "A quick calculator for one deal: purchase, recon, parts and sale price, with the VAT treatment, to see the real profit before you commit.",
      },
      {
        id: "finance-calculator",
        route: "/dealer/finance/calculator",
        target: pageTitle,
        title: "Finance calculator",
        narration:
          "Put in the price, deposit, term and the lender's APR for an illustrative monthly payment to show a customer. It's a guide, the lender's quote is what counts.",
      },
      {
        id: "deal-sheet",
        route: "/dealer/finance/deal-sheet",
        target: pageTitle,
        title: "Deal sheet",
        narration: "The deal sheet puts a lead's whole deal on one page: price, trade-in, deposit and finance, so you can talk them through it.",
      },
      {
        id: "lender-comparison",
        route: "/dealer/finance/lender-comparison",
        target: pageTitle,
        title: "Lender comparison",
        narration: "Add the quotes you've had from lenders and see their monthly payments side by side, with the cheapest one highlighted.",
      },
      {
        id: "trade-in",
        route: "/dealer/finance/trade-in",
        target: pageTitle,
        title: "Trade-in offers",
        narration:
          "Work out a trade-in offer from the market value you've found: take off a condition allowance, your margin and any finance still owed. It's your figure, not a valuation.",
      },
      {
        id: "contract",
        route: "/dealer/finance/contract",
        target: pageTitle,
        title: "Contracts",
        narration: "Fill in the sale agreement, check the preview, then print it or save it as a PDF for both of you to sign.",
      },
    ],
  },

  {
    id: "team",
    title: "Your team",
    blurb: "Rotas, leave, the diary, messages and staff.",
    steps: [
      {
        id: "my-rota",
        route: "/my-rota",
        target: "css:.sn-hero",
        title: "My rota",
        narration: "My Rota shows your shifts week by week, and your holiday: what you're entitled to, what you've taken, and what's left. Request leave from here.",
      },
      {
        id: "diary",
        route: "/diary",
        target: "css:.sn-hero",
        title: "My diary",
        narration: "Your diary is private to you: to-dos and notes day by day. Tick things off as you go.",
      },
      {
        id: "message-board",
        route: "/feedback",
        target: "css:.sn-hero",
        title: "The team message board",
        narration: "Post to the whole team here, with photos, or anonymously if you'd rather. Managers can mark posts as reviewed or actioned.",
      },
      {
        id: "message-teammate",
        route: "/dealer/staff/message",
        target: "css:.sn-hero",
        title: "Message a teammate",
        narration: "Send one person a private message, with photos if you like. They get it in their bell, and you'll see when it's been received.",
      },
      {
        id: "staff",
        route: "/dealer/staff",
        target: "tour-staff",
        title: "Staff and the time clock",
        narration:
          "The staff page has the time clock, so clock in when you arrive and out when you leave, and today's log of who's in. Below it is your staff list.",
      },
      {
        id: "rota-planner",
        route: "/dealer/staff/planner",
        target: "css:.sn-hero",
        title: "The rota planner",
        narration:
          "Managers build the rota here. Auto-Generate fills a week from each person's work pattern, and Publish sends everyone their shifts. Holiday and sick leave requests are approved or declined here too.",
      },
      {
        id: "add-staff",
        route: "/dealer/staff/add",
        target: "css:.sn-form",
        title: "Staff records",
        narration:
          "Add Staff keeps a record of someone on your team. It doesn't give them a login. To let someone log in, the owner invites them from Settings.",
      },
      {
        id: "who-can-see",
        route: "/dealer/staff/permissions",
        target: pageTitle,
        title: "Who can see what",
        narration:
          "This page explains exactly what each role can see and change. The money is for the owner, managers and finance; staff details are for managers and the owner. It's enforced by our servers, not just hidden on screen.",
      },
    ],
  },

  {
    id: "reports",
    title: "Reports, settings and help",
    blurb: "Reports, your settings, inviting your team, and getting help.",
    steps: [
      {
        id: "reports",
        route: "/dealer/analytics",
        target: "css:nav[aria-label=\"Reports\"]",
        title: "Reports",
        narration:
          "Reports are counted straight from your own records. The tabs cover an overview, your stock, sales and leads, which lead sources win, MOT and risk, and your staff.",
      },
      {
        id: "settings",
        route: "/dealer/settings",
        target: "tour-settings",
        title: "Settings",
        narration:
          "Settings is where you change your password, import a spreadsheet, download your data as CSV files, and bring this tour back whenever you like.",
      },
      {
        id: "settings-owner",
        route: "/dealer/settings",
        target: "tour-settings-cards",
        showIf: user => isOwner(user),
        title: "Your dealership and your team",
        narration:
          "As the owner, you set your dealer profile here, which appears on invoices and your public page. Invite a teammate with a link you can send by text, WhatsApp or email, choosing their role, and change or remove roles any time. You can also connect your own email sending, and switch on web searches for me.",
      },
      {
        id: "billing",
        route: "/billing",
        target: pageTitle,
        title: "Billing",
        narration: "Billing shows your plan and trial days left. Subscribe or manage your payments here, including whether I'm part of your plan.",
      },
      {
        id: "support",
        route: "/support",
        target: "css:.sn-hero",
        title: "Help and support",
        narration: "Stuck on something? Send a message to the FlipPilot team here, and our replies come back to this page.",
      },
      {
        id: "goodbye",
        route: "/dealer-dashboard",
        target: "",
        title: "That's the tour",
        narration:
          "That's everything. You can come back to any chapter from Settings, under Take the Tour. And if you're ever unsure where something is, just ask me. I'm always here.",
      },
    ],
  },
];
