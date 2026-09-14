import { useState, useEffect } from "react";
import { usePlanner } from "@/context/PlannerContext";
import { useAuth } from "@/context/AuthContext";
import { canManageStaff } from "@/lib/permissions";
import { loadTeam } from "@/jobs/jobStorage.web";
import type { TeamMember } from "@/jobs/jobTypes";
import { WEEK_DAYS, WEEK_DAY_LABELS, type WorkPattern, type EmploymentType, type LeaveRequest } from "@/planner/plannerTypes";
import { getMonday, addDays, toDateKey, formatDayLabel, formatWeekRange, countLeaveWorkingDays } from "@/planner/dateUtils";
import { sendNotification } from "@/notifications/notificationStorage.web";
import ShiftEditModal from "./ShiftEditModal";
import LeaveRequestModal from "./LeaveRequestModal";
import "./StaffDashboard.css";

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
}

export default function RotaPlanner() {
  const { workPatterns, leave, shifts, loading, saveWorkPattern, decideLeave, withdrawLeave, generateWeek } =
    usePlanner();
  const { user } = useAuth();
  const isManager = canManageStaff(user);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [editingCell, setEditingCell] = useState<{ userId: string; userName: string; date: string } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTeam().then(setTeam);
  }, []);

  const weekDates = WEEK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekKeys = weekDates.map(toDateKey);

  function shiftFor(userId: string, dateKey: string) {
    return shifts.find(s => s.userId === userId && s.date === dateKey);
  }

  function leaveFor(userId: string, dateKey: string) {
    return leave.find(
      l => l.userId === userId && l.status === "approved" && l.startDate <= dateKey && dateKey <= l.endDate
    );
  }

  function weekTotalHours(userId: string): number {
    return weekKeys.reduce((total, dateKey) => {
      const shift = shiftFor(userId, dateKey);
      return shift ? total + shiftHours(shift.start, shift.end) : total;
    }, 0);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMessage(null);
    const { error, generatedCount } = await generateWeek(toDateKey(weekStart));
    setGenerating(false);
    setGenerateMessage(
      error ?? (generatedCount > 0 ? `Added ${generatedCount} shift${generatedCount === 1 ? "" : "s"}.` : "Nothing to add — every available day already has a shift or is covered by approved leave.")
    );
  }

  // Sends every staff member with at least one shift this week their
  // own full week's schedule in one notification — the "send the
  // compiled rota to staff" ask. Mid-week changes after this don't
  // need a re-publish: ShiftEditModal already notifies the specific
  // person the moment their shift is added, changed, or removed.
  async function handlePublish() {
    setPublishing(true);
    setPublishMessage(null);

    const recipientIds = Array.from(new Set(shifts.filter(s => weekKeys.includes(s.date)).map(s => s.userId)));
    let sentCount = 0;
    for (const memberId of recipientIds) {
      const member = team.find(m => m.id === memberId);
      if (!member) continue;
      const lines = weekKeys
        .map(dateKey => ({ dateKey, shift: shiftFor(memberId, dateKey) }))
        .filter((x): x is { dateKey: string; shift: NonNullable<typeof x.shift> } => Boolean(x.shift))
        .map(({ dateKey, shift }) => `${dateKey}: ${shift.start}–${shift.end}`);
      if (lines.length === 0) continue;

      const ok = await sendNotification({
        userId: memberId,
        title: `Rota published — ${formatWeekRange(weekStart)}`,
        message: lines.join(" | "),
        type: "info",
      });
      if (ok) sentCount++;
    }

    setPublishing(false);
    setPublishMessage(
      sentCount > 0
        ? `Sent this week's rota to ${sentCount} staff member${sentCount === 1 ? "" : "s"}.`
        : "No shifts scheduled this week yet — nothing to send."
    );
  }

  function handlePatternChange(member: TeamMember, changes: Partial<WorkPattern>) {
    const existing = workPatterns.find(p => p.userId === member.id);
    // 28 days/year (5.6 weeks) is the UK statutory minimum for a
    // 5-day-a-week worker — a sane starting default, always visible
    // and editable per person since real entitlement varies firm to
    // firm (and sometimes role to role).
    const base: WorkPattern = existing ?? {
      userId: member.id,
      userName: member.name,
      employmentType: "full_time",
      targetWeeklyHours: 0,
      availableDays: [],
      holidayEntitlementDays: 28,
    };
    saveWorkPattern({ ...base, ...changes });
  }

  const currentYear = new Date().getFullYear();

  // Holiday/sick balances are deliberately derived here, not a stored
  // aggregate — they're always computed fresh from the same
  // workPatterns + leave data already loaded, so they can never drift
  // out of sync with an edited entitlement or a newly-approved request.
  function leaveBalanceFor(member: TeamMember) {
    const pattern = workPatterns.find(p => p.userId === member.id);
    const entitlement = pattern?.holidayEntitlementDays ?? 28;
    const availableDays = pattern?.availableDays ?? [];

    const approvedThisYear = leave.filter(
      l => l.userId === member.id && l.status === "approved" && l.startDate.slice(0, 4) === String(currentYear)
    );

    const takenDays = approvedThisYear
      .filter(l => l.type === "holiday")
      .reduce((sum, l) => sum + countLeaveWorkingDays(l.startDate, l.endDate, availableDays), 0);

    const sickDays = approvedThisYear
      .filter(l => l.type === "sick")
      .reduce((sum, l) => sum + countLeaveWorkingDays(l.startDate, l.endDate, availableDays), 0);

    return { entitlement, takenDays, remainingDays: entitlement - takenDays, sickDays };
  }

  const pendingLeave = leave.filter(l => l.status === "pending");
  const decidedLeave = leave.filter(l => l.status !== "pending").sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  if (loading) {
    return (
      <div className="sn-dashboard sn-dashboard--cosmic">
        <p className="sn-empty">Loading planner…</p>
      </div>
    );
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Staff Planner</h1>
          <p className="sn-hero__subtitle">Rota • Shifts • Holiday &amp; Sick Leave</p>
        </div>
      </header>

      <main className="sn-grid">
        {/* WEEKLY ROTA */}
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">Weekly Rota</h2>
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
              {isManager && (
                <button className="sn-btn sn-btn--gold" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Generating…" : "Auto-Generate Week"}
                </button>
              )}
              {isManager && (
                <button className="sn-btn sn-btn--gold" onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Sending…" : "Publish Rota"}
                </button>
              )}
            </div>
          </div>
          {generateMessage && <p className="sn-timeclock__subtitle">{generateMessage}</p>}
          {publishMessage && <p className="sn-timeclock__subtitle">{publishMessage}</p>}

          {team.length === 0 ? (
            <p className="sn-empty">No team members yet — invite staff from Settings first.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sn-timeclock__table sn-rota-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    {weekDates.map(d => (
                      <th key={toDateKey(d)}>{formatDayLabel(d)}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map(member => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      {weekKeys.map(dateKey => {
                        const shift = shiftFor(member.id, dateKey);
                        const onLeave = leaveFor(member.id, dateKey);
                        const clickable = isManager && !onLeave;
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
                            onClick={() =>
                              clickable && setEditingCell({ userId: member.id, userName: member.name, date: dateKey })
                            }
                            style={clickable ? { cursor: "pointer" } : undefined}
                          >
                            {onLeave ? `On ${onLeave.type}` : shift ? `${shift.start}–${shift.end}${shift.autoGenerated ? " ✨" : ""}` : "—"}
                          </td>
                        );
                      })}
                      <td>{weekTotalHours(member.id).toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isManager && <p className="sn-timeclock__subtitle">Click any cell to set or edit a shift manually. ✨ marks an auto-generated shift.</p>}
        </section>

        {/* WORK PATTERNS */}
        {isManager && (
          <section className="sn-panel sn-panel--full">
            <h2 className="sn-panel__title">Work Patterns</h2>
            <p className="sn-timeclock__subtitle">Contracted hours and available days — used by Auto-Generate to build the rota.</p>
            <div style={{ overflowX: "auto" }}>
              <table className="sn-timeclock__table sn-rota-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Type</th>
                    <th>Target Hours / Week</th>
                    {WEEK_DAYS.map(day => (
                      <th key={day}>{WEEK_DAY_LABELS[day]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {team.map(member => {
                    const pattern = workPatterns.find(p => p.userId === member.id);
                    const employmentType: EmploymentType = pattern?.employmentType ?? "full_time";
                    const targetWeeklyHours = pattern?.targetWeeklyHours ?? 0;
                    const availableDays = pattern?.availableDays ?? [];
                    return (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>
                          <select
                            className="sn-input"
                            value={employmentType}
                            onChange={e => handlePatternChange(member, { employmentType: e.target.value as EmploymentType })}
                          >
                            <option value="full_time">Full-Time</option>
                            <option value="part_time">Part-Time</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={80}
                            className="sn-input"
                            style={{ width: 80 }}
                            defaultValue={targetWeeklyHours}
                            onBlur={e => handlePatternChange(member, { targetWeeklyHours: Number(e.target.value) || 0 })}
                          />
                        </td>
                        {WEEK_DAYS.map(day => (
                          <td key={day} style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={availableDays.includes(day)}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...availableDays, day]
                                  : availableDays.filter(d => d !== day);
                                handlePatternChange(member, { availableDays: next });
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* LEAVE BALANCES */}
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Leave Balances — {currentYear}</h2>
          <p className="sn-timeclock__subtitle">
            Taken/remaining count only a person's actual working days (from their Work Pattern above), not weekends
            or days off they'd never have worked anyway.
          </p>
          {team.length === 0 ? (
            <p className="sn-empty">No team members yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sn-timeclock__table sn-rota-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Entitlement (days/yr)</th>
                    <th>Taken</th>
                    <th>Remaining</th>
                    <th>Sick Days ({currentYear})</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map(member => {
                    const { entitlement, takenDays, remainingDays, sickDays } = leaveBalanceFor(member);
                    return (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>
                          {isManager ? (
                            <input
                              type="number"
                              min={0}
                              max={365}
                              className="sn-input"
                              style={{ width: 80 }}
                              defaultValue={entitlement}
                              onBlur={e =>
                                handlePatternChange(member, { holidayEntitlementDays: Number(e.target.value) || 0 })
                              }
                            />
                          ) : (
                            entitlement
                          )}
                        </td>
                        <td>{takenDays}</td>
                        <td style={remainingDays < 0 ? { color: "#ff8080" } : undefined}>{remainingDays}</td>
                        <td>{sickDays}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* LEAVE */}
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">Holiday &amp; Sick Leave</h2>
            <button className="sn-btn sn-btn--gold" onClick={() => setShowLeaveModal(true)}>
              Request Leave
            </button>
          </div>

          {pendingLeave.length > 0 && (
            <>
              <h3 className="sn-timeclock__subtitle">Pending Approval</h3>
              <div className="sn-leave-list">
                {pendingLeave.map(l => (
                  <LeaveRow
                    key={l.id}
                    entry={l}
                    isManager={isManager}
                    isOwn={l.userId === user?.id}
                    onDecide={decideLeave}
                    onWithdraw={withdrawLeave}
                  />
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
                <LeaveRow
                  key={l.id}
                  entry={l}
                  isManager={isManager}
                  isOwn={l.userId === user?.id}
                  onDecide={decideLeave}
                  onWithdraw={withdrawLeave}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {editingCell && (
        <ShiftEditModal
          userId={editingCell.userId}
          userName={editingCell.userName}
          date={editingCell.date}
          {...(shiftFor(editingCell.userId, editingCell.date)
            ? { existing: shiftFor(editingCell.userId, editingCell.date)! }
            : {})}
          onClose={() => setEditingCell(null)}
        />
      )}
      {showLeaveModal && <LeaveRequestModal onClose={() => setShowLeaveModal(false)} />}
    </div>
  );
}

function LeaveRow({
  entry,
  isManager,
  isOwn,
  onDecide,
  onWithdraw,
}: {
  entry: LeaveRequest;
  isManager: boolean;
  isOwn: boolean;
  onDecide: (id: string, status: "approved" | "declined") => Promise<string | null>;
  onWithdraw: (id: string) => Promise<string | null>;
}) {
  const badgeClass =
    entry.status === "approved"
      ? "sn-timeclock__badge--in"
      : entry.status === "declined"
        ? "sn-leave-badge--declined"
        : "sn-timeclock__badge--out";

  return (
    <div className="sn-recent-lead">
      <div>
        <div className="sn-recent-lead__name">
          {entry.userName} — {entry.type}
        </div>
        <div className="sn-recent-lead__status">
          {entry.startDate} to {entry.endDate}
          {entry.notes ? ` · ${entry.notes}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`sn-timeclock__badge ${badgeClass}`}>{entry.status}</span>
        {isManager && entry.status === "pending" && (
          <>
            <button className="sn-btn sn-btn--gold" onClick={() => onDecide(entry.id, "approved")}>
              Approve
            </button>
            <button className="sn-btn sn-btn--danger" onClick={() => onDecide(entry.id, "declined")}>
              Decline
            </button>
          </>
        )}
        {!isManager && isOwn && entry.status === "pending" && (
          <button className="sn-btn sn-btn--danger" onClick={() => onWithdraw(entry.id)}>
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
