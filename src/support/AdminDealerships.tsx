import { useEffect, useState } from "react";
import {
  fetchAdminDealerships,
  approveAdminDealership,
  deleteAdminDealership,
  type AdminDealershipSummary,
} from "@/lib/adminDealershipsApi";
import "@/staff/StaffDashboard.css";

// Server-side requirePlatformAdmin (dealership.ts) is the real gate —
// same as SupportInbox, this page assumes it's only reachable by
// someone who already passed that.
export default function AdminDealerships() {
  const [dealerships, setDealerships] = useState<AdminDealershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setApprovingId(id);
    const result = await approveAdminDealership(id);
    setApprovingId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not approve that dealership.");
      return;
    }
    setDealerships(prev => prev.map(d => (d.id === id ? { ...d, approvalStatus: "approved" } : d)));
  }

  async function load() {
    setLoading(true);
    const result = await fetchAdminDealerships();
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Could not load dealerships.");
      return;
    }
    setError(null);
    // Pending signups first — those are the ones needing a decision.
    setDealerships(
      [...result.dealerships].sort(
        (a, b) => Number(b.approvalStatus === "pending") - Number(a.approvalStatus === "pending")
      )
    );
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAdminDealership(id);
    setDeletingId(null);
    setPendingDeleteId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not delete that dealership.");
      return;
    }
    setDealerships(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Dealerships</h1>
          <p className="sn-hero__subtitle">
            Every dealership signed up to FlipPilot. New signups wait here for approval before they can use
            anything. Deleting one is permanent — it removes the account, every user under it, and all of its data.
          </p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : error ? (
            <p style={{ color: "#ff8080", fontSize: 13 }}>{error}</p>
          ) : dealerships.length === 0 ? (
            <p className="sn-empty">No dealerships yet.</p>
          ) : (
            <div className="sn-leave-list">
              {dealerships.map(d => (
                <div key={d.id} className="sn-recent-lead" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div className="sn-recent-lead__name">
                      {d.name}
                      {d.approvalStatus === "pending" && (
                        <span
                          className="sn-timeclock__badge sn-timeclock__badge--out"
                          style={{ marginLeft: 8, verticalAlign: "middle" }}
                        >
                          Awaiting approval
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#f5f7ff", fontSize: 13, margin: "4px 0" }}>
                      {d.userCount} user{d.userCount === 1 ? "" : "s"} · {d.subscriptionStatus}
                    </p>
                    <div className="sn-recent-lead__status">
                      Created {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {pendingDeleteId === d.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      <span style={{ color: "#ff8080", fontSize: 12 }}>Delete permanently?</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="sn-btn sn-btn--danger"
                          disabled={deletingId === d.id}
                          onClick={() => handleDelete(d.id)}
                        >
                          {deletingId === d.id ? "Deleting…" : "Yes, Delete"}
                        </button>
                        <button className="sn-btn sn-btn--ghost" onClick={() => setPendingDeleteId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      {d.approvalStatus === "pending" && (
                        <button
                          className="sn-btn sn-btn--gold"
                          disabled={approvingId === d.id}
                          onClick={() => handleApprove(d.id)}
                        >
                          {approvingId === d.id ? "Approving…" : "Approve"}
                        </button>
                      )}
                      <button className="sn-btn sn-btn--ghost" onClick={() => setPendingDeleteId(d.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
