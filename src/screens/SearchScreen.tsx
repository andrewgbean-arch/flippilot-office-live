import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/context/InventoryProvider";
import { useLeads } from "@/context/LeadsContext";
import "@/staff/StaffDashboard.css";
import { formatMoney } from "@/lib/formatMoney";

// Real search across the two things a dealer actually looks people/cars
// up by day to day — a vehicle's reg/make/model, or a lead's name/
// phone/email. Previously a dead /search link with nothing behind it.
export default function SearchScreen() {
  const { vehicles } = useInventory();
  const { leads } = useLeads();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matchedVehicles = q
    ? vehicles.filter(v =>
        [v.reg, v.make, v.model].some(field => field?.toLowerCase().includes(q))
      )
    : [];

  const matchedLeads = q
    ? leads.filter(l =>
        [l.name, l.phone, l.email].some(field => field?.toLowerCase().includes(q))
      )
    : [];

  const hasResults = matchedVehicles.length > 0 || matchedLeads.length > 0;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Search</h1>
          <p className="sn-hero__subtitle">Find a vehicle by reg, make or model — or a lead by name, phone or email.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Start typing a reg, make, model, name, phone, or email…"
            className="sn-input"
            style={{ width: "100%", padding: "12px 16px", fontSize: 16 }}
          />
        </section>

        {q && !hasResults && (
          <section className="sn-panel sn-panel--full">
            <p className="sn-empty">No vehicles or leads match "{query}".</p>
          </section>
        )}

        {matchedVehicles.length > 0 && (
          <section className="sn-panel sn-panel--full">
            <h2 className="sn-panel__title">Vehicles — {matchedVehicles.length}</h2>
            <div className="sn-staff-grid">
              {matchedVehicles.map(v => (
                <div
                  key={v.id}
                  className="sn-staff-card"
                  onClick={() => navigate(`/dealer/inventory/${v.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="sn-staff-card__header">
                    <span className="sn-staff-card__name">
                      {v.make} {v.model}
                    </span>
                    {v.reg && <span className="sn-staff-card__role">{v.reg}</span>}
                  </div>
                  {v.priceRetail ? (
                    <div className="sn-staff-card__branch">{formatMoney(v.priceRetail, { pence: "auto" })}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {matchedLeads.length > 0 && (
          <section className="sn-panel sn-panel--full">
            <h2 className="sn-panel__title">Leads — {matchedLeads.length}</h2>
            <div className="sn-staff-grid">
              {matchedLeads.map(l => (
                <div
                  key={l.id}
                  className="sn-staff-card"
                  onClick={() => navigate(`/dealer/sales/leads/${l.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="sn-staff-card__header">
                    <span className="sn-staff-card__name">{l.name}</span>
                    <span className="sn-staff-card__role">{l.status.replace("_", " ")}</span>
                  </div>
                  <div className="sn-staff-card__branch">{l.phone ?? l.email ?? "No contact given"}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
