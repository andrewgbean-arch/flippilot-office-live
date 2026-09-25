import { Link } from "react-router-dom";
import "./StaffDashboard.css";

// This screen used to show tick boxes (view_sales, edit_staff,
// manage_branches) that were saved on the staff record but checked nowhere:
// unticking one changed nothing, while an owner would reasonably believe it
// had locked something down. It says what access really is. Keep it in step
// with the backend: roleAccess.ts (who sees the money and staff details) and
// the requireStaffRole(...) checks in the routes (bookkeeping, inventory,
// staff, planner, timekeeping, customers, notifications, operator, decisions,
// cofounder, simulator, carPassport, wanted, bookingSettings, feedback).
const SEE_RULES: { what: string; who: string }[] = [
  {
    what: "The books, what each car cost, profit, and Wendy's money answers (profit, costs, revenue, money goals)",
    who: "Finance, managers and the owner",
  },
  { what: "Staff NI numbers, home addresses and private notes", who: "Managers and the owner" },
  { what: "The note on someone else's leave request, and everyone's past clock-in times", who: "Managers and the owner" },
  { what: "Wanted Cars (customers waiting for a car)", who: "Sales, managers and the owner" },
  { what: "Billing", who: "The owner" },
];

const CHANGE_RULES: { action: string; who: string }[] = [
  { action: "Record purchases, costs and sales in the books, or change what a car cost", who: "Finance, managers and the owner" },
  { action: "Remove a car from stock, or erase a customer", who: "Managers and the owner" },
  { action: "Edit staff records, the rota, leave and clock-in times, and send teammates notices", who: "Managers and the owner" },
  { action: "Approve Pilot Brain's work, log decisions, set goals", who: "Managers and the owner" },
  { action: "Change your booking hours", who: "Managers and the owner" },
  { action: "Publish Car Passports", who: "Sales, managers and the owner" },
  { action: "Invite people, change their role, billing, email and Pilot Brain's web access", who: "The owner" },
];

function RuleList({ rows }: { rows: { text: string; who: string }[] }) {
  return (
    <ul className="divide-y divide-white/10 rounded-xl border border-white/10 mb-5">
      {rows.map((r) => (
        <li key={r.text} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3">
          <span className="text-white text-sm">{r.text}</span>
          <span className="text-xs text-yellow-300 sm:text-right sm:shrink-0 sm:pl-4">{r.who}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PermissionsManager() {
  return (
    <div className="sn-panel sn-panel--full">
      <h1 className="sn-panel__title">Who can see what</h1>
      <p className="text-sm text-white/70 mb-4">
        Each person's job role is set when you invite them, and you can change it in{" "}
        <Link to="/dealer/settings" className="text-yellow-300 underline">Settings → Manage Team</Link>. The roles are
        owner, manager, finance, sales and general. The server enforces these rules, so hiding a screen is never the
        only thing standing in the way.
      </p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Who can see</h2>
      <RuleList rows={SEE_RULES.map((r) => ({ text: r.what, who: r.who }))} />

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">Who can change</h2>
      <RuleList rows={CHANGE_RULES.map((r) => ({ text: r.action, who: r.who }))} />

      <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm leading-relaxed text-white/90">
        <p className="font-semibold text-yellow-300">What everyone on your team can still do</p>
        <p className="mt-2">
          Whatever their role, anyone you invite can see your stock (with asking prices), leads, customers and their
          contact details, jobs, the rota and who is off, and who is in today. They can add and change stock details
          and asking prices, leads, customers and jobs, and remove leads and jobs. Only invite people you trust with
          that, and remove anyone who leaves straight away: they lose access on their very next click.
        </p>
      </div>
    </div>
  );
}
