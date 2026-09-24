import { useStaff } from "@/staff/StaffContext";
import { averageDaysOnApp } from "./staffFigures";
import "@/staff/StaffDashboard.css";

export default function StaffAnalytics() {
  const { staff } = useStaff();

  const total = staff.length;
  const active = staff.filter(s => s.active).length;

  const roleCounts = staff.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const branchCounts = staff.reduce((acc, s) => {
    if (!s.branch) return acc;
    acc[s.branch] = (acc[s.branch] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Was "Avg Tenure", but the date behind it is when the record was created in
  // FlipPilot, not when the person started work (see staffFigures.ts).
  const avgDaysOnApp = averageDaysOnApp(staff, new Date());

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Staff Analytics</h1>
          <p className="sn-hero__subtitle">
            Your team by role and branch.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Total Staff" value={total} accent="primary" />
        <MetricCard label="Active" value={active} accent="success" />
        <MetricCard label="Avg Days Since Added" value={avgDaysOnApp} accent="gold" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--wide">
          <h2 className="sn-panel__title">Role Distribution</h2>
          {total === 0 ? (
            <p className="sn-empty">No staff added yet.</p>
          ) : (
            <div className="sn-role-bars">
              {Object.entries(roleCounts).map(([role, count]) => (
                <RoleBar key={role} label={role} count={count} total={total} />
              ))}
            </div>
          )}
        </section>

        <section className="sn-panel sn-panel--right">
          <h2 className="sn-panel__title">By Branch</h2>
          {Object.keys(branchCounts).length === 0 ? (
            <p className="sn-empty">No branch data yet.</p>
          ) : (
            <div className="sn-branch-grid">
              {Object.entries(branchCounts).map(([branch, count]) => (
                <div key={branch} className="sn-branch-card">
                  <div className="sn-branch-card__name">{branch}</div>
                  <div className="sn-branch-card__count">{count} staff</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{value === null ? "–" : value}</div>
      <div className="sn-metric__label">{label}</div>
    </div>
  );
}

function RoleBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="sn-role">
      <span className="sn-role__label">{label}</span>
      <div className="sn-role__bar">
        <div className="sn-role__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="sn-role__pct">{pct}%</span>
    </div>
  );
}