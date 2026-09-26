import { useNavigate } from "react-router-dom";
import { useLeads } from "@/context/LeadsContext";
import { useAuth } from "@/context/AuthContext";
import { canDeleteLeads } from "@/lib/permissions";
import type { Lead, LeadStatus } from "./leadTypes";
import "@/staff/StaffDashboard.css";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing Booked",
  test_drive: "Test Drive",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export default function LeadsDashboard() {
  const { leads, removeLead, saveError } = useLeads();
  const { user } = useAuth();
  // Removing a lead is for sales, managers and the owner.
  const mayRemove = canDeleteLeads(user);
  const navigate = useNavigate();

  const active = leads.filter(l => l.status !== "won" && l.status !== "lost");
  const won = leads.filter(l => l.status === "won");
  const lost = leads.filter(l => l.status === "lost");

  function handleOpen(id: string) {
    navigate(`/dealer/sales/leads/${id}`);
  }

  function handleRemove(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation();
    if (window.confirm(`Remove ${lead.name || "this lead"}? This can't be undone.`)) {
      void removeLead(lead.id);
    }
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">

      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Leads Dashboard</h1>
          <p className="sn-hero__subtitle">
            All customer leads • Sales Pipeline Overview
          </p>
        </div>
      </header>

      <section className="sn-metrics-row">
        <MetricCard label="Total Leads" value={leads.length} accent="primary" />
        <MetricCard label="Active" value={active.length} accent="blue" />
        <MetricCard label="Won" value={won.length} accent="success" />
        <MetricCard label="Lost" value={lost.length} accent="gold" />
      </section>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">All Leads</h2>
          {saveError && <p role="alert" style={{ color: "#fca5a5", fontSize: 13, margin: "0 0 12px" }}>{saveError}</p>}

          {leads.length === 0 ? (
            <p className="sn-empty">No leads yet. Add one to get started.</p>
          ) : (
            <div className="sn-staff-grid">
              {leads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onOpen={handleOpen}
                  onRemove={mayRemove ? handleRemove : undefined}
                />
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

function LeadCard({
  lead,
  onOpen,
  onRemove,
}: {
  lead: Lead;
  onOpen: (id: string) => void;
  onRemove: ((e: React.MouseEvent, lead: Lead) => void) | undefined;
}) {
  return (
    <article className="sn-staff-card">
      <div className="sn-staff-card__header">
        <span className="sn-staff-card__name">{lead.name}</span>
        <span className="sn-staff-card__role">{STATUS_LABELS[lead.status]}</span>
      </div>

      {lead.source && (
        <div className="sn-staff-card__branch">via {lead.source}</div>
      )}

      {lead.vehicleInterest && (
        <div className="sn-staff-card__branch">{lead.vehicleInterest}</div>
      )}

      <div className="sn-staff-card__actions">
        <button className="sn-staff-card__view" onClick={() => onOpen(lead.id)}>
          View / Edit
        </button>
        {onRemove && (
          <button className="sn-staff-card__remove" onClick={(e) => onRemove(e, lead)}>
            Remove
          </button>
        )}
      </div>
    </article>
  );
}