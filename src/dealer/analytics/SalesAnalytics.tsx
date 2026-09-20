import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function SalesAnalytics() {
  const { leads } = useLeads();

  const total = leads.length;
  const won = leads.filter(l => l.status === "won").length;
  const lost = leads.filter(l => l.status === "lost").length;
  const active = total - won - lost;

  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sourceCounts = leads.reduce((acc, l) => {
    const key = l.source || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Sales Analytics</h1>
          <p className="sn-hero__subtitle">
            Lead pipeline performance and conversion insights.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Total Leads" value={total} accent="primary" />
        <MetricCard label="Active" value={active} accent="blue" />
        <MetricCard label="Won" value={won} accent="success" />
        <MetricCard label="Conversion Rate" value={conversionRate} accent="gold" suffix="%" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--wide">
          <h2 className="sn-panel__title">Status Breakdown</h2>
          {total === 0 ? (
            <p className="sn-empty">No lead data yet.</p>
          ) : (
            <div className="sn-role-bars">
              {Object.entries(statusCounts).map(([status, count]) => (
                <RoleBar key={status} label={status.replace("_", " ")} count={count} total={total} />
              ))}
            </div>
          )}
        </section>

        <section className="sn-panel sn-panel--right">
          <h2 className="sn-panel__title">Lead Sources</h2>
          {topSources.length === 0 ? (
            <p className="sn-empty">No source data yet.</p>
          ) : (
            <div className="sn-branch-grid">
              {topSources.map(([source, count]) => (
                <div key={source} className="sn-branch-card">
                  <div className="sn-branch-card__name">{source}</div>
                  <div className="sn-branch-card__count">{count} leads</div>
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
  suffix,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success" | "gold" | "blue" | "purple";
  suffix?: string;
}) {
  return (
    <div className={`sn-metric sn-metric--${accent ?? "primary"}`}>
      <div className="sn-metric__value">{value}{suffix}</div>
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