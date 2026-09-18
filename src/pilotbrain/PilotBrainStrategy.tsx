import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchGoals,
  createGoal,
  deleteGoal,
  fetchExecutiveBriefing,
  type GoalProgress,
  type GoalMetric,
  type ExecutiveBriefing,
} from "@/lib/pilotBrainApi";
import "@/staff/StaffDashboard.css";

const METRIC_LABEL: Record<GoalMetric, string> = {
  revenue: "Revenue (£)",
  profit: "Profit (£)",
  stockCount: "Stock count",
  leadsAdded: "Leads added",
  salesCount: "Vehicles sold",
};

function healthColor(score: number): string {
  if (score >= 75) return "text-green-300";
  if (score >= 50) return "text-yellow-300";
  return "text-red-300";
}

// V7 (The Co-Founder) — real goal tracking and the Executive Briefing
// (Modules 2 and 9). Setting a goal is gated to owner/manager
// server-side; this page hides the controls for anyone else rather
// than showing something that'll just 403.
export default function PilotBrainStrategy() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.staffRole === "manager";

  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<GoalMetric>("revenue");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [goalsResult, briefingResult] = await Promise.all([fetchGoals(), fetchExecutiveBriefing()]);
    if (goalsResult.ok) setGoals(goalsResult.goals);
    if (briefingResult.ok && briefingResult.briefing) setBriefing(briefingResult.briefing);
    else setError(briefingResult.error ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateGoal() {
    const value = Number(targetValue);
    if (!value || value <= 0) {
      setError("Enter a real target value greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createGoal(metric, value, period, label.trim() || `${METRIC_LABEL[metric]} target: ${value}`);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't create that goal.");
      return;
    }
    setTargetValue("");
    setLabel("");
    await load();
  }

  async function handleDeleteGoal(id: string) {
    await deleteGoal(id);
    await load();
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic" style={{ minHeight: "100vh" }}>
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pilot Brain — Strategy</h1>
          <p className="sn-hero__subtitle">
            Real goals, real progress, and an executive-level view of where the business stands.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {error && <p style={{ color: "#ff8080", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <p className="sn-empty">Loading…</p>
        ) : (
          <>
            {briefing && (
              <div style={{ border: "1px solid rgba(255,215,0,0.3)", borderRadius: 14, padding: 18, marginBottom: 24, background: "rgba(0,0,0,0.25)" }}>
                <h2 style={{ color: "#ffd700", fontWeight: 700, marginBottom: 12 }}>Executive Briefing</h2>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <div style={{ color: "#f5f7ff60", fontSize: 12 }}>Strategic Health</div>
                    <div className={healthColor(briefing.strategicHealth.overall)} style={{ fontSize: 22, fontWeight: 700 }}>{briefing.strategicHealth.overall}/100</div>
                  </div>
                  <div>
                    <div style={{ color: "#f5f7ff60", fontSize: 12 }}>Business Health</div>
                    <div className={healthColor(briefing.businessHealth)} style={{ fontSize: 22, fontWeight: 700 }}>{briefing.businessHealth}/100</div>
                  </div>
                  <div>
                    <div style={{ color: "#f5f7ff60", fontSize: 12 }}>Market Health</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: briefing.marketHealth == null ? "#f5f7ff40" : undefined }} className={briefing.marketHealth != null ? healthColor(briefing.marketHealth) : ""}>
                      {briefing.marketHealth ?? "Not checked yet"}
                    </div>
                  </div>
                </div>

                {briefing.greatestOpportunity && (
                  <p style={{ color: "#a3e8b0", fontSize: 13, marginBottom: 6 }}>
                    <strong>Greatest opportunity:</strong> {briefing.greatestOpportunity.title}
                  </p>
                )}
                {briefing.greatestRisk && (
                  <p style={{ color: "#ffb08a", fontSize: 13, marginBottom: 6 }}>
                    <strong>Greatest risk:</strong> {briefing.greatestRisk.title}
                  </p>
                )}
                {briefing.recommendedFocus && (
                  <p style={{ color: "#f5f7ffcc", fontSize: 13 }}>
                    <strong>Recommended focus:</strong> {briefing.recommendedFocus.title}
                  </p>
                )}
                {!briefing.greatestOpportunity && !briefing.greatestRisk && !briefing.recommendedFocus && (
                  <p style={{ color: "#f5f7ff60", fontSize: 13 }}>Nothing urgent stands out right now — steady as she goes.</p>
                )}
              </div>
            )}

            <h2 style={{ color: "#ffd700", fontWeight: 700, marginBottom: 8 }}>Goals</h2>
            {goals.length === 0 ? (
              <p className="sn-empty" style={{ marginBottom: 20 }}>No real goals set yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {goals.map(g => (
                  <div key={g.goal.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 12, background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#f5f7ff" }}>{g.goal.label}</span>
                      <span style={{ color: g.onTrack ? "#a3e8b0" : "#ffb08a", fontSize: 13, fontWeight: 600 }}>
                        {g.percent}% {g.onTrack ? "· on track" : "· behind pace"}
                      </span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 6, marginTop: 8, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, g.percent)}%`, background: g.onTrack ? "#4ade80" : "#fb923c", height: "100%" }} />
                    </div>
                    <div style={{ color: "#f5f7ff50", fontSize: 12, marginTop: 6 }}>
                      {g.currentValue.toLocaleString()} of {g.goal.targetValue.toLocaleString()} — {g.goal.period}
                    </div>
                    {canManage && (
                      <button onClick={() => handleDeleteGoal(g.goal.id)} style={{ fontSize: 11, color: "#f5f7ff50", marginTop: 6, background: "none", border: "none", cursor: "pointer" }}>
                        Remove goal
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage ? (
              <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, background: "rgba(0,0,0,0.15)" }}>
                <h3 style={{ color: "#f5f7ff", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Set a new goal</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <select value={metric} onChange={e => setMetric(e.target.value as GoalMetric)} className="sn-input" style={{ flex: 1, minWidth: 140 }}>
                    {Object.entries(METRIC_LABEL).map(([value, l]) => <option key={value} value={value}>{l}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Target value"
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value)}
                    className="sn-input"
                    style={{ width: 140 }}
                  />
                  <select value={period} onChange={e => setPeriod(e.target.value as "monthly" | "quarterly")} className="sn-input" style={{ width: 130 }}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="sn-input"
                  style={{ width: "100%", marginBottom: 10 }}
                />
                <button onClick={handleCreateGoal} disabled={saving} className="sn-btn sn-btn--gold">
                  {saving ? "Saving…" : "Set Goal"}
                </button>
              </div>
            ) : (
              <p style={{ color: "#f5f7ff60", fontSize: 13 }}>Setting goals needs a manager or owner account.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
