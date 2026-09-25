// The last chapter: the six Reports tabs, Settings (with Email Sending),
// Billing, Help & Support and Search. Every report here is a count of the
// dealer's own records; none of them calls the AI.
import type { TourChapter } from "../tourPlan";
import { canSeeMoney, isOwner } from "@/lib/permissions";

const REPORT_TABS = 'css:nav[aria-label="Reports"]';
// Billing's one card (plan status, the Pilot Brain box and the button).
const BILLING_CARD = "css:main div.rounded-2xl.space-y-4";

export const chapter: TourChapter = {
  id: "reports",
  title: "Reports, settings and help",
  blurb: "Your reports, settings, team invites, billing, search and how to get help.",
  pages: [
    // ── Reports: Overview ────────────────────────────────────────────────
    {
      id: "reports-overview",
      title: "Overview",
      route: "/dealer/analytics",
      steps: [
        {
          id: "reports-overview-tabs",
          target: REPORT_TABS,
          title: "Six report tabs",
          narration:
            "Your reports sit behind these six tabs: Overview, Stock, Sales and Leads, Lead Sources, MOT and Risk, and Staff. Every figure is counted straight from the cars, leads and team records you've entered. There's no guesswork and no AI in them, so they're only ever as good as what's been typed in.",
        },
        {
          id: "reports-overview-cards",
          target: "heading:Cars in Stock",
          title: "Your stock at a glance",
          narration:
            "This card and the two beside it count your unsold cars, the average asking price with the cheapest and dearest, and the average number of days your cars have been in since they were added. Sold cars are left out, so it's a true picture of what's on the forecourt today.",
        },
        {
          id: "reports-overview-tools",
          target: "heading:Analytics Tools",
          title: "More detailed reports",
          narration:
            "Analytics Tools opens the longer reports. Sales Analytics breaks your leads down by status and source, Inventory Analytics shows MOT dates, prices, mileage and days in stock, and there's Lead Conversion, Staff Analytics and Staff by Branch too. Click any card to open it; the tabs stay at the top.",
        },
      ],
      guide: {
        summary:
          "The front page of Reports: three headline counts from your unsold stock, and links to the more detailed reports. Everything is worked out from your own records, never estimated.",
        howTo: [
          {
            question: "How do I move between reports?",
            steps: [
              "Open Reports in the menu, or pick any report from it.",
              "Use the tabs along the top: Overview, Stock, Sales & Leads, Lead Sources, MOT & Risk and Staff.",
              "The tab you're on is lit up in gold.",
            ],
          },
          {
            question: "How do I see how long my cars have been in stock?",
            steps: [
              "On Overview, read the Average Days in Stock card.",
              "For the spread, click Inventory Analytics under Analytics Tools.",
              "Its Days in Stock panel splits your cars into under 30 days, 30 to 59, 60 to 89, and 90 days or more.",
            ],
          },
        ],
        tips: [
          "Sold cars are never counted in stock figures, and a car with no asking price is left out of the average price.",
          "Days in stock count from the day the car was added to FlipPilot, so cars you entered late will look younger than they are.",
        ],
      },
    },

    // ── Reports: Stock ───────────────────────────────────────────────────
    {
      id: "reports-stock",
      title: "Stock",
      route: "/dealer/intelligence/motors",
      steps: [
        {
          id: "reports-stock-overview",
          target: "heading:Stock overview",
          title: "Stock overview",
          narration:
            "Stock overview adds up your unsold cars: how many there are, what they'd bring in at your asking prices, and how many have an MOT expired or due within 30 days. If you can see the money side, you also get the average margin, asking price minus the trade price you entered.",
        },
        {
          id: "reports-stock-makes",
          target: "heading:Make breakdown",
          title: "Make breakdown",
          narration:
            "Make breakdown shows how your unsold stock splits by make, biggest first. It's a quick way to spot when you're leaning too heavily on one badge, or missing something your customers keep asking for.",
        },
        {
          id: "reports-stock-mots",
          target: "heading:MOTs to sort",
          title: "MOTs to sort",
          narration:
            "Here's every unsold car whose MOT has expired or runs out within 30 days, soonest first, with its asking price. Click a car's name to open it. Cars with no MOT date recorded are listed underneath, because I can't tell you their position until the date's been added.",
        },
        {
          id: "reports-stock-notes",
          target: "heading:Stock notes",
          title: "Stock notes",
          narration:
            "Stock notes sums it all up in a few plain lines: how many MOTs need sorting, how many cars have no MOT date, and your best-stocked make. It's counted from your own stock, not a prediction.",
        },
      ],
      guide: {
        summary:
          "A count of your unsold stock: its value at asking price, MOT position and makes. Every number comes from the cars and prices you've entered.",
        howTo: [
          {
            question: "How do I find cars whose MOT needs sorting?",
            steps: [
              "Open Reports, then the Stock tab.",
              "Scroll to MOTs to sort: expired cars come first, then those due within 30 days.",
              "Click a car's name to open its page and deal with it.",
            ],
          },
          {
            question: "Why is a car missing from the MOT list?",
            steps: [
              "Look under MOTs to sort for the line of cars with no MOT date recorded.",
              "Click the car to open it.",
              "Add its MOT expiry date, and it will be counted from then on.",
            ],
          },
        ],
        tips: [
          "Stock at asking price only counts cars with an asking price; the card tells you how many are left out.",
          "The average margin needs both a trade price and an asking price on a car.",
        ],
        access:
          "Everyone can open this report. The average margin uses what each car cost, so only the owner, managers and finance see it; for everyone else that tile says not enough prices are entered.",
      },
    },

    // ── Reports: Sales & Leads ───────────────────────────────────────────
    {
      id: "reports-sales",
      title: "Sales & Leads",
      route: "/dealer/intelligence/crm",
      steps: [
        {
          id: "reports-sales-glance",
          target: "heading:Leads at a glance",
          title: "Leads at a glance",
          narration:
            "Leads at a glance counts every lead you've recorded, how many are still open, and how many you've won or lost. It's the quickest way to see whether the pipeline is filling up or drying out.",
        },
        {
          id: "reports-sales-stages",
          target: "heading:Leads by stage",
          title: "Leads by stage",
          narration:
            "Leads by stage shows how many leads sit at each step of your pipeline, from new and contacted through viewings, test drives and negotiating, to won and lost. A pile-up at one stage tells you where people are getting stuck.",
        },
        {
          id: "reports-sales-sources",
          target: "heading:Lead sources",
          title: "Where leads come from",
          narration:
            "Lead sources lists where your leads came from, biggest first, and how many of each ended in a sale. It's worth checking before you spend money on another advert.",
        },
        {
          id: "reports-sales-age",
          target: "heading:Open leads by age",
          title: "Leads going cold",
          narration:
            "Open leads by age groups your open leads by when they were added, and Waiting longest names the oldest ones. Click a name to open that lead and follow it up. Remember it counts from the day the lead was added, not from your last contact.",
        },
      ],
      guide: {
        summary:
          "Where your leads stand: totals, stages, sources and how long the open ones have been waiting. Every figure is counted from the leads you've recorded.",
        howTo: [
          {
            question: "How do I find leads I've left too long?",
            steps: [
              "Open Reports, then the Sales & Leads tab.",
              "Scroll to Open leads by age and check the Added 30 or more days ago box.",
              "Under Waiting longest, click a name to open that lead.",
              "The Leads dashboard lists every open lead if you need the rest.",
            ],
          },
          {
            question: "How do I see which sources actually sell cars?",
            steps: [
              "Look at Lead sources on this tab for the number of leads and wins from each.",
              "For a percentage, open the Lead Sources tab.",
            ],
          },
        ],
        tips: [
          "A lead's age is from the day it was added, so a lead you spoke to yesterday can still show as old.",
        ],
      },
    },

    // ── Reports: Lead Sources ────────────────────────────────────────────
    {
      id: "reports-lead-sources",
      title: "Lead Sources",
      route: "/dealer/analytics/lead-conversion",
      steps: [
        {
          id: "reports-lead-sources-intro",
          target: "css:.sn-hero",
          title: "Which sources sell",
          narration:
            "Lead Sources answers one question: which of the places your leads come from actually turn into sales. It's worked out from the source and status on every lead you've recorded, so it's only as good as the sources your team fills in.",
        },
        {
          id: "reports-lead-sources-totals",
          target: "css:.sn-metrics-row",
          title: "Your win rate",
          narration:
            "These three figures are your overall win rate, the share of all your leads that ended in a sale, plus the number won and the total number of leads. It's counted from each lead's status, so keep your leads marked won or lost as you go.",
        },
        {
          id: "reports-lead-sources-by-source",
          target: "heading:Conversion Rate by Source",
          title: "Win rate by source",
          narration:
            "Here's the same win rate for each lead source, biggest source first. A source with fewer than ten leads is greyed out, because that's too few to say whether it really converts well. Use it to decide where your advertising money goes.",
        },
      ],
      guide: {
        summary:
          "Which lead sources turn into sales. It shows your overall win rate and the rate for each source, counted from the status of every lead you've recorded.",
        howTo: [
          {
            question: "How do I compare my advertising sources?",
            steps: [
              "Open Reports, then the Lead Sources tab.",
              "Read Conversion Rate by Source: each card shows the win rate, then won and total leads.",
              "Ignore greyed-out sources until they have at least ten leads.",
            ],
          },
          {
            question: "How do I make these figures accurate?",
            steps: [
              "Give every lead a source when you add it.",
              "Mark leads as won or lost on the lead's page when the deal is done.",
            ],
          },
        ],
        tips: [
          "There's no average time to convert here yet, because a lead doesn't record the date it was won.",
        ],
      },
    },

    // ── Reports: MOT & Risk ──────────────────────────────────────────────
    {
      id: "reports-mot-risk",
      title: "MOT & Risk",
      route: "/dealer/intelligence/risk",
      steps: [
        {
          id: "reports-mot-risk-position",
          target: "heading:MOT position",
          title: "MOT position",
          narration:
            "MOT position counts your unsold cars with an expired MOT, those due within 30 days, and those with no MOT date recorded at all. Each one is a number of cars, not a score, so you know exactly how many to deal with.",
        },
        {
          id: "reports-mot-risk-watch",
          target: "heading:Other things to watch",
          title: "Other things to watch",
          narration:
            "Two more things that hold stock back: cars with three or more advisories on their current MOT, and cars that have been in stock 90 days or more. Both are counted from your own records, from the date each car was added.",
        },
        {
          id: "reports-mot-risk-cars",
          target: "heading:Cars to look at",
          title: "Cars to look at",
          narration:
            "This list names every unsold car with at least one of those flags, most urgent first, and says which flags it has. Click a car to open it and put it right, whether that's booking the MOT, fixing an advisory or rethinking the price.",
        },
      ],
      guide: {
        summary:
          "What could hold your stock back: MOT dates, MOT advisories and time in stock. Every figure is a count of your unsold cars, never a percentage or a score.",
        howTo: [
          {
            question: "How do I find which cars need attention first?",
            steps: [
              "Open Reports, then the MOT & Risk tab.",
              "Scroll to Cars to look at: the most urgent cars are at the top.",
              "Read the flags under each car, then click its name to open it.",
            ],
          },
          {
            question: "Why does a car show no MOT date?",
            steps: [
              "Open the car from Cars to look at.",
              "Add its MOT expiry date on the car's page, and it will be counted from then on.",
            ],
          },
        ],
        tips: [
          "Only the first 25 flagged cars are listed; the line underneath says how many more there are.",
          "Cars with no date added can't be counted in the 90 days figure.",
        ],
      },
    },

    // ── Reports: Staff ───────────────────────────────────────────────────
    {
      id: "reports-staff",
      title: "Staff",
      route: "/dealer/analytics/staff",
      steps: [
        {
          id: "reports-staff-totals",
          target: "css:.sn-metrics-row",
          title: "Your team in numbers",
          narration:
            "These figures count your staff records, how many are marked active, and the average number of days since each person was added to FlipPilot. That's the day their record was created here, not the day they started working for you.",
        },
        {
          id: "reports-staff-roles",
          target: "heading:Role Distribution",
          title: "Team by role",
          narration:
            "Role Distribution shows how your team splits by job role, as a share of everyone on your staff list. It's a simple headcount from your staff records, not a measure of how anyone is performing.",
        },
        {
          id: "reports-staff-branches",
          target: "heading:By Branch",
          title: "Team by branch",
          narration:
            "By Branch counts the people at each of your branches. Anyone without a branch set on their staff record isn't counted here, so if the numbers look short, a manager can add the branch on that person's record.",
        },
      ],
      guide: {
        summary:
          "A headcount of your team by role and branch, counted from your staff records. It doesn't measure anyone's performance.",
        howTo: [
          {
            question: "How do I see how many staff are at each branch?",
            steps: [
              "Open Reports, then the Staff tab.",
              "Read the By Branch panel.",
              "For active and total staff at each branch, open Overview and click Staff by Branch under Analytics Tools.",
            ],
          },
          {
            question: "Why is someone missing from a branch?",
            steps: [
              "Open Team, then Staff, and click their name (managers and the owner can edit).",
              "Set their Branch and click Save Changes.",
            ],
          },
        ],
        tips: [
          "Avg Days Since Added is time on FlipPilot, not length of service.",
        ],
      },
    },

    // ── Settings ─────────────────────────────────────────────────────────
    {
      id: "settings",
      title: "Settings",
      route: "/dealer/settings",
      steps: [
        {
          id: "settings-intro",
          target: "tour-settings",
          title: "Your settings",
          narration:
            "Settings is where you look after your account and your dealership's data. The cards below are the ones your role can use. At the very bottom there's a short Coming Soon list, so you know what isn't built yet rather than finding a button that does nothing.",
        },
        {
          id: "settings-profile",
          target: "heading:Dealer Profile",
          title: "Dealer profile",
          showIf: isOwner,
          narration:
            "Edit Dealer Profile sets your dealership's name, phone number, address and VAT number. They appear on your public booking page and on customer invoices, and the VAT number only shows if you fill it in. Only you, as the owner, can change these.",
        },
        {
          id: "settings-account",
          target: "heading:Account & Security",
          title: "Your password",
          narration:
            "Change Password is for your own login. You'll need your current password, then a new one of at least eight characters, typed twice. Everyone on the team manages their own password here.",
        },
        {
          id: "settings-team",
          target: "heading:Team",
          title: "Invite your team",
          showIf: isOwner,
          narration:
            "Invite Teammate makes a join link with the role you choose, which you send yourself by text, WhatsApp or email. Anyone holding it can join for seven days, so only send it to the right person. Manage Team lets you change someone's role or remove them, and it takes effect on their very next click.",
        },
        {
          id: "settings-data",
          target: "heading:Data Export",
          title: "Import and export",
          showIf: user => !canSeeMoney(user),
          narration:
            "Import from CSV, on the Data Import card, brings in stock or a parts list from a spreadsheet. Here in Data Export, the Vehicles button downloads your stock list as a CSV file, handy as a backup. The books downloads are for the owner, managers and finance.",
        },
        {
          id: "settings-data-money",
          target: "heading:Data Export",
          title: "Import and export",
          showIf: canSeeMoney,
          narration:
            "Import from CSV, on the Data Import card, brings in stock or a parts list from a spreadsheet. Here in Data Export, you can download Vehicles, Purchases, Costs and Sales as CSV files, dated so a monthly backup never overwrites the last. Handy for your accountant, too.",
        },
        {
          id: "settings-email",
          target: "heading:Email Sending",
          title: "Your own email sending",
          showIf: isOwner,
          narration:
            "Manage Email Sending lets you connect your own SendGrid account, so email goes from your domain on your own bill. Be aware that today it only sends a test email to prove the connection works; nothing in the app sends emails to customers yet.",
        },
        {
          id: "settings-wendy",
          target: "heading:Pilot Brain Security",
          title: "Controls for me",
          showIf: isOwner,
          narration:
            "These cards are about me. Pilot Brain Web Access switches my live web searches on or off, with a daily limit and a list of every search. Pilot Brain Security shows anyone who's tried to get around my rules, and lets you lift a thirty-minute pause early.",
        },
        {
          id: "settings-tour",
          target: "heading:Product Tour",
          title: "Take the tour again",
          narration:
            "Take the Tour brings me back whenever you like. You can run the whole tour, one chapter, or a single screen, which is handy when a new starter joins. Every screen also has its own gold Help with this page button.",
        },
      ],
      guide: {
        summary:
          "Your account, your dealership's details and your data. The owner also invites and manages the team, connects email sending, and controls Pilot Brain's web searches from here.",
        howTo: [
          {
            question: "How do I invite a new member of staff?",
            steps: [
              "Click Invite Teammate on the Team card.",
              "Type their name if you like, and choose their role: Sales, Finance, Manager or General.",
              "Click Generate Link.",
              "Send it with Text message, WhatsApp or Email, or click Copy link and paste it yourself.",
              "They open the link, create their own login and land inside your dealership.",
            ],
          },
          {
            question: "How do I change someone's role or remove them?",
            steps: [
              "Click Manage Team on the Team card.",
              "Pick a new role from the list next to their name; moving someone down asks you to confirm with Change role.",
              "To take someone off, click Remove from team, then Remove.",
              "Click Close when you're done.",
            ],
          },
          {
            question: "How do I back up my data?",
            steps: [
              "Go to the Data Export card.",
              "Click Vehicles to download your stock list.",
              "If you handle the books, also click Purchases, Costs and Sales.",
              "Each file is a dated CSV that opens in Excel or Google Sheets.",
            ],
          },
          {
            question: "How do I change my password?",
            steps: [
              "Click Change Password on the Account & Security card.",
              "Type your current password, then your new one twice (at least eight characters).",
              "Click Change Password, then Done.",
            ],
          },
          {
            question: "How do I update the details on my invoices?",
            steps: [
              "Click Edit Dealer Profile on the Dealer Profile card.",
              "Change the name, phone, address or VAT number.",
              "Click Save Changes.",
            ],
          },
        ],
        tips: [
          "Removing someone, or moving them to a lower role, cancels every invite link you've already shared. Make a new link for anyone you're still expecting.",
          "An invite link works for seven days and isn't tied to one person, so treat it like a key.",
          "The Pilot Brain Web Access card only appears when your plan includes Pilot Brain.",
        ],
        access:
          "Everyone can change their own password, import from CSV and download the Vehicles list. The Purchases, Costs and Sales downloads are for the owner, managers and finance. Only the owner sees Edit Dealer Profile, the Team card, Email Sending and the two Pilot Brain cards.",
      },
    },

    // ── Email Sending ────────────────────────────────────────────────────
    {
      id: "email-sending",
      title: "Email Sending",
      route: "/dealer/settings/email",
      showIf: isOwner,
      steps: [
        {
          id: "email-sending-intro",
          target: "heading:Email Sending",
          title: "Email Sending",
          narration:
            "This is where you connect your own SendGrid account for email. It's your account, your domain and your bill, never shared with other dealers. Right now the connection is all it does, plus a test email: nothing sends to customers automatically.",
        },
        {
          id: "email-sending-why",
          target: "heading:Why bring your own key?",
          title: "Why your own key",
          narration:
            "Sending from your own domain is better for trust and for landing in inboxes, you pay SendGrid directly with no charge from FlipPilot per email, and another dealer's sending can never harm your reputation.",
        },
        {
          id: "email-sending-steps",
          target: "heading:How to get a real SendGrid API key",
          title: "Getting a key",
          narration:
            "These four steps walk you through SendGrid: make a free account, verify a sender address you can receive mail at, create a key with Mail Send permission only, then copy it straight away, because SendGrid only shows it once.",
        },
        {
          id: "email-sending-connect",
          target: "heading:Connect your account",
          title: "Connect it",
          narration:
            "Paste the key, the From Email you verified in SendGrid and a From Name, then click Connect. Once it's connected, this card shows who connected it, a masked key, a Send Test button to prove it works, and Disconnect if you ever want to remove it.",
        },
      ],
      guide: {
        summary:
          "Connect your own SendGrid account so email can go from your own domain. Today it only proves the connection with a test email; nothing sends to customers automatically.",
        howTo: [
          {
            question: "How do I connect my SendGrid account?",
            steps: [
              "Create a free account at sendgrid.com.",
              "In SendGrid, go to Settings, then Sender Authentication, and verify a single sender address.",
              "In SendGrid, go to Settings, then API Keys, and create a key with Mail Send permission only.",
              "Back here, paste it into SendGrid API Key, add the From Email and From Name, and click Connect.",
            ],
          },
          {
            question: "How do I check it works?",
            steps: [
              "Once connected, type an address in Send a test email to.",
              "Click Send Test.",
              "Check that inbox, and the spam folder.",
            ],
          },
          {
            question: "How do I disconnect it?",
            steps: ["Click Disconnect on the Connected card."],
          },
        ],
        tips: [
          "The From Email must be exactly the sender you verified in SendGrid, or sending fails.",
          "Your key is stored encrypted and only ever shown masked.",
        ],
        access: "Only the dealership owner can open this screen, connect, test or disconnect.",
      },
    },

    // ── Billing ──────────────────────────────────────────────────────────
    {
      id: "billing",
      title: "Billing",
      route: "/billing",
      steps: [
        {
          id: "billing-intro",
          target: "heading:Billing",
          title: "Your subscription",
          narration:
            "Billing is your subscription, and only you as the owner can see it. Your fourteen-day free trial counts from the day your dealership was approved, and the plan status tells you how many days are left.",
        },
        {
          id: "billing-status",
          target: BILLING_CARD,
          title: "Your plan status",
          narration:
            "The badge says where you stand: trial days left, Active, Payment failed, Trial ended or Canceled. Before you subscribe, the Include Pilot Brain box chooses whether I'm part of your plan. Once you're active, it shows whether the Pilot Brain add-on is on.",
        },
        {
          id: "billing-pay",
          target: `${BILLING_CARD} > button`,
          title: "Paying and managing",
          narration:
            "Subscribe Now takes you to Stripe's secure payment page, and you come straight back here afterwards. Once you're subscribed this button becomes Manage Billing, which opens Stripe's billing portal for your card details, invoices and plan.",
        },
      ],
      guide: {
        summary:
          "Your FlipPilot subscription: plan status, trial days left and whether Pilot Brain is included. Payments are taken and managed by Stripe, not stored in FlipPilot.",
        howTo: [
          {
            question: "How do I subscribe?",
            steps: [
              "Tick or untick Include Pilot Brain.",
              "Click Subscribe Now.",
              "Enter your card on Stripe's payment page.",
              "You're brought back here; it can take a few seconds for the plan to show as Active.",
            ],
          },
          {
            question: "How do I change my card or see invoices?",
            steps: [
              "Click Manage Billing (shown once your plan is active).",
              "Make the change in Stripe's billing portal.",
              "Use its return link to come back here.",
            ],
          },
        ],
        tips: [
          "If you cancel on Stripe's page, nothing is charged and you're told so here.",
        ],
        access: "Only the dealership owner can open Billing.",
      },
    },

    // ── Help & Support (and the goodbye) ─────────────────────────────────
    {
      id: "support",
      title: "Help & Support",
      route: "/support",
      steps: [
        {
          id: "support-intro",
          target: "css:.sn-hero",
          title: "Help and support",
          narration:
            "Found a bug, or something not working right? This page goes straight to the people who run FlipPilot, not to your own team. The more you tell them about what happened, the quicker it gets sorted.",
        },
        {
          id: "support-message",
          target: "heading:Send a Message",
          title: "Send a message",
          narration:
            "Type what went wrong and what you were trying to do, then click Send Message. Your messages are listed on this page, and when the FlipPilot team replies, the answer appears under your message and you get a notification on the bell.",
        },
        {
          id: "goodbye",
          target: "",
          title: "That's the tour",
          narration:
            "That's the whole tour. You can replay any chapter or screen from the gold Help with this page button on every screen, or from Settings under Take the Tour. And if you're ever unsure where something is, just ask me. I'm always here.",
        },
      ],
      guide: {
        summary:
          "Send a message to the FlipPilot team about a bug or a problem with the app. Their replies appear here under your message.",
        howTo: [
          {
            question: "How do I report a problem?",
            steps: [
              "Type what went wrong and what you were trying to do in the box.",
              "Click Send Message.",
              "Watch the bell for a notification that FlipPilot Support replied.",
              "Come back here to read the reply under Your Messages.",
            ],
          },
          {
            question: "How do I ask how to do something?",
            steps: [
              "Click the gold Help with this page button on the screen you're stuck on. On a phone it is a gold question mark.",
              "Choose Ask Wendy about this page, or read the written guide.",
            ],
          },
        ],
        tips: [
          "For suggestions to your own manager, use your team's message board instead; this page goes to FlipPilot.",
        ],
      },
    },

    // ── Search ───────────────────────────────────────────────────────────
    {
      id: "search",
      title: "Search",
      route: "/search",
      steps: [
        {
          id: "search-intro",
          target: "css:.sn-hero",
          title: "Search in one box",
          narration:
            "Search finds a car by its registration, make or model, or a lead by name, phone number or email. You can reach it any time from Search on the bottom bar, or in Quick Links.",
        },
        {
          id: "search-box",
          target: "css:main .sn-panel input",
          title: "Just start typing",
          narration:
            "Type part of a reg, a make, a name or a phone number, and results appear as you go, with no need to press enter. Cars on your books, sold ones included, show with their asking price, and leads show their stage and contact details.",
        },
        {
          id: "search-results",
          target: "",
          title: "Opening a result",
          narration:
            "Results come in two groups, Vehicles and Leads, with a count on each. Click a car to open its page, or a lead to open theirs. Search doesn't look through customers, jobs or the books, so use those screens' own lists, or just ask me.",
        },
      ],
      guide: {
        summary:
          "One box to find a car or a lead fast. It searches vehicles by registration, make and model, and leads by name, phone and email.",
        howTo: [
          {
            question: "How do I find a car by its registration?",
            steps: [
              "Click Search on the bottom bar.",
              "Type all or part of the reg.",
              "Click the car under Vehicles to open it.",
            ],
          },
          {
            question: "How do I find a customer who rang?",
            steps: [
              "Click Search on the bottom bar.",
              "Type their name or part of their phone number.",
              "Click them under Leads to open the lead.",
            ],
          },
        ],
        tips: [
          "Search isn't fussy about capitals, and part of a word is enough.",
          "Sold cars are included, so you can find a car you sold last month.",
        ],
      },
    },
  ],
};
