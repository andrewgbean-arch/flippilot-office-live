import { useState } from "react";
import { usePlanner } from "@/context/PlannerContext";
import { useAuth } from "@/context/AuthContext";
import { WEEK_DAYS, type LeaveRequest } from "@/planner/plannerTypes";
import { getMonday, addDays, toDateKey, formatDayLabel, formatWeekRange, countLeaveWorkingDays } from "@/planner/dateUtils";
import LeaveRequestModal from "./LeaveRequestModal";
import "./StaffDashboard.css";

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
}

// Self-service view for any staff member: their own upcoming shifts and
// leave balance, without the manager-only rota-editing/work-pattern
// tools RotaPlanner.tsx has. Deliberately read-mostly — the one write
// action is requesting/withdrawing leave, both already scoped to the
// caller's own account server-side (see planner.ts).
export default function MyRota() {
  const { workPatterns, leave, shifts, loading, withdrawLeave } = usePlanner();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const weekDates = WEEK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekKeys = weekDates.map(toDateKey);

  const myShifts = shifts.filter(s => s.userId === user?.id);
  const myLeave = leave.filter(l => l.userId === user?.id);
  const pattern = workPatterns.find(p => p.userId === user?.id);

  function shiftFor(dateKey: string) {
    return myShifts.find(s => s.date === dateKey);
  }
  function leaveFor(dateKey: string) {
    return myLeave.find(l => l.status === "approved" && l.startDate <= dateKey && dateKey <= l.endDate);
  }
  const weekTotalHours = weekKeys.reduce((total, dateKey) => {
    const shift = shiftFor(dateKey);
    return shift ? total + shiftHours(shift.start, shift.end) : total;
  }, 0);

  const currentYear = new Date().getFullYear();
  const entitlement = pattern?.holidayEntitlementDays ?? 28;
  const availableDays = pattern?.availableDays ?? [];
  const approvedThisYear = myLeave.filter(l => l.status === "approved" && l.startDate.slice(0, 4) === String(currentYear));
  const takenDays = approvedThisYear
    .filter(l => l.type === "holiday")
    .reduce((sum, l) => sum + countLeaveWorkingDays(l.startDate, l.endDate, availableDays), 0);
  const sickDays = approvedThisYear
    .filter(l => l.type === "sick")
    .reduce((sum, l) => sum + countLeaveWorkingDays(l.startDate, l.endDate, availableDays), 0);
  const remainingDays = entitlement - takenDays;

  const pendingLeave = myLeave.filter(l => l.status === "pending");
  const decidedLeave = myLeave.filter(l => l.status !== "pending").sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  if (loading) {
    return (
      <div className="sn-dashboard sn-dashboard--cosmic">
        <p className="sn-empty">Loading your rota…</p>
      </div>
    );
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">My Rota</h1>
          <p className="sn-hero__subtitle">Your shifts, holiday remaining, and leave requests.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">This Week</h2>
            <div className="sn-rota-week-nav">
              <button className="sn-btn sn-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                ← Prev
              </button>
              <span className="sn-rota-week-label">{formatWeekRange(weekStart)}</span>
              <button className="sn-btn sn-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Next →
              </button>
              <button className="sn-btn sn-btn--ghost" onClick={() => setWeekStart(getMonday(new Date()))}>
                This Week
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="sn-timeclock__table sn-rota-table">
              <thead>
                <tr>
                  {weekDates.map(d => (
                    <th key={toDateKey(d)}>{formatDayLabel(d)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {weekKeys.map(dateKey => {
                    const shift = shiftFor(dateKey);
                    const onLeave = leaveFor(dateKey);
                    return (
                      <td
                        key={dateKey}
                        className={
                          onLeave
                            ? "sn-rota-cell sn-rota-cell--leave"
                            : shift
                              ? "sn-rota-cell sn-rota-cell--shift"
                              : "sn-rota-cell sn-rota-cell--empty"
                        }
                      >
                        {onLeave ? `On ${onLeave.type}` : shift ? `${shift.start}–${shift.end}` : "—"}
                      </td>
                    );
                  })}
                  <td>{weekTotalHours.toFixed(1)}h</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Leave Balance — {currentYear}</h2>
          {!pattern && (
            <p className="sn-timeclock__subtitle">
              No work pattern set yet — a manager needs to set one on the Rota Planner before this can count your
              actual working days accurately.
            </p>
          )}
          <div className="sn-rota-header" style={{ gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="sn-timeclock__subtitle">Entitlement</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#e6ebff" }}>{entitlement}</div>
            </div>
            <div>
              <div className="sn-timeclock__subtitle">Taken</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#e6ebff" }}>{takenDays}</div>
            </div>
            <div>
              <div className="sn-timeclock__subtitle">Remaining</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: remainingDays < 0 ? "#ff8080" : "#e6ebff" }}>
                {remainingDays}
              </div>
            </div>
            <div>
              <div className="sn-timeclock__subtitle">Sick Days</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#e6ebff" }}>{sickDays}</div>
            </div>
          </div>
        </section>

        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">My Leave Requests</h2>
            <button className="sn-btn sn-btn--gold" onClick={() => setShowLeaveModal(true)}>
              Request Leave
            </button>
          </div>

          {pendingLeave.length > 0 && (
            <>
              <h3 className="sn-timeclock__subtitle">Pending Approval</h3>
              <div className="sn-leave-list">
                {pendingLeave.map(l => (
                  <MyLeaveRow key={l.id} entry={l} onWithdraw={withdrawLeave} />
                ))}
              </div>
            </>
          )}

          <h3 className="sn-timeclock__subtitle">History</h3>
          {decidedLeave.length === 0 ? (
            <p className="sn-empty">No leave decided yet.</p>
          ) : (
            <div className="sn-leave-list">
              {decidedLeave.map(l => (
                <MyLeaveRow key={l.id} entry={l} onWithdraw={withdrawLeave} />
              ))}
            </div>
          )}
        </section>
      </main>

      {showLeaveModal && <LeaveRequestModal onClose={() => setShowLeaveModal(false)} />}
    </div>
  );
}

function MyLeaveRow({ entry, onWithdraw }: { entry: LeaveRequest; onWithdraw: (id: string) => Promise<string | null> }) {
  const badgeClass =
    entry.status === "approved"
      ? "sn-timeclock__badge--in"
      : entry.status === "declined"
        ? "sn-leave-badge--declined"
        : "sn-timeclock__badge--out";

  return (
    <div className="sn-recent-lead">
      <div>
        <div className="sn-recent-lead__name">{entry.type}</div>
        <div className="sn-recent-lead__status">
          {entry.startDate} to {entry.endDate}
          {entry.notes ? ` · ${entry.notes}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`sn-timeclock__badge ${badgeClass}`}>{entry.status}</span>
        {entry.status === "pending" && (
          <button className="sn-btn sn-btn--danger" onClick={() => onWithdraw(entry.id)}>
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
