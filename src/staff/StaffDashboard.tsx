import { useNavigate } from "react-router-dom";
import { useStaff } from "./StaffContext";
import type { StaffRecord } from "./staffTypes";
import { getWorkforceIntelligence } from "@/core/superbrain/SuperBrainEngine";
import TimeClockPanel from "./TimeClockPanel";
import "./StaffDashboard.css";

interface Props {
  brain?: any;
}

export function StaffDashboard({}: Props) {
  const { staff, removeStaff } = useStaff();
  const navigate = useNavigate();

  // Local staff metrics
  const active = staff.filter(s => s.active);
  const managers = staff.filter(s => s.role === "manager");
  const sales = staff.filter(s => s.role === "sales");
  const trainees = staff.filter(s => s.role === "trainee");
  const cleaners = staff.filter(s => s.role === "cleaner");
  const officeStaff = staff.filter(s => s.role === "office");
  const motTesters = staff.filter(s => s.role === "mot_tester");

  // Supernova V22 Workforce Intelligence — computed live from real staff
  // data (this used to come from a `brain` prop that nothing ever
  // populated, so it always showed hardcoded fallback numbers).
  const { performanceScore, attritionRisk, productivityIndex, insight } =
    getWorkforceIntelligence(staff);

  function handleOpen(id: string) {
    navigate(`/dealer/staff/${id}`);
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      {/* HERO */}
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Staff Command Center</h1>
          <p className="sn-hero__subtitle">
            Workforce Intelligence • Dealer Operations • Live Status
          </p>
        </div>
      </header>

      <div style={{ marginBottom: 24 }}>
        <button className="sn-btn sn-btn--gold" onClick={() => navigate("/dealer/staff/planner")}>
          Open Rota Planner →
        </button>
      </div>

      {/* METRICS STRIP */}
      <section className="sn-metrics-row">
        <MetricCard label="Total Staff" value={staff.length} accent="primary" />
        <MetricCard label="Active Staff" value={active.length} accent="success" />
        <MetricCard label="Managers" value={managers.length} accent="gold" />
        <MetricCard label="Sales Team" value={sales.length} accent="blue" />
        <MetricCard label="Trainees" value={trainees.length} accent="purple" />

        {/* NEW V13 METRICS */}
        <MetricCard label="Performance Score" value={performanceScore} accent="gold" />
        <MetricCard label="Productivity Index" value={productivityIndex} accent="blue" />
      </section>

      {/* GRID LAYOUT */}
      <main className="sn-grid">

        {/* TIME CLOCK */}
        <TimeClockPanel />

        {/* ROLE DISTRIBUTION */}
        <section className="sn-panel sn-panel--wide">
          <h2 className="sn-panel__title">Role Distribution</h2>
          <div className="sn-role-bars">
            <RoleBar label="Managers" count={managers.length} total={staff.length} />
            <RoleBar label="Sales" count={sales.length} total={staff.length} />
            <RoleBar label="Trainees" count={trainees.length} total={staff.length} />
            <RoleBar label="Cleaners" count={cleaners.length} total={staff.length} />
            <RoleBar label="Office Staff" count={officeStaff.length} total={staff.length} />
            <RoleBar label="MOT Testers" count={motTesters.length} total={staff.length} />
          </div>
        </section>

        {/* BRANCH PERFORMANCE */}
        <section className="sn-panel sn-panel--right">
          <h2 className="sn-panel__title">Branch Performance</h2>
          <BranchPerformance staff={staff} />
        </section>

        {/* ACTIVE STAFF */}
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Active Staff</h2>
          <div className="sn-staff-grid">
            {active.map(s => (
              <StaffCard key={s.id} staff={s} onRemove={removeStaff} onOpen={handleOpen} />
            ))}
          </div>
        </section>

        {/* ACTIVITY HEATMAP */}
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Activity Heatmap</h2>
          <ActivityHeatmap staff={staff} />
        </section>

        {/* NEW V13 AI PANEL */}
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">AI Workforce Intelligence</h2>
          <div className="sn-ai-panel">
            <p className="sn-ai-line">
              <strong>Attrition Risk:</strong> {attritionRisk}
            </p>
            <p className="sn-ai-line">
              <strong>AI Insight:</strong> {insight}
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}

/* ---------------------------
   METRIC CARD
---------------------------- */

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{value}</div>
      <div className="sn-metric__label">{label}</div>
    </div>
  );
}

/* ---------------------------
   ROLE BAR
---------------------------- */

function RoleBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <div className="sn-role">
      <span className="sn-role__label">{label}</span>
      <div className="sn-role__bar">
        <div
          className="sn-role__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sn-role__pct">{pct}%</span>
    </div>
  );
}

/* ---------------------------
   STAFF CARD
---------------------------- */

function StaffCard({
  staff,
  onRemove,
  onOpen,
}: {
  staff: StaffRecord;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (window.confirm(`Remove ${staff.name || "this staff member"}? This can't be undone.`)) {
      onRemove(staff.id);
    }
  }

  return (
    <article className="sn-staff-card">
      <div className="sn-staff-card__header">
        <span className="sn-staff-card__name">{staff.name}</span>
        <span className="sn-staff-card__role">{staff.role}</span>
      </div>

      {staff.branch && (
        <div className="sn-staff-card__branch">@ {staff.branch}</div>
      )}

      <div className="sn-staff-card__status sn-staff-card__status--active">
        Active
      </div>

      <div className="sn-staff-card__actions">
        <button
          className="sn-staff-card__view"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(staff.id);
          }}
        >
          View / Edit
        </button>
        <button
          className="sn-staff-card__remove"
          onClick={handleRemoveClick}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

/* ---------------------------
   BRANCH PERFORMANCE
---------------------------- */

function BranchPerformance({ staff }: { staff: StaffRecord[] }) {
  const branches: Record<string, number> = {};

  staff.forEach(s => {
    if (!s.branch) return;
    branches[s.branch] = (branches[s.branch] || 0) + 1;
  });

  const entries = Object.entries(branches);

  if (entries.length === 0) {
    return <p className="sn-empty">No branch data yet.</p>;
  }

  return (
    <div className="sn-branch-grid">
      {entries.map(([branch, count]) => (
        <div key={branch} className="sn-branch-card">
          <div className="sn-branch-card__name">{branch}</div>
          <div className="sn-branch-card__count">{count} staff</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------
   ACTIVITY HEATMAP
---------------------------- */

function ActivityHeatmap({ staff }: { staff: StaffRecord[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="sn-heatmap">
      {days.map(day => (
        <div key={day} className="sn-heatmap__cell">
          <span className="sn-heatmap__label">{day}</span>
          <div className="sn-heatmap__level" />
        </div>
      ))}
    </div>
  );
}