// The guided tour, chapter "Customers and the workshop": the Customers and
// Workshop menus, screen by screen, read by Wendy, plus each screen's help.
// Every line must be true of the screens as they are (see tourSteps.ts).

import type { TourChapter } from "../tourPlan";
import { canManageStaff } from "@/lib/permissions";

export const chapter: TourChapter = {
  id: "workshop",
  title: "Customers and the workshop",
  blurb: "Customers, suppliers, jobs, the workshop calendar and parts.",
  pages: [
    // ── Customer Database ─────────────────────────────────────────────
    {
      id: "customers",
      title: "Customer Database",
      route: "/customers",
      steps: [
        {
          id: "customers-intro",
          target: "css:main .sn-hero",
          title: "Your customers",
          narration:
            "This is your customer database: the people you've sold to or want to keep in touch with, kept apart from your sales leads and your suppliers. It also records whether each person has agreed to hear from you.",
        },
        {
          id: "customers-add",
          target: "button:Add Customer",
          title: "Adding a customer",
          narration:
            "Press Add Customer and fill in a name plus an email or phone number, with the cars they're interested in and any notes. Press Save Customer and they're saved for the whole team.",
        },
        {
          id: "customers-search",
          target: "css:main input[placeholder^='Search by name']",
          title: "Finding someone",
          narration:
            "Type in the search box to find a customer by name, email, phone number or the car they're interested in. The list narrows as you type.",
        },
        {
          id: "customers-consent",
          target: "css:main .sn-recent-lead",
          title: "Recording consent",
          narration:
            "Each customer has an email and a WhatsApp setting: not asked, opted in or opted out. Choose the setting and type how they agreed, such as verbally at purchase. Both are saved as you go, with the date they opted in.",
        },
        {
          id: "customers-no-send",
          target: "",
          title: "No sending here",
          narration:
            "There's no send button on this screen, on purpose. FlipPilot doesn't send marketing emails or WhatsApp messages, so this is an honest record of who has said yes, ready for when you contact them yourself.",
        },
        {
          id: "customers-remove",
          target: "button:Remove",
          showIf: user => canManageStaff(user),
          title: "Erasing a customer",
          narration:
            "Remove erases a customer and their consent record for good, for example when someone asks you to delete their details. Only the owner or a manager can do this, and you'll be asked to confirm first.",
        },
      ],
      guide: {
        summary:
          "The Customer Database keeps your customers' contact details and a record of whether each one agreed to hear from you by email or WhatsApp. Nothing is sent from here: it's the record you check before contacting anyone yourself.",
        howTo: [
          {
            question: "How do I add a customer?",
            steps: [
              "Press Add Customer.",
              "Enter their name and at least an email or a phone number.",
              "Add their vehicle interests and notes if you like.",
              "Press Save Customer.",
            ],
          },
          {
            question: "How do I record that a customer agreed to marketing?",
            steps: [
              "Find the customer, using the search box if needed.",
              "In the box next to Email or WhatsApp, type how they agreed, such as verbal at purchase.",
              "Choose Opted in from the list next to it. It saves straight away.",
            ],
          },
          {
            question: "How do I erase a customer who asks?",
            steps: ["Find the customer.", "Press Remove.", "Confirm. Their details and consent record are deleted for good."],
          },
        ],
        tips: [
          "The note about how someone agreed is saved when you click away from the box, or when you change the setting.",
          "A customer's name, email and phone can't be edited on this screen once saved.",
          "If someone says no, set them to Opted out rather than deleting them, so you keep a record not to contact them.",
        ],
        access: "Everyone can add customers and record consent. Only the owner or a manager can remove a customer.",
      },
    },

    // ── Suppliers & Contacts ──────────────────────────────────────────
    {
      id: "contacts",
      title: "Suppliers & Contacts",
      route: "/contacts",
      steps: [
        {
          id: "contacts-intro",
          target: "css:main .sn-hero",
          title: "Your business contacts",
          narration:
            "This is your shared business address book: parts suppliers, auction houses, transport and recovery, valeters and anyone else you deal with, so nobody has to hunt for a number.",
        },
        {
          id: "contacts-add",
          target: "button:Add Contact",
          title: "Adding a contact",
          narration:
            "Press Add Contact, enter the business name and choose a category. Add the person to ask for, their email, phone, address and notes as you like. Only the business name is needed.",
        },
        {
          id: "contacts-filter",
          target: "button:All",
          title: "Filter by type",
          narration:
            "These buttons filter the list by category. Press Parts Supplier, say, to see only those, or All to see everyone again. The list is grouped by category underneath.",
        },
        {
          id: "contacts-card",
          target: "css:main .sn-recent-lead",
          title: "Each contact",
          narration:
            "Each contact shows its details. Email opens a new message in your own mail app, Edit changes their details, and Remove deletes them after you confirm.",
        },
      ],
      guide: {
        summary:
          "Suppliers & Contacts is the team's shared list of the businesses you deal with, grouped by category. It's separate from your customers and your sales leads.",
        howTo: [
          {
            question: "How do I add a supplier?",
            steps: [
              "Press Add Contact.",
              "Type the Business Name and choose a Category, such as Parts Supplier.",
              "Fill in Contact Person, Email, Phone, Address and Notes if you have them.",
              "Press Add.",
            ],
          },
          {
            question: "How do I change a contact's details?",
            steps: ["Press Edit on the contact.", "Change what you need.", "Press Save Changes."],
          },
          {
            question: "How do I email a supplier?",
            steps: ["Press Email on the contact.", "Your own mail app opens with their address filled in.", "Write and send the email from there."],
          },
        ],
        tips: [
          "The Email button only appears when the contact has an email address saved.",
          "For ordering parts, the supplier email is stored on each item in Parts & Consumables, not taken from here.",
        ],
      },
    },

    // ── Jobs Board ────────────────────────────────────────────────────
    {
      id: "jobs",
      title: "Jobs Board",
      route: "/jobs",
      steps: [
        {
          id: "jobs-intro",
          target: "heading:Jobs Board",
          title: "The team's to-do list",
          narration:
            "The jobs board is your team's shared to-do list: MOTs to book, cars to prep, calls to make. Anyone on the team can add a job, move it along or tidy it up.",
        },
        {
          id: "jobs-add",
          target: "button:Add Job",
          title: "Adding a job",
          narration:
            "Press Add Job and give it a title, then add notes, a car from stock, who it's for, a priority and a due date if you like. Fill in the workshop booking part too and it appears on the Workshop Calendar.",
        },
        {
          id: "jobs-todo",
          target: "heading:To Do",
          title: "Three columns",
          narration:
            "Jobs sit in three columns, To Do, In Progress and Done, newest at the top. Each card shows the priority, the car, who it's assigned to and when it's due. A due date that has passed shows as Overdue in red.",
        },
        {
          id: "jobs-move",
          target: "button:→ In Progress",
          title: "Moving a job along",
          narration:
            "Move a job with the arrow buttons on its card. Click the car's name to open that car. Edit changes any detail, and Delete removes the job for good after you confirm.",
        },
        {
          id: "jobs-done",
          target: "heading:Done",
          title: "Finished work",
          narration:
            "Done keeps your finished jobs, so everyone can see what's been dealt with. If something needs another look, move it back with the arrow buttons rather than starting a new job.",
        },
      ],
      guide: {
        summary:
          "The Jobs Board is a shared to-do list for the whole team, in three columns: To Do, In Progress and Done. Jobs can be linked to a car, assigned to someone and booked into the workshop.",
        howTo: [
          {
            question: "How do I add a job?",
            steps: [
              "Press Add Job.",
              "Type a Title.",
              "Pick a Vehicle, Assign To someone, and set the Priority and Due Date if you want.",
              "Press Add Job at the bottom.",
            ],
          },
          {
            question: "How do I book a job into the workshop?",
            steps: [
              "Press Edit on the job, or Add Job for a new one.",
              "Under Workshop Booking, set the Date, Start Time, End Time and Bay / Location.",
              "Press Save Changes. The job now shows on the Workshop Calendar.",
            ],
          },
          {
            question: "How do I mark a job as done?",
            steps: ["Find the job's card.", "Press → Done."],
          },
        ],
        tips: [
          "Press Workshop Calendar at the top to see this week's workshop bookings.",
          "Delete can't be undone. Move finished work to Done instead, so there's a record of it.",
        ],
        access: "Everyone can add, edit and move jobs. Only managers and the owner can delete one, so the Delete button only shows for them.",
      },
    },

    // ── Workshop Calendar ─────────────────────────────────────────────
    {
      id: "workshop-calendar",
      title: "Workshop Calendar",
      route: "/workshop-calendar",
      steps: [
        {
          id: "workshop-calendar-intro",
          target: "css:main .sn-hero",
          title: "This week in the workshop",
          narration:
            "The workshop calendar shows the jobs booked into your workshop, day by day, so you can see how busy each bay is. It's for your team only: customers never see it.",
        },
        {
          id: "workshop-calendar-week",
          target: "heading:Week",
          title: "The week view",
          narration:
            "Each day lists its bookings in time order, with the bay. Use Prev and Next to move between weeks, and This Week to come back. Click any booking to change its time, bay or anything else about the job.",
        },
        {
          id: "workshop-calendar-unscheduled",
          target: "heading:Unscheduled Jobs",
          title: "Waiting for a slot",
          narration:
            "Unscheduled Jobs lists the open jobs without a workshop date. Press Schedule, fill in the date, start and end times and bay under Workshop Booking, and save. The job then moves onto the calendar.",
        },
        {
          id: "workshop-calendar-back",
          target: "button:← Back to Jobs Board",
          title: "Back to the board",
          narration:
            "Back to Jobs Board takes you to the full board, where jobs are added and moved between To Do, In Progress and Done.",
        },
      ],
      guide: {
        summary:
          "The Workshop Calendar shows a week of workshop bookings, taken from the jobs on your Jobs Board that have a workshop date. Jobs without a slot wait underneath until you schedule them.",
        howTo: [
          {
            question: "How do I book a job into a slot?",
            steps: [
              "Find it under Unscheduled Jobs and press Schedule.",
              "Under Workshop Booking, set the Date, Start Time, End Time and Bay / Location.",
              "Press Save Changes.",
            ],
          },
          {
            question: "How do I move a booking?",
            steps: ["Click the booking on its day.", "Change the Date, times or bay.", "Press Save Changes."],
          },
          {
            question: "How do I see next week?",
            steps: ["Press Next →.", "Press This Week to come back to today."],
          },
        ],
        tips: [
          "Finished jobs don't appear under Unscheduled Jobs, but a finished job that had a slot still shows on its day.",
          "New jobs are added on the Jobs Board, not here.",
        ],
      },
    },

    // ── Parts & Consumables ───────────────────────────────────────────
    {
      id: "consumables",
      title: "Parts & Consumables",
      route: "/consumables",
      steps: [
        {
          id: "consumables-intro",
          target: "tour-consumables",
          title: "Parts and supplies",
          narration:
            "Parts and consumables tracks the everyday supplies you'd hate to run out of, from screen wash to number plate screws, with a quick way to order more from your suppliers.",
        },
        {
          id: "consumables-order",
          target: "heading:Ready to Order",
          title: "Ready to order",
          narration:
            "Anything at or below its reorder level gathers in Ready to Order, grouped by supplier. Tick what you want, set the quantities, and Email Order writes one email per supplier in your own mail app. Items without a supplier email are listed separately.",
        },
        {
          id: "consumables-buttons",
          target: "tour-consumables-buttons",
          title: "Adding items",
          narration:
            "Add Consumable adds an item with its starting stock, reorder level, unit and supplier details. Import from CSV brings in a whole list from a spreadsheet instead.",
        },
        {
          id: "consumables-search",
          target: "css:main input[placeholder^='Search by name, part']",
          title: "Finding an item",
          narration:
            "Search by name, part number, description or supplier to find an item quickly, or tick Low stock only to see just what's running low.",
        },
        {
          id: "consumables-table",
          target: "css:main table",
          title: "Your stock list",
          narration:
            "Low items show in red. Click an item's stock figure to log a delivery or correct the count, and see every change so far. Order opens an email to that item's supplier, Edit changes its details, and Remove deletes it.",
        },
      ],
      guide: {
        summary:
          "Parts & Consumables keeps a count of your day-to-day supplies, flags anything that's running low, and writes order emails to your suppliers in your own mail app. Every delivery and correction is logged.",
        howTo: [
          {
            question: "How do I log a delivery?",
            steps: [
              "Click the item's stock figure in the Stock table.",
              "Choose Receive Delivery.",
              "Enter the Quantity received, and the cost and supplier if you like.",
              "Press Log Delivery.",
            ],
          },
          {
            question: "How do I correct a count after a stock take?",
            steps: [
              "Click the item's stock figure.",
              "Choose Correct Count.",
              "Enter the change, for example minus two if two are missing.",
              "Press Log Correction.",
            ],
          },
          {
            question: "How do I order what's running low?",
            steps: [
              "Look under Ready to Order.",
              "Untick anything you don't want this time and set each Order qty.",
              "Press Email Order for that supplier.",
              "Check the email in your own mail app and send it.",
            ],
          },
          {
            question: "How do I add a new item?",
            steps: [
              "Press Add Consumable.",
              "Enter the Item Name, Starting Stock and Reorder Below level.",
              "Add the unit and supplier details. A Supplier Email is needed for ordering.",
              "Press Add.",
            ],
          },
        ],
        tips: [
          "An item counts as low when its stock is at or below its reorder level.",
          "Once an item exists, its stock can only change through a logged delivery or correction, so there's always a history.",
          "Nothing is emailed for you: the order buttons open a ready-written email in your own mail app.",
        ],
      },
    },
  ],
};
