import { Link } from "react-router-dom";
import "./StaffDashboard.css";

// This screen used to show tick boxes (view_sales, edit_staff,
// manage_branches) that were saved on the staff record but checked nowhere:
// unticking one changed nothing, while an owner would reasonably believe it
// had locked something down. It now says what access really is today. Keep
// ROLE_RULES in step with the requireStaffRole(...) checks in the backend
// routes (bookkeeping, staff, planner, timekeeping, operator, decisions,
// cofounder, simulator, carPassport, wanted, bookingSettings, feedback).
const ROLE_RULES: { action: string; who: string }[] = [
  { action: "Record purchases, costs and sales in the books", who: "Finance, managers and the owner" },
  { action: "Edit staff records, the rota, leave and clock-in times", who: "Managers and the owner" },
  { action: "Approve Pilot Brain's work, log decisions, set goals", who: "Managers and the owner" },
  { action: "Change your booking hours", who: "Managers and the owner" },
  { action: "Publish Car Passports and see Wanted Cars", who: "Sales, managers and the owner" },
];

export default function PermissionsManager() {
  return (
    <div className="sn-panel sn-panel--full">
      <h1 className="sn-panel__title">Who can see what</h1>
      <p className="text-sm text-white/70 mb-4">
        Each person's job role is set when you invite them, and you can change it in{" "}
        <Link to="/dealer/settings" className="text-yellow-300 underline">Settings → Manage Team</Link>.
      </p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/60">What job roles control today</h2>
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10 mb-5">
        {ROLE_RULES.map((r) => (
          <li key={r.action} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3">
            <span className="text-white text-sm">{r.action}</span>
            <span className="text-xs text-yellow-300">{r.who}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm leading-relaxed text-white/90">
        <p className="font-semibold text-yellow-300">What everyone on your team can still do</p>
        <p className="mt-2">
          Whatever their role, anyone you invite can <strong>see</strong> everything: your stock, leads, customers, the
          books and staff details (such as addresses and NI numbers). They can also add and change stock, leads,
          customers and jobs. Only invite people you trust with that, and remove anyone who leaves straight away.
        </p>
        <p className="mt-2 text-white/70">
          Tighter access (for example, sales staff not seeing the books or staff records) is being built and will
          appear here when it is ready.
        </p>
      </div>

    </div>
  );
}
