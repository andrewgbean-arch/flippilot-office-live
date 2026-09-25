// The guided tour, chapter "Sales and leads": every screen in the Sales menu,
// top to bottom, read by Wendy, plus each screen's written help.
// Every line must be true of the screens as they are (see tourSteps.ts).

import type { TourChapter } from "../tourPlan";
import { canSeeWanted } from "@/lib/permissions";

export const chapter: TourChapter = {
  id: "sales",
  title: "Sales and leads",
  blurb: "Leads, the pipeline, bookings, Wanted Cars, your public page and the stock feed.",
  pages: [
    // ── Sales Overview ────────────────────────────────────────────────
    {
      id: "sales-overview",
      title: "Sales Overview",
      route: "/dealer/sales",
      steps: [
        {
          id: "sales-overview-intro",
          target: "tour-sales",
          title: "Your sales at a glance",
          narration:
            "This is your sales overview, the quick look at how your leads are doing. Everything here is counted live from the leads your team has saved, so it's only as good as the statuses you keep on them.",
        },
        {
          id: "sales-overview-counts",
          target: "css:main .sn-metrics-row",
          title: "Your lead counts",
          narration:
            "These tiles count your leads: every lead you've saved, the active ones not yet won or lost, the hot ones at test drive or negotiating, and the ones you've won.",
        },
        {
          id: "sales-overview-actions",
          target: "tour-sales-actions",
          showIf: user => canSeeWanted(user),
          title: "Quick actions",
          narration:
            "Quick Actions takes you straight to the jobs you do most. Add Lead when someone rings, View All Leads, the Sales Pipeline, and Wanted Cars, where the customers waiting for a particular car are kept.",
        },
        {
          id: "sales-overview-actions-team",
          target: "tour-sales-actions",
          showIf: user => !canSeeWanted(user),
          title: "Quick actions",
          narration:
            "Quick Actions takes you straight to the jobs you do most: Add Lead when someone rings, View All Leads and the Sales Pipeline. Wanted Cars is kept for sales, managers and the owner, so it won't open for your role.",
        },
        {
          id: "sales-overview-recent",
          target: "heading:Recent Leads",
          title: "The newest leads",
          narration:
            "Recent Leads shows your five newest leads with their current status. Click a name to open that lead's own page and pick up where the last person left off.",
        },
      ],
      guide: {
        summary:
          "The Sales Overview counts your leads and shows the five newest. It's the starting point for everything in Sales: adding a lead, the full list, the pipeline and Wanted Cars.",
        howTo: [
          {
            question: "How do I add a lead from here?",
            steps: ["Press + Add Lead under Quick Actions.", "Fill in at least the customer's name.", "Press Add Lead at the bottom of the form."],
          },
          {
            question: "How do I open a recent lead?",
            steps: ["Find the name under Recent Leads.", "Click it to open the lead's own page.", "Change what you need and press Save Changes."],
          },
        ],
        tips: [
          "Hot Leads counts leads at Test Drive or Negotiating. Won counts leads marked Won.",
          "The counts only change when someone updates a lead's status, so keep statuses up to date.",
        ],
        access: "Everyone can use this screen. The Wanted Cars button only opens for sales, managers and the owner.",
      },
    },

    // ── Leads ─────────────────────────────────────────────────────────
    {
      id: "leads",
      title: "Leads",
      route: "/dealer/sales/leads",
      steps: [
        {
          id: "leads-intro",
          target: "css:main .sn-hero",
          title: "Every lead",
          narration:
            "Here's every lead your dealership has, in one place. The whole team shares this list, so whoever answers the phone can pick up the story. Bookings from your public page are added here automatically.",
        },
        {
          id: "leads-counts",
          target: "css:main .sn-metrics-row",
          title: "Won, lost and active",
          narration:
            "The tiles count your leads: the total, the active ones still in play, and how many you've won or lost. Keeping each lead's status honest is what makes these numbers, and the pipeline, worth looking at.",
        },
        {
          id: "leads-card",
          target: "css:main .sn-staff-card",
          title: "A lead's card",
          narration:
            "Each card shows the customer's name, their status, where they came from and the car they asked about. Press View / Edit to open the lead's own page, where you can change any detail, add notes and press Save Changes.",
        },
        {
          id: "leads-affordability",
          target: "button:View / Edit",
          title: "Affordability check",
          narration:
            "A lead's page also has an Affordability Check. Choose the real car from your stock, enter what the buyer told you about income, outgoings and deposit, and it works out a rough score and a suggested deposit. It's a guide, not a lender's decision.",
        },
        {
          id: "leads-remove",
          target: "button:Remove",
          title: "Removing a lead",
          narration:
            "Remove deletes a lead for good, after asking you to confirm. If a customer simply didn't buy, it's usually better to set them to Lost, so they still count in your figures.",
        },
      ],
      guide: {
        summary:
          "Leads lists every customer enquiry your dealership has, with their status, source and the car they want. Open a lead to update it, add notes, or run a rough affordability check against a car in stock.",
        howTo: [
          {
            question: "How do I update a lead after a call?",
            steps: [
              "Find the lead's card and press View / Edit.",
              "Change the Status to where they are now, such as Contacted or Viewing Booked.",
              "Add what was said in Notes.",
              "Press Save Changes. You'll see Saved next to the button.",
            ],
          },
          {
            question: "How do I run an affordability check?",
            steps: [
              "Open the lead with View / Edit.",
              "Under Vehicle of Interest, choose the car from your stock.",
              "Under Affordability Check, enter Monthly Income, Monthly Expenses and Deposit Available, plus credit score, savings and employment stability if you know them.",
              "Read the score, match band and recommended deposit that appear.",
              "Press Save Changes to keep the figures on the lead.",
            ],
          },
          {
            question: "How do I remove a lead?",
            steps: ["Press Remove on the lead's card.", "Confirm when asked. This can't be undone."],
          },
        ],
        tips: [
          "The affordability check is a rough guide: it assumes a four year loan at an estimated rate based on the credit score you enter. Nothing is worked out until income is filled in.",
          "A booking from your public page creates a lead with the source Website Booking, or updates the existing lead with the same phone number or email.",
          "Mark lost customers as Lost rather than removing them, so your won and lost figures stay true.",
        ],
      },
    },

    // ── Add Lead ──────────────────────────────────────────────────────
    {
      id: "add-lead",
      title: "Add Lead",
      route: "/dealer/sales/add",
      steps: [
        {
          id: "add-lead-intro",
          target: "heading:Add New Lead",
          title: "A new enquiry",
          narration:
            "Someone's rung about a car or walked onto the forecourt? Add them here while they're fresh in your mind. Only the name is required, but the more you fill in, the easier the follow up.",
        },
        {
          id: "add-lead-details",
          target: "css:main .sn-form",
          title: "Who and where from",
          narration:
            "Enter their name, where the lead came from, a phone number or email, and the car they're after. Keep your lead sources consistent, like AutoTrader or Walk-In, so you can see which sources really sell cars.",
        },
        {
          id: "add-lead-status",
          target: "css:#addlead-status",
          title: "Status and notes",
          narration:
            "Set the status to where they really are, from New through to Won or Lost, and add any notes, such as a part exchange or finance wanted. You can change all of it later from the lead's own page.",
        },
        {
          id: "add-lead-save",
          target: "css:main .sn-detail-actions",
          title: "Saving the lead",
          narration:
            "Press Add Lead to save. The form clears, ready for the next one, and the lead appears straight away in Leads and the pipeline for your whole team.",
        },
      ],
      guide: {
        summary:
          "Add Lead records a new customer enquiry in seconds. The lead is shared with the whole team and shows up in Leads, the Sales Overview and the pipeline.",
        howTo: [
          {
            question: "How do I add a lead?",
            steps: [
              "Type the customer's name in Full Name.",
              "Fill in Lead Source, Phone Number, Email Address and Interested Vehicle if you have them.",
              "Choose a Status and add any Notes.",
              "Press Add Lead. You'll see Lead added.",
            ],
          },
          {
            question: "How do I link the lead to a car in my stock?",
            steps: [
              "Add the lead here first.",
              "Open it from Leads with View / Edit.",
              "Choose the car under Vehicle of Interest and press Save Changes.",
            ],
          },
        ],
        tips: [
          "Use the same spelling for each lead source every time, so your reports group them properly.",
          "If saving fails because your leads couldn't be loaded, nothing is changed. Wait a moment and try again.",
        ],
      },
    },

    // ── Pipeline ──────────────────────────────────────────────────────
    {
      id: "pipeline",
      title: "Pipeline",
      route: "/dealer/sales/pipeline",
      steps: [
        {
          id: "pipeline-intro",
          target: "heading:Sales Pipeline",
          title: "Your sales pipeline",
          narration:
            "The pipeline shows where your leads are, counted live from their statuses. Each card gives the number of leads at that stage, and its bar shows their share of all your leads.",
        },
        {
          id: "pipeline-early",
          target: "heading:New Leads",
          title: "New and contacted",
          narration:
            "New Leads and Contacted are the start of the journey: people nobody has spoken to yet, and people you have. A big pile of new leads usually means someone needs to pick up the phone.",
        },
        {
          id: "pipeline-later",
          target: "heading:Hot Leads",
          title: "Closer to a sale",
          narration:
            "Hot Leads here counts leads marked Negotiating, Viewing Booked counts people with a viewing arranged, and Sold counts leads marked Won. Leads at Test Drive or Lost don't have a card on this screen.",
        },
        {
          id: "pipeline-rate",
          target: "heading:Pipeline Conversion Rate",
          title: "Conversion rate",
          narration:
            "Your conversion rate is simply the share of all your leads marked Won. If it looks low, ask me which leads to chase first and we'll go through them together.",
        },
      ],
      guide: {
        summary:
          "The pipeline counts your leads at each stage, from new to sold, and works out your conversion rate. It is read-only: change a lead's status on its own page and the pipeline follows.",
        howTo: [
          {
            question: "How do I move a lead to the next stage?",
            steps: ["Go to Leads.", "Press View / Edit on the lead.", "Change its Status and press Save Changes."],
          },
          {
            question: "How is the conversion rate worked out?",
            steps: ["Count the leads marked Won.", "Divide by all your leads, won, lost and active.", "That share, as a percentage, is the rate shown."],
          },
        ],
        tips: [
          "Hot Leads on this screen counts Negotiating only. The Sales Overview's Hot Leads also includes Test Drive.",
          "Every lead ever saved counts towards the rate, so removing lost leads would flatter it. Mark them Lost instead.",
        ],
      },
    },

    // ── Viewings & Test Drives ────────────────────────────────────────
    {
      id: "bookings",
      title: "Viewings & Test Drives",
      route: "/appointments",
      steps: [
        {
          id: "bookings-intro",
          target: "css:main .sn-hero",
          title: "Booking requests",
          narration:
            "Viewings, test drives and MOT bookings that customers make on your public booking page land here, and the owner, managers and sales team get a notification. Bookings can't be added by hand; this screen shows customers' requests.",
        },
        {
          id: "bookings-link",
          target: "heading:Your Booking Link",
          title: "Your booking link",
          narration:
            "Press Copy Link and put your booking link on your website, adverts and social media. Customers don't need an account. Each booking also creates a lead, or updates the one with the same phone number or email.",
        },
        {
          id: "bookings-availability",
          target: "heading:Availability",
          title: "When customers can book",
          narration:
            "Availability sets the days, opening hours and slot length customers can choose from, plus closed dates like bank holidays. Everyone can see it, but only the owner or a manager can change it and press Save Availability.",
        },
        {
          id: "bookings-pending",
          target: "heading:Pending",
          title: "Reviewing a request",
          narration:
            "New requests wait under Pending. Press Review to confirm the time, move it to one that suits you better, or decline. Then Email Customer opens a ready-written email in your own mail app, so nothing goes until you send it.",
        },
        {
          id: "bookings-history",
          target: "heading:History",
          title: "How did it go?",
          narration:
            "Decided bookings move to History. After a confirmed visit, press Showed up, Bought or No-show, then Mark Completed. It takes a second, and it shows which bookings really turn into sales. View Lead opens the customer's lead.",
        },
      ],
      guide: {
        summary:
          "This screen collects the viewing, test drive and MOT requests customers make on your public booking page. You confirm, move or decline each one, then record how it went.",
        howTo: [
          {
            question: "How do I confirm or move a booking?",
            steps: [
              "Find the request under Pending and press Review.",
              "Change the Date or Time if the customer's choice doesn't suit you.",
              "Press Confirm, or Confirm New Time if you changed it.",
              "Press Email Customer to open a ready-written email in your own mail app, then send it yourself.",
              "Press Done.",
            ],
          },
          {
            question: "How do I decline a booking?",
            steps: ["Press Review on the request.", "Press Decline.", "Use Email Customer, or ring them if they left no email, to let them know."],
          },
          {
            question: "How do I record what happened?",
            steps: [
              "Find the confirmed booking under History.",
              "Press Showed up, Bought or No-show.",
              "Press Mark Completed when you're finished with it.",
            ],
          },
          {
            question: "How do I change our opening hours for bookings?",
            steps: [
              "Under Availability, click the days to switch them on or off.",
              "Set Open Time, Close Time and Slot Length.",
              "Pick a date and press Add Closed Date for bank holidays or one-off closures.",
              "Press Save Availability.",
            ],
          },
        ],
        tips: [
          "A slot that's already requested isn't offered to the next customer, unless that booking was declined.",
          "An MOT booking is the customer's own car, so it offers Showed up and No-show but not Bought.",
          "Your opening hours on the public page come from the Availability settings here.",
        ],
        access: "Everyone can review bookings and record outcomes. Only the owner or a manager can change Availability.",
      },
    },

    // ── Wanted Cars ───────────────────────────────────────────────────
    {
      id: "wanted",
      title: "Wanted Cars",
      route: "/dealer/sales/wanted",
      steps: [
        {
          id: "wanted-how",
          target: "heading:How this works",
          title: "Customers waiting for a car",
          narration:
            "When a customer can't find the car they want on your public page, they can ask to be told if you get one. Their request lands here and the team gets a notification. Copy Link gives you your store page to share.",
        },
        {
          id: "wanted-matches",
          target: "heading:Waiting for a car you have",
          title: "You've got one for them",
          narration:
            "This list is the good news: people waiting for a car you have in stock right now. Each shows the cars that fit, with a note if one is over their budget. Click a car to open it.",
        },
        {
          id: "wanted-contact",
          target: "button:Call",
          title: "Getting in touch",
          narration:
            "Call, Text and Email open your own phone or mail app with a message ready to read first. Nothing is ever sent for you. Once you've spoken, press Mark contacted so nobody rings them twice.",
        },
        {
          id: "wanted-waiting",
          target: "heading:Waiting —",
          title: "Still waiting",
          narration:
            "Waiting holds everyone you don't have a match for yet. When a car that fits their budget arrives in stock, the team is told, and they move up to the top list.",
        },
        {
          id: "wanted-privacy",
          target: "button:Forget this person",
          title: "Their details",
          narration:
            "Everyone here agreed to be contacted, and their details are removed twelve months after they last asked. Close takes someone off your active list. Forget this person deletes their details for good, for example when they ask you to.",
        },
      ],
      guide: {
        summary:
          "Wanted Cars lists customers who asked, on your public page, to be told when you get a certain car. The ones you already have a car for are shown first, and you contact them yourself from your own phone or email.",
        howTo: [
          {
            question: "How do I contact someone about a car?",
            steps: [
              "Look under Waiting for a car you have.",
              "Check the matching car and its price against their budget.",
              "Press Call, Text or Email. Your own app opens with a message ready to read.",
              "After you've spoken, press Mark contacted.",
            ],
          },
          {
            question: "How do I delete someone's details?",
            steps: ["Press Forget this person on their row.", "Press Yes, delete. This can't be undone."],
          },
          {
            question: "How do customers get on this list?",
            steps: [
              "Press Copy Link and share your store page.",
              "A customer fills in Can't see the one you want? on that page and agrees to be contacted.",
              "Their request appears here, and the team gets a notification.",
            ],
          },
        ],
        tips: [
          "Nothing on this screen sends a message. You choose who to contact and how.",
          "Back to waiting puts a contacted or closed request back on the active list.",
          "Details are forgotten automatically twelve months after the person last asked.",
        ],
      },
    },

    // ── Your Public Page ──────────────────────────────────────────────
    {
      id: "public-page",
      title: "Your Public Page",
      route: "/dealer/marketing",
      steps: [
        {
          id: "public-page-intro",
          target: "heading:Marketing Hub",
          title: "Your shop window",
          narration:
            "This is your public page, the shop window customers see without logging in. What's shown below is the real page, built from your own stock, so any change you make to a car shows here too.",
        },
        {
          id: "public-page-link",
          target: "button:Copy Link",
          title: "Share your page",
          narration:
            "Press Copy Link to grab its web address, then put it on your website, your Google listing, social media and adverts. Anyone with the link can view it, no login needed.",
        },
        {
          id: "public-page-book",
          target: "button:Book a viewing or test drive",
          title: "Getting in touch",
          narration:
            "Customers can ring you, if your phone number is saved in Settings, or press Book a viewing or test drive to request a slot. Their request arrives in Viewings and Test Drives for you to confirm.",
        },
        {
          id: "public-page-stock",
          target: "css:main section.grid",
          title: "Your cars for sale",
          narration:
            "Every car in stock is listed, newest first, with its price, year, mileage and colour. Each has its own Book a viewing button, and See full history appears on cars whose Car Passport you've published.",
        },
        {
          id: "public-page-wanted",
          target: "css:section[aria-labelledby=wanted-heading]",
          title: "Can't see the one?",
          narration:
            "This form lets a customer tell you the car they're after. It's switched off in this preview, so you can't create a pretend request. Real ones go to Wanted Cars.",
        },
        {
          id: "public-page-hours",
          target: "css:section[aria-labelledby=opening-hours]",
          title: "Opening hours",
          narration:
            "Your opening hours come from the Availability settings on the Viewings and Test Drives screen, so change them there and they update here.",
        },
        {
          id: "public-page-more",
          target: "button:Marketplace Sync",
          title: "The portal feed",
          narration:
            "Marketplace Sync takes you to your portal stock feed. Below it is a short list of things that aren't ready yet, such as listing boosts and branding tools. They're marked coming soon, not switched on.",
        },
      ],
      guide: {
        summary:
          "This screen shows your real public page: your stock, a booking button, a form for customers looking for a particular car, and your opening hours. Anyone can view it without logging in, so share the link everywhere you advertise.",
        howTo: [
          {
            question: "How do I share my public page?",
            steps: ["Press Copy Link at the top.", "Paste the link into your website, Google listing, social media or adverts."],
          },
          {
            question: "How do I change what a car shows?",
            steps: [
              "Open the car from Stock.",
              "Edit its details, price or photos and save.",
              "Come back here: the public page shows the change.",
            ],
          },
          {
            question: "How do I add a full history button to a car?",
            steps: ["Open the car from Stock.", "Go to its Car Passport tab and publish it.", "See full history then appears on that car here."],
          },
        ],
        tips: [
          "A car without an asking price shows Price on request.",
          "Your phone number and address only appear once they're saved in Settings.",
          "The wanted form is switched off in this preview, but the booking buttons are live links, so a test booking made here would be real.",
        ],
      },
    },

    // ── Portal Stock Feed ─────────────────────────────────────────────
    {
      id: "portal-feed",
      title: "Portal Stock Feed",
      route: "/dealer/marketing/sync",
      steps: [
        {
          id: "portal-feed-intro",
          target: "heading:Marketplace Sync",
          title: "Your stock as a file",
          narration:
            "This screen gives you your stock as a CSV file, the kind of spreadsheet most car portals can read. To be clear, FlipPilot doesn't send your stock to any portal for you.",
        },
        {
          id: "portal-feed-csv",
          target: "heading:Generic CSV Stock Feed",
          title: "What's in the feed",
          narration:
            "The feed lists every car you haven't sold, built fresh from your stock each time it's opened: registration, price, mileage, photos and your advert description. Your private notes are never included.",
        },
        {
          id: "portal-feed-buttons",
          target: "button:Download Feed",
          title: "Download or link",
          narration:
            "Download Feed saves the file for you to upload to a portal that takes CSV files. Copy Feed URL copies its web address, for a portal that has agreed to collect it from you. Anyone with that address can read the file.",
        },
        {
          id: "portal-feed-portals",
          target: "heading:AutoTrader",
          title: "The big portals",
          narration:
            "Underneath, each big portal is listed with what it would need before a direct connection, such as a partner account. None of them are connected, so for now the CSV feed is how your stock gets onto them.",
        },
      ],
      guide: {
        summary:
          "The Portal Stock Feed turns your unsold stock into a CSV file you can download or share as a link. Nothing is sent to AutoTrader, Motors.co.uk, eBay Motors or Gumtree for you: direct connections aren't available yet.",
        howTo: [
          {
            question: "How do I get my stock onto a portal?",
            steps: [
              "Press Download Feed to save the CSV file.",
              "Log in to the portal's own dealer area.",
              "Upload the file there, if the portal accepts CSV uploads.",
            ],
          },
          {
            question: "How do I give a portal a feed link?",
            steps: ["Check the portal has agreed to collect a feed from you.", "Press Copy Feed URL.", "Send them the link yourself."],
          },
        ],
        tips: [
          "Sold cars are left out, and the file is rebuilt every time it's opened, so it's always current.",
          "The Description column uses each car's advert description, never its internal notes.",
          "Anyone with the feed address can read it, so only share it with portals you use.",
        ],
      },
    },
  ],
};
