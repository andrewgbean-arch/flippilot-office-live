// The "Your team" chapter of the guided tour: your own rota and diary, the
// team's messages, the staff records, the rota planner and who can see what.
// Every line must be true of the screens as they are (see tourPlan.ts).
//
// Two kinds of "person" live here, and the words must keep them apart: a
// LOGIN (someone invited in Settings, Manage Team; the rota, the Time Clock and
// Message a Teammate use these) and a STAFF RECORD (the Staff page's own list
// of details, which lets nobody in).

import type { TourChapter } from "../tourPlan";
import { canManageStaff } from "@/lib/permissions";

export const chapter: TourChapter = {
  id: "team",
  title: "Your team",
  blurb: "Rotas, diaries, messages, staff records and who can see what.",
  pages: [
    // ------------------------------------------------------------------
    {
      id: "my-rota",
      title: "My Rota",
      route: "/my-rota",
      steps: [
        {
          id: "my-rota-intro",
          target: "heading:My Rota",
          title: "Your own rota",
          narration:
            "My Rota is your own page: your shifts, how much holiday you have left, and your leave requests. Everyone at the dealership has one, whatever their role, and it only ever shows your own.",
        },
        {
          id: "my-rota-week",
          target: "heading:This Week",
          title: "This week's shifts",
          narration:
            "Here are your shifts for the week, with your total hours at the end. Days you're on approved leave say so. Use Prev and Next to look at other weeks, and This Week to come back.",
        },
        {
          id: "my-rota-balance",
          target: "heading:Leave Balance",
          title: "Holiday left",
          narration:
            "Your leave balance shows your yearly entitlement, the holiday days taken, what's remaining and any sick days. It counts only the days you'd normally work, so a manager needs to have set your work pattern on the Rota Planner.",
        },
        {
          id: "my-rota-request",
          target: "button:Request Leave",
          title: "Asking for time off",
          narration:
            "Click Request Leave, choose holiday, sick or other, and pick the dates. Holiday and other leave wait for a manager to approve them. Sick leave is logged straight away.",
        },
        {
          id: "my-rota-requests",
          target: "heading:My Leave Requests",
          title: "Your requests",
          narration:
            "Below that are your requests: anything still pending approval, which you can withdraw, and your history, with each one marked approved or declined.",
        },
      ],
      guide: {
        summary:
          "My Rota shows your own shifts week by week, your holiday balance and your leave requests. Managers set the shifts on the Rota Planner; you ask for time off here.",
        howTo: [
          {
            question: "How do I book holiday?",
            steps: [
              "Click Request Leave.",
              "Choose Holiday under Type.",
              "Pick the Start Date and End Date, and add a note if you like.",
              "Click Submit Request. It shows as pending until a manager approves or declines it.",
            ],
          },
          {
            question: "How do I tell work I'm off sick?",
            steps: [
              "Click Request Leave.",
              "Choose Sick under Type.",
              "Pick the dates and click Submit Request. Sick leave is logged straight away, with no approval needed.",
            ],
          },
          {
            question: "How do I cancel a leave request?",
            steps: [
              "Find it under Pending Approval.",
              "Click Withdraw. Only requests that are still pending can be withdrawn.",
            ],
          },
        ],
        tips: [
          "If your balance looks wrong, ask a manager to check your work pattern and entitlement on the Rota Planner.",
          "The note on your leave request is seen only by you, managers and the owner.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "my-diary",
      title: "My Diary",
      route: "/diary",
      steps: [
        {
          id: "my-diary-intro",
          target: "heading:Diary",
          title: "Your own diary",
          narration:
            "My Diary is your private notebook for reminders, to-dos and notes. Only you can see it, and it's kept separate from customer bookings and the rota.",
        },
        {
          id: "my-diary-days",
          target: "button:← Prev",
          title: "Moving between days",
          narration:
            "Each day has its own page. Prev and Next step a day at a time, and Jump to Today brings you back when you've wandered off to another day.",
        },
        {
          id: "my-diary-add",
          target: "css:main input[placeholder^='Add a reminder']",
          title: "Adding an entry",
          narration:
            "Type a reminder, job or note in this box and press Enter or click Add. Leave To-do ticked for something you need to do, or untick it for a plain note.",
        },
        {
          id: "my-diary-list",
          target: "heading:Today",
          title: "Ticking things off",
          narration:
            "Your entries for the day are listed here. Tick a to-do when it's done and it's crossed out. Remove deletes an entry for good, after asking you first.",
        },
      ],
      guide: {
        summary:
          "My Diary is your own day-by-day notebook for reminders, to-dos and notes. It's private to you, and separate from customer bookings and the rota.",
        howTo: [
          {
            question: "How do I add a reminder for another day?",
            steps: [
              "Use Next or Prev to go to the day.",
              "Type the reminder in the box.",
              "Leave To-do ticked if it's a task, or untick it for a note.",
              "Click Add or press Enter.",
            ],
          },
          {
            question: "How do I mark something done?",
            steps: ["Tick the box beside it. It's crossed out, and you can untick it again if you need to."],
          },
        ],
        tips: ["The diary doesn't send reminders or notifications, so glance at it at the start of each day."],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "team-board",
      title: "Team Message Board",
      route: "/feedback",
      steps: [
        {
          id: "team-board-intro",
          target: "heading:Team Message Board",
          title: "The team board",
          narration:
            "The Team Message Board is a shared noticeboard for your whole dealership. Anyone can post, and everyone on the team can read it. It's good for ideas, niggles and suggestions.",
        },
        {
          id: "team-board-post",
          target: "heading:Post a Message",
          title: "Posting a message",
          narration:
            "Write your message here, add pictures with Add photos if they help, then click Submit. You can post photos on their own too, without any words.",
        },
        {
          id: "team-board-anonymous",
          target: "css:main .sn-checkbox-row",
          title: "Posting anonymously",
          narration:
            "Tick Post anonymously and your name isn't recorded against the post at all, not even for the owner, and not on any photos you add either. It's there so people can raise things honestly.",
        },
        {
          id: "team-board-messages",
          target: "heading:Messages",
          title: "Reading and acting",
          narration:
            "Every post shows here, newest first, marked New, Reviewed or Actioned. Managers and the owner get Mark Reviewed and Mark Actioned buttons, so the team can see what's been dealt with.",
        },
      ],
      guide: {
        summary:
          "The Team Message Board is a noticeboard everyone at your dealership can post on and read. Posts can be anonymous, and managers mark them reviewed or actioned.",
        howTo: [
          {
            question: "How do I post on the board?",
            steps: [
              "Type your message under Post a Message.",
              "Click Add photos if you want to attach pictures.",
              "Tick Post anonymously if you'd rather your name wasn't on it.",
              "Click Submit.",
            ],
          },
          {
            question: "How do I show the team a post has been dealt with?",
            steps: ["Find the post under Messages.", "Click Mark Reviewed when you've read it, or Mark Actioned once it's sorted."],
          },
        ],
        tips: ["For a private word with one person, use Message a Teammate instead."],
        access:
          "Everyone can post and read. Only managers and the owner can mark posts Reviewed or Actioned.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "teammate-message",
      title: "Message a Teammate",
      route: "/dealer/staff/message",
      steps: [
        {
          id: "teammate-message-intro",
          target: "heading:Message a Teammate",
          title: "A private message",
          narration:
            "Message a Teammate sends a private message to one person, not the whole team. They get a notification in their bell, and only the two of you can read it.",
        },
        {
          id: "teammate-message-send",
          target: "heading:Send a Message",
          title: "Sending one",
          narration:
            "Pick a teammate from the list, write your message or add pictures with Add photos, then click Send Message. The list shows everyone with a FlipPilot login, not the staff records on the Staff page.",
        },
        {
          id: "teammate-message-list",
          target: "heading:Messages",
          title: "Your conversations",
          narration:
            "Messages you've sent and received are listed here, newest first. On the ones you've sent, the badge changes from Sent to Received once your teammate has opened this page.",
        },
      ],
      guide: {
        summary:
          "Message a Teammate sends a private message, with photos if you like, to one person at your dealership. They get a bell notification, and only the two of you can see the message.",
        howTo: [
          {
            question: "How do I send someone a message?",
            steps: [
              "Choose them under Select a teammate.",
              "Type your message, or click Add photos.",
              "Click Send Message.",
            ],
          },
          {
            question: "How do I know they've seen it?",
            steps: ["Look at the badge on your message under Messages.", "It says Received once they've opened their Message a Teammate page."],
          },
        ],
        tips: ["Someone missing from the list needs a FlipPilot login: the owner invites them from Settings, Manage Team."],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "staff",
      title: "Staff",
      route: "/dealer/staff",
      steps: [
        {
          id: "staff-intro",
          target: "tour-staff",
          title: "Your staff list",
          narration:
            "The Staff page holds your team's records: names, roles, branches and contact details. A staff record is not a login. Adding someone here doesn't let them into FlipPilot; the owner invites people from Settings, Manage Team.",
        },
        {
          id: "staff-planner-link",
          target: "button:Open Rota Planner",
          title: "Straight to the rota",
          narration:
            "Open Rota Planner jumps straight to the weekly rota, where managers set shifts and decide leave, and everyone can see who's working when.",
        },
        {
          id: "staff-counts",
          target: "css:main .sn-metrics-row",
          title: "Your headcount",
          narration:
            "These tiles count your staff records: the total, how many are active, and how many managers, sales staff and trainees you have.",
        },
        {
          id: "staff-clock",
          target: "heading:Time Clock",
          title: "Clocking in",
          narration:
            "The Time Clock is for you. Click Clock In when you arrive and Clock Out when you leave. Today's Log shows who's clocked in today and their hours. Managers and the owner see everyone's past times; everyone else sees their own.",
        },
        {
          id: "staff-roles",
          target: "heading:Role Distribution",
          title: "Who does what",
          narration:
            "Role Distribution shows what share of your staff records falls in each role, from managers and sales to cleaners, office staff and MOT testers.",
        },
        {
          id: "staff-branches",
          target: "heading:Branch Performance",
          title: "Staff per branch",
          narration:
            "Despite its name, Branch Performance simply counts how many staff records you have at each branch. It doesn't measure how a branch is doing.",
        },
        {
          id: "staff-list",
          target: "heading:Active Staff",
          title: "The team list",
          narration:
            "Every active staff member has a card with their role and branch. View / Edit opens their record. Remove takes them off the list for good, after asking first, and only managers and the owner see that button.",
        },
        {
          id: "staff-record",
          target: "button:View / Edit",
          title: "A staff record",
          narration:
            "A record holds their name, role, branch, email, phone and skills. Managers and the owner also see their NI number, address and private notes, and can change the record and Save Changes. Everyone else gets a read-only view without those details.",
        },
      ],
      guide: {
        summary:
          "The Staff page holds your staff records and the Time Clock. A staff record is your own note of someone's details, not a login: to let someone into FlipPilot, the owner invites them from Settings, Manage Team.",
        howTo: [
          {
            question: "How do I clock in and out?",
            steps: ["Click Clock In when you start.", "Click Clock Out when you finish.", "Your hours show in Today's Log."],
          },
          {
            question: "How do I update someone's details?",
            steps: [
              "Find them under Active Staff and click View / Edit.",
              "Change their details, NI number, address, skills or notes.",
              "Click Save Changes.",
            ],
          },
          {
            question: "How do I remove someone who has left?",
            steps: [
              "Click Remove on their card and confirm.",
              "If they had a login too, the owner should remove them in Settings, Manage Team straight away, so they lose access.",
            ],
          },
        ],
        tips: [
          "The Rota Planner, the Time Clock and Message a Teammate work from logins, not staff records.",
          "The role on a staff record is a label for your records. What someone can see and do comes from the role on their login.",
        ],
        access:
          "Everyone can clock in and see the staff list. Only managers and the owner can edit or remove staff records, or see NI numbers, addresses and private notes.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "rota-planner",
      title: "Rota Planner",
      route: "/dealer/staff/planner",
      steps: [
        {
          id: "rota-planner-intro",
          target: "heading:Staff Planner",
          title: "The rota",
          narration:
            "This is the Rota Planner: who's working which days, their work patterns, holiday balances and leave. Everyone can look, so the whole team knows who's in. Only managers and the owner can change it.",
        },
        {
          id: "rota-planner-week",
          target: "heading:Weekly Rota",
          title: "The week at a glance",
          narration:
            "Each row is a team member with a login, and each cell is their shift that day, or their leave. Use Prev, Next and This Week to move around. Managers and the owner click a cell to set, change or remove a shift, and that person gets a notification.",
        },
        {
          id: "rota-planner-generate",
          target: "button:Auto-Generate Week",
          title: "A first draft",
          narration:
            "Auto-Generate Week fills the gaps with a first draft, spreading each person's target hours across the days they're available and you're open. It skips approved leave and never overwrites a shift you've set by hand. A sparkle marks each shift it added.",
          showIf: canManageStaff,
        },
        {
          id: "rota-planner-publish",
          target: "button:Publish Rota",
          title: "Sending it out",
          narration:
            "Publish Rota sends everyone on this week's rota their own shifts as a notification in their bell. Shifts show on their My Rota page as soon as they're saved, so publishing is the nudge, not the unlock.",
          showIf: canManageStaff,
        },
        {
          id: "rota-planner-patterns",
          target: "heading:Work Patterns",
          title: "Work patterns",
          narration:
            "Work Patterns hold each person's full or part time status, their target hours a week and the days they can work. Auto-Generate builds from these, and holiday balances count only these working days, so set them for everyone.",
          showIf: canManageStaff,
        },
        {
          id: "rota-planner-balances",
          target: "heading:Leave Balances",
          title: "Holiday balances",
          narration:
            "Leave Balances shows each person's yearly entitlement, holiday taken, what's left and sick days. Entitlement starts at 28 days, and managers and the owner can change it for each person.",
        },
        {
          id: "rota-planner-leave",
          target: "heading:Holiday",
          title: "Leave requests",
          narration:
            "Here's all the holiday and sick leave. Anyone can click Request Leave for themselves. Managers and the owner see Approve and Decline on each pending request, and approved leave shows on the rota straight away.",
        },
      ],
      guide: {
        summary:
          "The Rota Planner is the weekly rota for everyone with a FlipPilot login, with their work patterns, holiday balances and leave. Everyone can view it; managers and the owner set shifts, patterns and entitlements, and decide leave.",
        howTo: [
          {
            question: "How do I set someone's shift?",
            steps: [
              "Find the week with Prev and Next.",
              "Click the cell for that person and day.",
              "Enter the Start and End times, and a note if you like.",
              "Click Save. They get a notification straight away.",
            ],
          },
          {
            question: "How do I build next week's rota quickly?",
            steps: [
              "Make sure everyone has a work pattern with target hours and available days.",
              "Click Next to go to next week.",
              "Click Auto-Generate Week.",
              "Adjust any shift by clicking its cell.",
              "Click Publish Rota to send everyone their week.",
            ],
          },
          {
            question: "How do I approve holiday?",
            steps: ["Scroll to Holiday & Sick Leave.", "Under Pending Approval, click Approve or Decline."],
          },
        ],
        tips: [
          "Someone missing from the rota needs a FlipPilot login: the owner invites them from Settings, Manage Team. Staff records don't appear here.",
          "Sick leave is approved automatically as soon as it's logged.",
        ],
        access:
          "Everyone can view the rota and request their own leave. Only managers and the owner can edit shifts, work patterns and entitlements, generate or publish the rota, and approve or decline leave.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "add-staff",
      title: "Add Staff",
      route: "/dealer/staff/add",
      steps: [
        {
          id: "add-staff-intro",
          target: "heading:Add Staff Member",
          title: "Adding a staff record",
          narration:
            "Add Staff creates a staff record for someone who works for you. It doesn't create a login or invite them: to let someone into FlipPilot, the owner invites them from Settings, Manage Team.",
        },
        {
          id: "add-staff-form",
          target: "css:main .sn-form",
          title: "Their details",
          narration:
            "Enter their name, the only thing you must fill in, then their role, branch, email and phone. You can add their NI number, address, skills and notes from their record afterwards.",
        },
        {
          id: "add-staff-save",
          target: "css:main .sn-detail-actions button",
          title: "Saving the record",
          narration:
            "Click Add Staff to save. The form clears and says staff member added, ready for the next person, and they appear on the Staff page straight away.",
        },
      ],
      guide: {
        summary:
          "Add Staff creates a record of someone who works for you, for your own staff list. It doesn't give them a login: the owner invites people into FlipPilot from Settings, Manage Team.",
        howTo: [
          {
            question: "How do I add someone to my staff list?",
            steps: [
              "Type their Name.",
              "Choose their Role and type their Branch.",
              "Add their Email and Phone if you have them.",
              "Click Add Staff.",
              "Open their record from the Staff page with View / Edit to add their NI number, address, skills and notes.",
            ],
          },
          {
            question: "How do I give someone a login?",
            steps: ["The owner goes to Settings and opens Manage Team.", "Invite them there and choose their role."],
          },
        ],
        tips: ["The role on a staff record is only a label. What someone can see and do comes from the role on their login."],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "who-can-see-what",
      title: "Who Can See What",
      route: "/dealer/staff/permissions",
      steps: [
        {
          id: "who-can-see-what-intro",
          target: "heading:Who can see what",
          title: "Who sees what",
          narration:
            "This page sets out exactly what each role can see and change. Each person's role is set when they're invited. Our server enforces these rules, so hiding a screen is never the only thing standing in the way.",
        },
        {
          id: "who-can-see-what-link",
          target: "button:Settings → Manage Team",
          title: "Changing a role",
          narration:
            "To change someone's role, the owner follows this link to Settings, Manage Team. The roles are owner, manager, finance, sales and general.",
        },
        {
          id: "who-can-see-what-see",
          target: "css:main h2 + ul",
          title: "Who can see",
          narration:
            "This list covers the sensitive things: the books and profit, staff NI numbers and addresses, other people's leave notes and clock-in history, Wanted Cars, and billing, with who can see each one.",
        },
        {
          id: "who-can-see-what-change",
          target: "css:main ul + h2 + ul",
          title: "Who can change",
          narration:
            "And this list covers who can change things, from recording sales in the books and removing stock, to editing the rota, approving my work, publishing Car Passports and inviting people.",
        },
        {
          id: "who-can-see-what-everyone",
          target: "css:main ul + h2 + ul + div",
          title: "What everyone can do",
          narration:
            "Please read this box. Whatever their role, everyone you invite can see your stock, leads, customers and their contact details, jobs and the rota, and can change most of them. Only invite people you trust, and remove anyone who leaves straight away.",
        },
      ],
      guide: {
        summary:
          "Who Can See What explains what each role in FlipPilot can see and change. It describes the rules our server enforces; the roles themselves are set in Settings, Manage Team.",
        howTo: [
          {
            question: "How do I change what someone can see?",
            steps: [
              "The owner clicks the Settings → Manage Team link at the top.",
              "Change that person's role to the one that fits their job.",
            ],
          },
          {
            question: "How do I stop someone who's left from getting in?",
            steps: ["The owner opens Settings, Manage Team.", "Remove them straight away. They lose access on their very next click."],
          },
        ],
        tips: ["There are no tick boxes to fine-tune access: what someone can do comes from their role."],
      },
    },
  ],
};
