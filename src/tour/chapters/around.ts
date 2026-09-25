import type { TourChapter } from "../tourPlan";
import { canSeeMoney } from "@/lib/permissions";

// Chapter one: the dashboard and the frame that sits round every page (the
// menu, the stock snapshot, Quick Links, the bottom bar, the bell, the account
// menu and the Help with this page button).
//
// Thirteen of these stops are already recorded in Wendy's voice (welcome,
// headline-money, headline-team, attention, quick-actions, getting-started,
// watcher, menu, snapshot-bar, quick-links, bottom-bar, bell, account): their
// words, ids, titles, targets and showIf must stay exactly as they are, or the
// recording no longer matches. The dashboard-* stops are new.

export const chapter: TourChapter = {
  id: "around",
  title: "Finding your way around",
  blurb: "The dashboard, the menus, the bell, help on every page and your account.",
  pages: [
    {
      id: "dashboard",
      title: "Dashboard",
      route: "/dealer-dashboard",
      steps: [
        {
          id: "welcome",
          target: "tour-welcome",
          title: "Welcome to FlipPilot",
          narration:
            "Hi, I'm Wendy. Welcome to FlipPilot Dealer OS. This is your dashboard, the first thing you see when you log in. I'll show you where everything is, what each part does, and a few tricks that save time.",
        },
        {
          id: "quick-actions",
          target: "tour-dealer-modules",
          title: "The things you do most",
          narration:
            "These gold buttons are the everyday jobs: add a vehicle, add a lead, and ask me a question. If you look after the money you'll also see Record a Sale here.",
        },
        {
          id: "headline-money",
          target: "tour-headline-stats",
          showIf: user => canSeeMoney(user),
          title: "Your numbers at a glance",
          narration:
            "These tiles are worked out live from your own records: your stock at its asking prices, profit and sales this month from your books, open leads, and today's appointments. Click any tile to jump straight to what's behind it.",
        },
        {
          id: "headline-team",
          target: "tour-headline-stats",
          showIf: user => !canSeeMoney(user),
          title: "Your numbers at a glance",
          narration:
            "These tiles are worked out live from your own records: your stock at its asking prices, how many cars are in stock, open leads, and today's appointments. Click any tile to jump straight to what's behind it.",
        },
        {
          id: "attention",
          target: "tour-todays-actions",
          title: "Needs your attention",
          narration:
            "This row is your to-do list. It counts MOTs due or expired, MOT advisories, cars with no asking price, cars without photos, stock over ninety days, and open jobs. A tile lights up when there's something to do, and clicking it takes you there.",
        },
        {
          id: "getting-started",
          target: "tour-getting-started",
          title: "Getting started",
          narration:
            "While you're new, a Getting started card ticks itself off from your real records as you go, like marking how bookings went, and a photo and an MOT date on every car. Each one makes me more useful. Once it's done, or you hide it, it goes away.",
        },
        {
          id: "watcher",
          target: "tour-watcher",
          title: "I keep watch",
          narration:
            "This card is me keeping watch. Every time the dashboard opens I look over your stock, leads, bookings and jobs, give the business a health score, and flag anything slipping, like an enquiry nobody has answered. The important ones also land in your bell.",
        },
        {
          id: "dashboard-market",
          target: "heading:Pilot Brain — Market Intelligence",
          title: "Check the market",
          narration:
            "Next to it, press Check the Market and I compare up to fifteen of your cars with similar dealer listings on eBay. You'll see whether each one is priced above or below them, how sure I am, and scores for demand, pricing and supply. It only runs when you press it, because every check makes live lookups.",
        },
        {
          id: "dashboard-recent",
          target: "heading:RECENTLY ADDED TO STOCK",
          title: "Recently added",
          narration:
            "At the bottom are the last five cars added to stock that are still for sale, newest first, with the date each one came in. Click a car to open its page.",
        },
        {
          id: "menu",
          target: "tour-sidebar",
          title: "The menu",
          narration:
            "Everything lives in the menu on the left, in groups: me, stock, sales, customers, the workshop, money, your team, reports and settings. Click a group to open it. You only see the pages your role can open. On a phone, the menu button at the top opens it.",
        },
        {
          id: "snapshot-bar",
          target: 'css:section[aria-label="Stock snapshot"]',
          title: "The stock snapshot",
          narration:
            "This strip sits at the top of every page: how many cars you have in stock, their average days in stock, and any MOTs expired or due soon. Each one is clickable.",
        },
        {
          id: "quick-links",
          target: "tour-quick-links",
          title: "Quick links",
          narration:
            "On a wider screen, the column on the right has quick links to the pages you use most, and an at a glance panel with open jobs, bookings waiting for a reply, and MOTs needing attention.",
        },
        {
          id: "bottom-bar",
          target: "tour-bottom-bar",
          title: "The bottom bar",
          narration:
            "The bar along the bottom is always there: add a vehicle, ask me, check an MOT, or search your vehicles and leads, from any page.",
        },
        {
          id: "bell",
          target: "tour-bell",
          title: "Your alerts",
          narration:
            "The bell collects your alerts: a new booking from your website, a message from a teammate, your rota being published, a leave request answered, and things I've spotted. It checks for new ones every minute or so. Click an alert to clear it.",
        },
        {
          id: "account",
          target: 'css:button[aria-label^="Account menu for"]',
          title: "Your account",
          narration:
            "Your name at the top right opens your account menu, with Settings and Log out. The Refresh button next to it reloads your stock if someone else has just changed it.",
        },
        {
          // The Help with this page button hides itself while the tour runs, so
          // this card sits in the middle of the screen.
          id: "dashboard-help",
          target: "",
          title: "Help on every page",
          narration:
            "On every screen there's a gold Help with this page button in the bottom right corner. Press it and I can walk you round that screen, put a question about it ready in my chat box, start the full tour, or show you a short written guide to that screen.",
        },
      ],
      guide: {
        summary:
          "The dashboard is your home screen: today's headline numbers, what needs doing, what Wendy is keeping watch on, and your newest stock. Every tile and card is worked out live from your own records, and clicking one takes you to what's behind it.",
        howTo: [
          {
            question: "How do I see what needs doing today?",
            steps: [
              "Look along the Needs your attention row: a coloured tile has something waiting, a grey one is clear.",
              "Click a tile to go to the work behind it. The MOT tiles open the first car that needs attention, and Need photos opens the Photo Studio.",
              "Read the Pilot Brain — Watching card for leads, bookings and jobs that are slipping.",
              "Click the Watching card to talk to Wendy about any of it.",
            ],
          },
          {
            question: "How do I check my prices against the market?",
            steps: [
              "On the Pilot Brain — Market Intelligence card, press Check the Market.",
              "Give it a moment while up to fifteen of your cars are compared with similar dealer listings on eBay.",
              "Read each car's percentage above or below the market, with how sure the check is in brackets.",
              "Press Check again later for a fresh look.",
            ],
          },
          {
            question: "How do I get round the app quickly?",
            steps: [
              "Use the menu on the left: click a group, such as Stock or Sales, to open it.",
              "On a wider screen, use Quick Links on the right for the pages used most.",
              "Use the bottom bar for Add Vehicle, Ask Wendy, MOT Check and Search from any page.",
              "On a phone, tap the menu button at the top to open the menu.",
            ],
          },
          {
            question: "How do I get help with a screen?",
            steps: [
              "Press the gold Help with this page button in the bottom right corner. On a phone it is a gold question mark.",
              "Choose Show me how to use this page and Wendy walks you round it.",
              "Or choose Ask Wendy about this page: her chat opens with a question typed in, ready for you to send or change.",
              "Or read the written guide further down the panel.",
              "Choose The full tour, or any other screen to take the whole tour or pick another screen.",
            ],
          },
        ],
        tips: [
          "The Getting started card ticks itself off from your real records. Press Hide this to put it away for you on this browser.",
          "Press Refresh at the top if a colleague has just changed the stock and you want the latest figures.",
          "The Market Intelligence check only runs when someone presses the button, and its result feeds the Market Health score on Goals & Briefing.",
          "The bell checks for new alerts about once a minute. Click an alert to clear it.",
        ],
        access:
          "The owner, managers and finance see Profit This Month, Sold This Month and the Record a Sale button; everyone else sees Cars in Stock instead. The Watching and Market Intelligence cards are part of Pilot Brain, which is included in the free trial and is a paid add-on after it. Billing in the account menu is for the owner only.",
      },
    },
  ],
};
