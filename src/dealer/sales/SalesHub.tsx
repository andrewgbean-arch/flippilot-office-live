import { useNavigate } from "react-router-dom";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function SalesHub() {
  const { leads } = useLeads();
  const navigate = useNavigate();

  const active = leads.filter(l => l.status !== "won" && l.status !== "lost");
  const won = leads.filter(l => l.status === "won");
  const hot = leads.filter(l => l.status === "negotiating" || l.status === "test_drive");

  const recent = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Sales Hub</h1>
          <p className="sn-hero__subtitle">
            Manage leads and review sales activity.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Total Leads" value={leads.length} accent="primary" />
        <MetricCard label="Active" value={active.length} accent="blue" />
        <MetricCard label="Hot Leads" value={hot.length} accent="gold" />
        <MetricCard label="Won" value={won.length} accent="success" />
      </section>

      <main className="sn-grid">

        <section className="sn-panel sn-panel--wide">
          <h2 className="sn-panel__title">Quick Actions</h2>
          <div className="sn-quick-actions">
            <button className="sn-btn sn-btn--gold" onClick={() => navigate("/dealer/sales/add")}>
              + Add Lead
            </button>
            <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/dealer/sales/leads")}>
              View All Leads
            </button>
            <button className="sn-btn sn-btn--ghost" onClick={() => navigate("/dealer/sales/pipeline")}>
              Sales Pipeline
            </button>
          </div>
        </section>

        <section className="sn-panel sn-panel--right">
          <h2 className="sn-panel__title">Recent Leads</h2>
          {recent.length === 0 ? (
            <p className="sn-empty">No leads yet.</p>
          ) : (
            <div className="sn-role-bars">
              {recent.map(lead => (
                <div
                  key={lead.id}
                  className="sn-recent-lead"
                  onClick={() => navigate(`/dealer/sales/leads/${lead.id}`)}
                >
                  <span className="sn-recent-lead__name">{lead.name}</span>
                  <span className="sn-recent-lead__status">{lead.status.replace("_", " ")}</span>
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