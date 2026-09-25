import type { TourChapter } from "../tourPlan";
import { canManageStaff } from "@/lib/permissions";

// Chapter two: Wendy (Pilot Brain) and her four screens. Pilot Brain is included
// in the trial and a paid add-on after it (requirePilotBrainAccess on the
// server). Only an owner or manager can have her prepare a change, or approve,
// reject or undo one (requireStaffRole("manager")); canManageStaff is that same
// group. The Decision Journal is owner/manager only through pageAccess.ts.

export const chapter: TourChapter = {
  id: "wendy",
  title: "Wendy, your Pilot Brain",
  blurb: "Asking me things, briefings, approvals, goals and the Decision Journal.",
  pages: [
    {
      id: "ask-wendy",
      title: "Ask Wendy",
      route: "/pilot-brain",
      steps: [
        {
          id: "ask-wendy-intro",
          target: "heading:Pilot Brain",
          title: "Talk to me here",
          narration:
            "This is where you talk to me. I read your own records, your stock, leads, bookings and jobs, so ask real questions: which cars are sticking, which leads need a call, how this month compares with last. Our conversation is kept just for you, and nobody else on the team can read it.",
        },
        {
          id: "ask-wendy-box",
          target: "css:main textarea.sn-input",
          title: "Asking a question",
          narration:
            "Type in this box and press Enter or Send, and Shift and Enter starts a new line. In Chrome or Edge, the microphone button lets you speak instead, and your words are typed in for you to check. If you came from Ask Wendy about this page, your question is already waiting here to send or change.",
        },
        {
          id: "ask-wendy-voice",
          target: "button:Wendy:",
          title: "Hear my replies",
          narration:
            "Switch Wendy on and I'll read my replies out loud. Pick a voice from the list and press Try this voice to hear it first. If no voice has been set up, your browser's own voice reads to you instead.",
        },
        {
          id: "ask-wendy-reports",
          target: "tour-wendy-reports",
          title: "Briefings and reviews",
          narration:
            "Morning Briefing writes you a quick run-down of the business today. Pick a period, from daily to quarterly, and press Get Review for a look back. Today's Priorities ranks what to do first, straight from your records. Once we've talked, Clear Conversation lets us start afresh.",
        },
        {
          id: "ask-wendy-limits",
          target: "",
          title: "What I will and won't do",
          narration:
            "I never change anything on my own. For an owner or manager, I can prepare a few small changes, like a car's asking price, a lead's status or a job's due date, and they wait on Approvals until one of you approves them. I only see what your role can see, so money figures stay with the owner, managers and finance.",
        },
      ],
      guide: {
        summary:
          "Ask Wendy is your chat with Pilot Brain, the app's AI. She answers from your dealership's own records, writes briefings and reviews, and for owners and managers can prepare small changes for approval. Pilot Brain is included in the free trial and is a paid add-on after it.",
        howTo: [
          {
            question: "How do I ask Wendy a question?",
            steps: [
              "Type your question in the box at the bottom, for example: which cars have been in stock longest?",
              "Press Enter or Send. Shift and Enter adds a new line.",
              "To speak instead, press the microphone button (in Chrome or Edge), then check the words before you send them.",
              "Wendy's reply appears in the conversation above.",
            ],
          },
          {
            question: "How do I get a briefing, a review or today's priorities?",
            steps: [
              "Press Morning Briefing for a run-down of the business today.",
              "For a review, choose Daily, Weekly, Monthly or Quarterly in the Review list.",
              "Press Get Review.",
              "Press Today's Priorities for a ranked list of what to do first.",
            ],
          },
          {
            question: "How do I have Wendy read her replies aloud?",
            steps: [
              "Press Wendy: Off so that it reads Wendy: On.",
              "Choose a voice from the Voice list.",
              "Press Try this voice to hear it.",
              "Press Wendy: On again to switch reading aloud off.",
            ],
          },
          {
            question: "How do I get Wendy to change a price or a status?",
            steps: [
              "Ask her in the chat, for example to drop a car's asking price or move a lead on. This works for owners and managers.",
              "She prepares the change and tells you it is waiting for approval. Nothing has changed yet.",
              "Open Approvals under Wendy · Pilot Brain in the menu.",
              "Check the old and new value on the card, then press Approve or Reject.",
            ],
          },
          {
            question: "How do I start the conversation afresh?",
            steps: [
              "Press Clear Conversation.",
              "Press it again when it says Click again to confirm.",
              "Only your own messages are cleared, never a teammate's.",
            ],
          },
        ],
        tips: [
          "Wendy answers from your own records, so the more complete your stock, leads and bookings are, the better her answers.",
          "Your conversation with Wendy is private to you.",
          "The owner can let Wendy look things up on the web from Settings, under Pilot Brain Web Access.",
          "Ask Wendy about this page, in the Help with this page panel on any screen, brings you here with a question typed in. It is never sent until you press Send.",
        ],
        access:
          "Everyone can chat with Wendy, but she only sees what their role can see: money figures such as profit and costs go to the owner, managers and finance only. Only owners and managers can have her prepare a change, and only they can approve it.",
      },
    },

    {
      id: "approvals",
      title: "Approvals",
      route: "/pilot-brain/operations",
      steps: [
        {
          id: "approvals-intro",
          target: "css:main .sn-hero",
          title: "Work I've prepared",
          narration:
            "This is Approvals. Everything I prepare waits here, and nothing happens until an owner or manager approves it. The work from Prepare Today's Work lands here, and so do the small changes owners and managers ask me for in chat, shown with the old value and the new one.",
        },
        {
          id: "approvals-prepare",
          target: "tour-prepare-work",
          title: "Prepare Today's Work",
          narration:
            "Press Prepare Today's Work and I look through your records for four kinds of job: a cost with no category, a lead that's still open a day or more after it came in, a day on the rota nobody is covering, and a booking nobody answered. For follow-ups I write a draft message, but I never send it.",
        },
        {
          id: "approvals-waiting",
          target: "css:main h2 + div > div",
          title: "Waiting for approval",
          narration:
            "Each card says what I'd do and why, with any draft message underneath. Approving a follow-up puts a job on the Jobs Board with my draft in its notes, for someone to send themselves. Approving a rota suggestion adds the shift, and a cost gets its category.",
        },
        {
          id: "approvals-approve",
          target: "button:Approve",
          showIf: user => canManageStaff(user),
          title: "Approve or reject",
          narration:
            "Press Approve to make it happen, or Reject to drop it. Approved work moves to Completed, which shows who approved it and when, and Undo this takes it back out. Anything rejected or undone is kept in the Audit Log.",
        },
        {
          id: "approvals-team",
          target: "",
          showIf: user => !canManageStaff(user),
          title: "Looking, not approving",
          narration:
            "You can see everything I've prepared here, but approving or rejecting it needs an owner or manager. If something looks right to you, have a word with one of them.",
        },
      ],
      guide: {
        summary:
          "Approvals is where the work Wendy prepares waits for a person to say yes. Nothing she prepares changes a record, and nothing is ever sent to a customer, until an owner or manager approves it, and approved work can be undone.",
        howTo: [
          {
            question: "How do I get Wendy to find today's work?",
            steps: [
              "Press Prepare Today's Work.",
              "Wait while she looks through your costs, leads, rota and bookings.",
              "New suggestions appear under Waiting for approval, each with the reason for it.",
            ],
          },
          {
            question: "How do I approve or reject something?",
            steps: [
              "Read the card: what Wendy would do, why, and any draft message or old and new value.",
              "Press Approve to carry it out, or Reject to drop it.",
              "Approved work moves to Completed; rejected work goes to the Audit Log.",
            ],
          },
          {
            question: "How do I undo something that was approved?",
            steps: [
              "Find it under Completed.",
              "Press Undo this.",
              "It moves to the Audit Log as Rolled back. If someone has changed that price or status again since, it is left alone and you are told why.",
            ],
          },
          {
            question: "What happens to a follow-up message?",
            steps: [
              "Approve the follow-up.",
              "A job called Follow up, with the customer's name, appears on the Jobs Board with Wendy's draft in its notes.",
              "Copy the draft into your own email, text or call notes and contact the customer yourself.",
              "Mark the job done on the Jobs Board.",
            ],
          },
        ],
        tips: [
          "Pressing Prepare Today's Work again does not repeat anything already waiting or done.",
          "Follow-ups are drafted for up to five leads and five bookings at a time.",
          "A lead is suggested when it is still open a day or more after it came in, even if someone has already spoken to them, so check the lead's notes before you chase.",
        ],
        access:
          "Anyone can see this page and press Prepare Today's Work. Only the owner and managers can approve, reject or undo.",
      },
    },

    {
      id: "goals",
      title: "Goals & Briefing",
      route: "/pilot-brain/strategy",
      steps: [
        {
          id: "goals-briefing",
          target: "heading:Executive Briefing",
          title: "The executive briefing",
          narration:
            "The Executive Briefing scores the business out of a hundred from what I'm watching, adds a market score once someone has pressed Check the Market, and blends in your goals for a strategic score. Below that are your greatest opportunity, your greatest risk, and the one thing I'd focus on first.",
        },
        {
          id: "goals-list",
          target: "css:main .sn-hero ~ div > h2",
          title: "Your goals",
          narration:
            "Each goal shows a progress bar, how far along it is, and whether you're on track or behind pace for the month or quarter. Only the owner, managers and finance see the pounds on a revenue or profit goal; everyone else sees the progress.",
        },
        {
          id: "goals-set",
          target: "heading:Set a new goal",
          showIf: user => canManageStaff(user),
          title: "Setting a goal",
          narration:
            "Owners and managers set goals here. Pick what to measure: revenue, profit, stock count, leads added or vehicles sold. Type a target, choose monthly or quarterly, add a label if you like, and press Set Goal. I track it from your records, and Remove goal takes one away.",
        },
      ],
      guide: {
        summary:
          "Goals & Briefing is the bigger picture: health scores for the business, its greatest opportunity and risk, what to focus on, and how you're doing against the goals you've set. Everything is worked out from your own records.",
        howTo: [
          {
            question: "How do I set a goal?",
            steps: [
              "Under Set a new goal, choose what to measure: Revenue (£), Profit (£), Stock count, Leads added or Vehicles sold.",
              "Type the target in Target value.",
              "Choose Monthly or Quarterly.",
              "Add a label if you want one, then press Set Goal.",
            ],
          },
          {
            question: "How do I tell if we're on track?",
            steps: [
              "Look at the goal under Goals.",
              "The percentage shows how far along you are, and on track or behind pace says whether you're keeping up for the time gone in the month or quarter.",
              "The line underneath shows the figure so far against the target.",
            ],
          },
          {
            question: "How do I remove a goal?",
            steps: [
              "Find the goal under Goals.",
              "Press Remove goal. It goes straight away, with no second check.",
            ],
          },
        ],
        tips: [
          "Market Health says Not checked yet until someone presses Check the Market on the dashboard.",
          "For a big call, like buying a batch of cars, use the Decision Journal to write it down and ask Wendy's view.",
        ],
        access:
          "Everyone can see the briefing and the goals. Only the owner and managers can set or remove goals, and only the owner, managers and finance see the pounds on revenue and profit goals.",
      },
    },

    {
      id: "decisions",
      title: "Decision Journal",
      route: "/pilot-brain/decisions",
      steps: [
        {
          id: "decisions-intro",
          target: "css:main .sn-hero",
          title: "The Decision Journal",
          narration:
            "The Decision Journal is for owners and managers. Write a big call down before you make it, like buying more SUVs or cutting the price of a slow seller, see what I think, decide, and check later how it went. You always decide: I only advise.",
        },
        {
          id: "decisions-stats",
          target: 'css:section[aria-label="How your decisions are going"]',
          title: "How your calls are going",
          narration:
            "This strip counts your open decisions, reviews that are due, and how often you followed my advice or went against it. Once three decisions have been reviewed, it also says how well your expectations held up, where close means within twenty per cent. It's your own record, never a forecast.",
        },
        {
          id: "decisions-new",
          target: "button:New decision",
          title: "Writing one down",
          narration:
            "Press New decision, say what you're deciding, add some background if it helps, and list at least two options. Press Write it down and the decision opens on its own page.",
        },
        {
          id: "decisions-list",
          target: "css:main .dj-list-item",
          title: "Your decisions",
          narration:
            "Your decisions are listed here, newest first, each marked Open, Decided, Review due or Reviewed, with a note if I advised, if I challenged it, and whether you followed me. Click one to open it.",
        },
        {
          id: "decisions-inside",
          target: "",
          title: "Inside a decision",
          narration:
            "Inside a decision, Ask Pilot gives you my recommendation and how sure I am, and Challenge me argues against the plan on purpose. The Simulator works an idea out on your own numbers and changes nothing. Then press Record my decision with what you expect, and at the review date, record what happened.",
        },
      ],
      guide: {
        summary:
          "The Decision Journal is where owners and managers write down big calls, get Wendy's view and a deliberate challenge, decide, and later record how it actually went. Over time it shows how good your calls are, and how often following Wendy paid off. Wendy only advises; nothing here changes a car, a price or the books.",
        howTo: [
          {
            question: "How do I write a decision down?",
            steps: [
              "Press New decision.",
              "Fill in What are you deciding?, and add Background if it helps.",
              "List the options, two to six of them. Use Add another option for more.",
              "Press Write it down. The decision opens on its own page.",
            ],
          },
          {
            question: "How do I get Wendy's view on it?",
            steps: [
              "Open the decision from Your decisions.",
              "Press Ask Pilot for her recommendation, her reasons and how sure she is.",
              "Press Challenge me for the Devil's Advocate: the case against, argued on purpose.",
              "To try an idea on your own numbers, pick one in the Simulator, fill in the figures and press Run simulation. Press Save to this decision to keep the result.",
            ],
          },
          {
            question: "How do I record what I decided?",
            steps: [
              "Under Your decision, pick the option you went with in Which way are you going?, and write your reasons under Why?",
              "Under What do you expect to happen?, add up to six numbers you expect, with Add an expectation.",
              "Choose when to Look back at how it went.",
              "Press Record my decision. Once recorded it cannot be changed.",
            ],
          },
          {
            question: "How do I record how it turned out?",
            steps: [
              "Open the decision when it shows Review due, or any time after deciding.",
              "Fill in what actually happened for each expectation.",
              "Press Record what happened. The journal compares what you expected with what happened.",
            ],
          },
        ],
        tips: [
          "Once Wendy has given a recommendation, the question and options are locked. To change them, write a new decision.",
          "Running a simulation saves nothing unless you press Save to this decision.",
          "The journal only says how your expectations are holding up once three decisions have been reviewed, so a small sample never looks like a trend.",
        ],
      },
    },
  ],
};
