import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";

export default function LeadConversionAnalytics() {
  const { leads } = useLeads();

  const bySource = leads.reduce((acc, l) => {
    const key = l.source || "Unknown";
    if (!acc[key]) acc[key] = { total: 0, won: 0 };
    acc[key].total += 1;
    if (l.status === "won") acc[key].won += 1;
    return acc;
  }, {} as Record<string, { total: number; won: number }>);

  const sourceConversion = Object.entries(bySource)
    .map(([source, data]) => ({
      source,
      total: data.total,
      won: data.won,
      rate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  const wonLeads = leads.filter(l => l.status === "won");
  const avgDaysToConvert = wonLeads.length > 0
    ? Math.round(
        wonLeads.reduce((sum, l) => {
          const days = (Date.now() - new Date(l.createdAt).getTime()) / 86400000;
          return sum + days;
        }, 0) / wonLeads.length
      )
    : 0;

  const overallRate = leads.length > 0
    ? Math.round((wonLeads.length / leads.length) * 100)
    : 0;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Lead Conversion Analytics</h1>
          <p className="sn-hero__subtitle">
            Which sources convert best, and how long it takes.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Overall Conversion" value={overallRate} accent="gold" suffix="%" />
        <MetricCard label="Avg Days to Convert" value={avgDaysToConvert} accent="blue" />
        <MetricCard label="Total Won" value={wonLeads.length} accent="success" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Conversion Rate by Source</h2>
          {sourceConversion.length === 0 ? (
            <p className="sn-empty">No lead data yet.</p>
          ) : (
            <div className="sn-staff-grid">
              {sourceConversion.map(s => (
                <div key={s.source} className="sn-staff-card">
                  <div className="sn-staff-card__header">
                    <span className="sn-staff-card__name">{s.source}</span>
                    <span className="sn-staff-card__role">{s.rate}%</span>
                  </div>
                  <div className="sn-staff-card__branch">
                    {s.won} won / {s.total} total
                  </div>
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