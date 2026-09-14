import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "@/context/JobsContext";
import { WEEK_DAYS } from "@/planner/plannerTypes";
import { getMonday, addDays, toDateKey, formatDayLabel, formatWeekRange } from "@/planner/dateUtils";
import type { Job } from "./jobTypes";
import AddJobModal from "./AddJobModal";
import "@/staff/StaffDashboard.css";

// Internal-only workshop scheduling — jobs already exist for the work
// itself; this just visualizes the ones with a real date/time/bay set
// (added via AddJobModal's "Workshop Booking" fields) as a real week
// calendar, and surfaces everything still unscheduled so nothing gets
// forgotten. Deliberately not customer-facing — nothing here creates
// or exposes a public booking page.
export default function WorkshopCalendar() {
  const { jobs, loading } = useJobs();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const weekDates = WEEK_DAYS.map((_, i) => addDays(weekStart, i));
  const weekKeys = weekDates.map(toDateKey);

  const scheduled = jobs.filter(j => j.scheduledDate);
  const unscheduled = jobs.filter(j => !j.scheduledDate && j.status !== "done");

  function jobsFor(dateKey: string): Job[] {
    return scheduled
      .filter(j => j.scheduledDate === dateKey)
      .sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""));
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Workshop Calendar</h1>
          <p className="sn-hero__subtitle">Repair &amp; recon jobs booked into the workshop this week.</p>
        </div>
      </header>

      <div style={{ marginBottom: 24 }}>
        <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/jobs")}>
          ← Back to Jobs Board
        </button>
      </div>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <h2 className="sn-panel__title">Week</h2>
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

          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(140px, 1fr))", gap: 10, overflowX: "auto" }}>
              {weekDates.map((d, i) => {
                const dateKey = weekKeys[i]!;
                const dayJobs = jobsFor(dateKey);
                return (
                  <div key={dateKey} className="sn-branch-card" style={{ minHeight: 120 }}>
                    <div className="sn-branch-card__name">{formatDayLabel(d)}</div>
                    {dayJobs.length === 0 ? (
                      <p className="sn-empty" style={{ fontSize: 12, marginTop: 8 }}>
                        Nothing booked
                      </p>
                    ) : (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {dayJobs.map(job => (
                          <button
                            key={job.id}
                            onClick={() => setEditingJob(job)}
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderRadius: 8,
                              background: "rgba(255,215,0,0.08)",
                              border: "1px solid rgba(255,215,0,0.25)",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#fdf6d0", fontWeight: 600 }}>
                              {job.scheduledStart ?? ""}
                              {job.scheduledEnd ? `–${job.scheduledEnd}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "#f5f7ff" }}>{job.title}</div>
                            {job.bay && (
                              <div style={{ fontSize: 11, color: "#a9b4ff" }}>{job.bay}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Unscheduled Jobs</h2>
          <p className="sn-timeclock__subtitle">Not yet given a workshop slot — click one to book it in.</p>
          {unscheduled.length === 0 ? (
            <p className="sn-empty">Everything open has a slot booked.</p>
          ) : (
            <div className="sn-leave-list">
              {unscheduled.map(job => (
                <div key={job.id} className="sn-recent-lead">
                  <div>
                    <div className="sn-recent-lead__name">{job.title}</div>
                    <div className="sn-recent-lead__status">
                      {job.vehicleLabel ?? "No vehicle"} · {job.assignedToName ?? "Unassigned"}
                    </div>
                  </div>
                  <button className="sn-btn sn-btn--gold" onClick={() => setEditingJob(job)}>
                    Schedule
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {editingJob && <AddJobModal existing={editingJob} onClose={() => setEditingJob(null)} />}
    </div>
  );
}
