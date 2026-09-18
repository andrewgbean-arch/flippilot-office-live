import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchOperatorActions,
  prepareOperatorActions,
  approveOperatorAction,
  rejectOperatorAction,
  rollbackOperatorAction,
  type OperatorAction,
} from "@/lib/pilotBrainApi";
import "@/staff/StaffDashboard.css";

const STATUS_STYLE: Record<string, string> = {
  prepared: "border-yellow-400/40 bg-yellow-500/10 text-yellow-200",
  completed: "border-green-400/40 bg-green-500/10 text-green-200",
  rejected: "border-white/20 bg-white/5 text-white/50",
  rolled_back: "border-orange-400/40 bg-orange-500/10 text-orange-200",
};

const STATUS_LABEL: Record<string, string> = {
  prepared: "Waiting for approval",
  completed: "Approved & done",
  rejected: "Rejected",
  rolled_back: "Rolled back",
};

// V6 (The Operator) — the Approval Centre / Operations Dashboard
// (Module 14). Pilot Brain never executes anything here on its own —
// every real write happens only after a real click on Approve, by a
// real manager or owner account (enforced server-side regardless of
// what this UI shows or hides).
export default function PilotBrainOperations() {
  const { user } = useAuth();
  const canApprove = user?.role === "owner" || user?.staffRole === "manager";

  const [actions, setActions] = useState<OperatorAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const result = await fetchOperatorActions();
    if (result.ok) setActions(result.actions);
    else setError(result.error ?? "Couldn't load actions");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePrepare() {
    setPreparing(true);
    setError(null);
    const result = await prepareOperatorActions();
    setPreparing(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't prepare work right now");
      return;
    }
    await load();
  }

  async function handleCommand(id: string, command: "approve" | "reject" | "rollback") {
    setActingOnId(id);
    setError(null);
    const fn = command === "approve" ? approveOperatorAction : command === "reject" ? rejectOperatorAction : rollbackOperatorAction;
    const result = await fn(id);
    setActingOnId(null);
    if (!result.ok) {
      setError(result.error ?? `Couldn't ${command} that action`);
      return;
    }
    await load();
  }

  const waiting = actions.filter(a => a.status === "prepared");
  const completed = actions.filter(a => a.status === "completed");
  const other = actions.filter(a => a.status === "rejected" || a.status === "rolled_back");

  return (
    <div className="sn-dashboard sn-dashboard--cosmic" style={{ minHeight: "100vh" }}>
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pilot Brain — Operations</h1>
          <p className="sn-hero__subtitle">
            Pilot Brain prepares real work here. Nothing happens until you approve it — you're always in control.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        <button
          onClick={handlePrepare}
          disabled={preparing}
          className="sn-btn sn-btn--gold"
          style={{ marginBottom: 20 }}
        >
          {preparing ? "Reviewing your business…" : "Prepare Today's Work"}
        </button>

        {error && <p style={{ color: "#ff8080", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        {!canApprove && (
          <p style={{ color: "#f5f7ff80", fontSize: 13, marginBottom: 16 }}>
            You can see what Pilot Brain has prepared, but approving or rejecting work needs a manager or owner account.
          </p>
        )}

        {loading ? (
          <p className="sn-empty">Loading…</p>
        ) : (
          <>
            <h2 style={{ color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>
              Waiting for approval {waiting.length > 0 && `(${waiting.length})`}
            </h2>
            {waiting.length === 0 ? (
              <p className="sn-empty" style={{ marginBottom: 24 }}>Nothing waiting — click "Prepare Today's Work" to have Pilot Brain look for real work.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {waiting.map(a => (
                  <div key={a.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ color: "#f5f7ff", fontWeight: 600 }}>{a.title}</div>
                        <div style={{ color: "#f5f7ff99", fontSize: 13, marginTop: 4 }}>{a.description}</div>
                        <div style={{ color: "#f5f7ff60", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{a.reason}</div>
                        {(a.type === "lead_followup" || a.type === "appointment_followup") && typeof a.payload.draftMessage === "string" && (
                          <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 13, color: "#f5f7ffcc", whiteSpace: "pre-wrap" }}>
                            {a.payload.draftMessage}
                          </div>
                        )}
                        {a.type === "rota_shift" && typeof a.payload.date === "string" && (
                          <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 13, color: "#f5f7ffcc" }}>
                            {String(a.payload.userName)} — {String(a.payload.date)}, {String(a.payload.start)}–{String(a.payload.end)}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs border ${STATUS_STYLE[a.status]}`} style={{ flexShrink: 0 }}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    {canApprove && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => handleCommand(a.id, "approve")}
                          disabled={actingOnId === a.id}
                          className="sn-btn sn-btn--gold"
                          style={{ fontSize: 13, padding: "6px 14px" }}
                        >
                          {actingOnId === a.id ? "Working…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleCommand(a.id, "reject")}
                          disabled={actingOnId === a.id}
                          className="sn-btn"
                          style={{ fontSize: 13, padding: "6px 14px" }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <>
                <h2 style={{ color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>Completed</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {completed.map(a => (
                    <div key={a.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <div style={{ color: "#f5f7ff", fontWeight: 600 }}>{a.title}</div>
                          <div style={{ color: "#f5f7ff70", fontSize: 12, marginTop: 4 }}>
                            Approved by {a.reviewedByName ?? "someone"} on {a.completedAt ? new Date(a.completedAt).toLocaleString() : ""}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs border ${STATUS_STYLE[a.status]}`} style={{ flexShrink: 0 }}>
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      {canApprove && (
                        <button
                          onClick={() => handleCommand(a.id, "rollback")}
                          disabled={actingOnId === a.id}
                          className="sn-btn"
                          style={{ fontSize: 12, padding: "5px 12px", marginTop: 10 }}
                        >
                          {actingOnId === a.id ? "Working…" : "Undo this"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {other.length > 0 && (
              <>
                <h2 style={{ color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>Audit Log</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {other.map(a => (
                    <div key={a.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, background: "rgba(0,0,0,0.1)", fontSize: 13 }}>
                      <span style={{ color: "#f5f7ff99" }}>{a.title}</span>{" "}
                      <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
