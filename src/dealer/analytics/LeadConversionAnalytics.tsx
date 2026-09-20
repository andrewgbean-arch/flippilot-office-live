import { useLeads } from "@/context/LeadsContext";
import { SMALL_SAMPLE, conversionBySource, overallConversion } from "./leadFigures";
import "@/staff/StaffDashboard.css";

// "Avg Days to Convert" is gone from this page. It was the average age of the
// won leads TODAY (now minus the date each was created), so it grew by a day
// every day and said nothing about how long a sale takes; the lead record has no
// date for when it was won. It can come back once that date is stored.
export default function LeadConversionAnalytics() {
  const { leads } = useLeads();

  const sources = conversionBySource(leads);
  const overall = overallConversion(leads);

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Lead Conversion Analytics</h1>
          <p className="sn-hero__subtitle">
            Which lead sources your won leads came from.
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Won, as % of all leads" value={overall.rate} accent="gold" suffix="%" />
        <MetricCard label="Total Won" value={overall.won} accent="success" />
        <MetricCard label="Total Leads" value={overall.total} accent="primary" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">Conversion Rate by Source</h2>
          {sources.length === 0 ? (
            <p className="sn-empty">No lead data yet.</p>
          ) : (
            <>
              <p className="text-white/60 text-sm mb-3">
                Biggest sources first. A source with fewer than {SMALL_SAMPLE} leads is greyed out:
                too few to say whether it converts well.
              </p>
              <div className="sn-staff-grid">
                {sources.map(s => (
                  <div
                    key={s.source}
                    className="sn-staff-card"
                    style={s.smallSample ? { opacity: 0.55 } : undefined}
                  >
                    <div className="sn-staff-card__header">
                      <span className="sn-staff-card__name">{s.source}</span>
                      <span className="sn-staff-card__role">{s.rate}%</span>
                    </div>
                    <div className="sn-staff-card__branch">
                      {s.won} won / {s.total} lead{s.total === 1 ? "" : "s"}
                      {s.smallSample ? " (too few to compare)" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
