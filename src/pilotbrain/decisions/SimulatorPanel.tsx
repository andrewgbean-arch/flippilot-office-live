import { useId, useState, type CSSProperties } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Confidence, Figure, FigureKind, SimAssumption, SimScenario, SimulationSnapshot } from "@/lib/decisionTypes";
import {
  NO_ACCESS_MESSAGE,
  SIM_DEFAULT_CUT,
  SIM_DEFAULT_DAYS,
  attachSimulation,
  canUseSimulator,
  runSimulation,
  type SimulationPreview,
  type SimulationRequest,
} from "@/lib/simulatorApi";
import type { DecisionPanelProps } from "./decisionPanelProps";
import {
  BANNER_TITLE,
  CONFIDENCE_LABEL,
  EMPTY_FIELDS,
  KIND_HELP,
  KIND_LABEL,
  SOURCE_LABEL,
  bannerBody,
  buildRequest,
  formatAssumptionValue,
  formatFigureValue,
  formatRunDate,
  saveAvailability,
  type SimulatorFields,
} from "./simulatorFormat";
import "@/staff/StaffDashboard.css";

// The Simulator (Pilot Brain V8). Boss picks an idea, changes its few numbers and
// runs it. What comes back is ARITHMETIC on the dealership's own history, printed
// with the assumptions beside it, never a forecast. Every figure says whether it is
// known, inferred, predicted or unknown. Running one changes nothing in the
// business; "Save to this decision" only adds the result to the decision record.
// Boss decides.

const COLOR = {
  text: "#f5f7ff",
  muted: "#f5f7ffb3",
  faint: "#f5f7ff80",
  gold: "#ffd700",
  border: "rgba(255,255,255,0.12)",
  card: "rgba(0,0,0,0.25)",
  error: "#ff8080",
  warn: "#ffd98a",
};

const CHIP_BASE: CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.6,
  padding: "0 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const KIND_STYLE: Record<FigureKind, CSSProperties> = {
  known: { color: "#a3e8b0", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.45)" },
  inferred: { color: "#a5c8ff", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.45)" },
  predicted: { color: "#ffd98a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.45)" },
  unknown: { color: "#f5f7ffb3", background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,255,255,0.4)" },
};

const CONFIDENCE_STYLE: Record<Confidence, CSSProperties> = {
  low: { color: "#ffb08a", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.5)" },
  medium: { color: "#ffd98a", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.5)" },
  high: { color: "#a3e8b0", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.5)" },
};

/* ------------------------------------------------------------------ */
/* Showing a simulation (used for a fresh run and for saved ones)       */
/* ------------------------------------------------------------------ */

export function KindChip({ kind }: { kind: FigureKind }) {
  return (
    <span data-chip="kind" data-kind={kind} title={KIND_HELP[kind]} style={{ ...CHIP_BASE, ...KIND_STYLE[kind] }}>
      {KIND_LABEL[kind]}
    </span>
  );
}

function SourceChip({ source }: { source: SimAssumption["source"] }) {
  return (
    <span data-chip="source" data-source={source} style={{ ...CHIP_BASE, color: COLOR.muted, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR.border}` }}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

// One number with its label, its kind and where it came from. A figure that is
// missing says "Unknown" and why: it is never shown as 0 or left blank.
export function FigureRow({ figure }: { figure: Figure }) {
  const unknown = figure.value === null;
  return (
    <li data-figure={figure.label} style={{ listStyle: "none", padding: "10px 0", borderTop: `1px solid ${COLOR.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: COLOR.muted, fontSize: 13 }}>{figure.label}</span>
        <KindChip kind={figure.kind} />
      </div>
      <div
        data-value={unknown ? "unknown" : "known"}
        style={{ color: unknown ? COLOR.faint : COLOR.text, fontStyle: unknown ? "italic" : "normal", fontWeight: 700, fontSize: 20, marginTop: 2 }}
      >
        {formatFigureValue(figure)}
      </div>
      <div style={{ color: unknown ? COLOR.warn : COLOR.faint, fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{figure.basis}</div>
    </li>
  );
}

export function ScenarioCard({ scenario }: { scenario: SimScenario }) {
  return (
    <div data-scenario={scenario.key} style={{ border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: "12px 14px", background: COLOR.card, minWidth: 0 }}>
      <h5 style={{ margin: 0, color: COLOR.gold, fontSize: 15, fontWeight: 700 }}>{scenario.label}</h5>
      <ul style={{ margin: "6px 0 0", padding: 0 }}>
        {scenario.figures.map(f => (
          <FigureRow key={f.label} figure={f} />
        ))}
      </ul>
    </div>
  );
}

export function AssumptionsList({ assumptions }: { assumptions: SimAssumption[] }) {
  return (
    <ul data-part="assumptions" style={{ margin: 0, padding: 0 }}>
      {assumptions.map(a => (
        <li key={a.key} data-assumption={a.key} style={{ listStyle: "none", padding: "8px 0", borderTop: `1px solid ${COLOR.border}` }}>
          <div style={{ color: COLOR.muted, fontSize: 13 }}>{a.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            <span style={{ color: a.value === null ? COLOR.faint : COLOR.text, fontStyle: a.value === null ? "italic" : "normal", fontWeight: 600 }}>{formatAssumptionValue(a)}</span>
            <SourceChip source={a.source} />
            <KindChip kind={a.kind} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span data-part="confidence-badge" style={{ ...CHIP_BASE, fontSize: 12, padding: "1px 10px", ...CONFIDENCE_STYLE[confidence] }}>
      Confidence: {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

export function ConfidenceReasons({ confidence, reasons }: { confidence: Confidence; reasons: string[] }) {
  return (
    <div data-part="confidence">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ConfidenceBadge confidence={confidence} />
        <span style={{ color: COLOR.faint, fontSize: 12 }}>A word with reasons, never a percentage.</span>
      </div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: COLOR.muted, fontSize: 13, lineHeight: 1.5 }}>
        {reasons.map(r => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

const SECTION_HEADING: CSSProperties = { margin: "18px 0 6px", color: COLOR.text, fontSize: 14, fontWeight: 700 };

export function SimulationView({ simulation }: { simulation: SimulationPreview | SimulationSnapshot }) {
  return (
    <div data-part="simulation">
      <div
        role="note"
        data-part="banner"
        style={{ border: "1px solid rgba(255,215,0,0.45)", background: "rgba(255,215,0,0.08)", borderRadius: 10, padding: "10px 12px" }}
      >
        <strong style={{ color: COLOR.gold, fontSize: 15 }}>{BANNER_TITLE}</strong>
        <p style={{ margin: "4px 0 0", color: COLOR.muted, fontSize: 13, lineHeight: 1.5 }}>{bannerBody(simulation.note)}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <h4 style={{ margin: 0, color: COLOR.text, fontSize: 17, fontWeight: 700 }}>{simulation.title}</h4>
        <ConfidenceBadge confidence={simulation.confidence} />
      </div>

      <h4 style={SECTION_HEADING}>The scenarios side by side</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
        {simulation.scenarios.map(s => (
          <ScenarioCard key={s.key} scenario={s} />
        ))}
      </div>

      <h4 style={SECTION_HEADING}>What this is built on</h4>
      <AssumptionsList assumptions={simulation.assumptions} />

      <h4 style={SECTION_HEADING}>How sure is it?</h4>
      <ConfidenceReasons confidence={simulation.confidence} reasons={simulation.confidenceReasons} />
    </div>
  );
}

export function SavedSimulations({ simulations }: { simulations: SimulationSnapshot[] }) {
  return (
    <div data-part="saved">
      <h4 style={SECTION_HEADING}>Saved with this decision</h4>
      {simulations.length === 0 ? (
        <p style={{ color: COLOR.faint, fontSize: 13, margin: 0 }}>Nothing saved yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {simulations.map(s => (
            <details key={s.id} style={{ border: `1px solid ${COLOR.border}`, borderRadius: 10, padding: "8px 12px", background: COLOR.card }}>
              <summary style={{ cursor: "pointer", color: COLOR.text, fontSize: 14 }}>
                {s.title}
                <span style={{ color: COLOR.faint, fontSize: 12 }}> · run {formatRunDate(s.ranAt)} · confidence {CONFIDENCE_LABEL[s.confidence].toLowerCase()}</span>
              </summary>
              <div style={{ marginTop: 10 }}>
                <SimulationView simulation={s} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoAccessNotice() {
  return (
    <div role="note" data-part="no-access" style={{ border: `1px solid ${COLOR.border}`, borderRadius: 12, padding: 14, background: COLOR.card, color: COLOR.muted, fontSize: 14 }}>
      {NO_ACCESS_MESSAGE}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                            */
/* ------------------------------------------------------------------ */

const KIND_CHOICES: { kind: SimulationRequest["kind"]; label: string }[] = [
  { kind: "stock_investment", label: "Put more money into stock" },
  { kind: "price_cut_aged_stock", label: "Cut the price of older cars" },
];

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "8px 12px",
  fontSize: 16, // 16px stops phones zooming in when the box is tapped
  color: COLOR.text,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${COLOR.border}`,
  borderRadius: 10,
};

function Field({ id, label, hint, value, placeholder, onChange }: { id: string; label: string; hint?: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label htmlFor={id} style={{ display: "block", color: COLOR.text, fontSize: 14, marginBottom: 4 }}>
        {label}
      </label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" maxLength={12} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={INPUT_STYLE} />
      {hint && <div style={{ color: COLOR.faint, fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// Saving a result to the decision. Only offered while the decision is open and has
// room; otherwise it says why in plain words (the server refuses it too).
export function SaveBar({
  availability,
  saved,
  saving,
  disabled,
  onSave,
}: {
  availability: ReturnType<typeof saveAvailability>;
  saved: boolean;
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  return (
    <div data-part="save" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {availability.can ? (
        saved ? (
          <span style={{ color: "#a3e8b0", fontSize: 14 }}>Saved to this decision.</span>
        ) : (
          <button type="button" className="sn-btn sn-btn--gold" onClick={onSave} disabled={saving || disabled} style={{ minHeight: 44 }}>
            {saving ? "Saving..." : "Save to this decision"}
          </button>
        )
      ) : (
        <span style={{ color: COLOR.warn, fontSize: 13 }}>{availability.reason}</span>
      )}
    </div>
  );
}

export function SimulatorControls({ decision, onChange }: DecisionPanelProps) {
  const uid = useId();
  const [kind, setKind] = useState<SimulationRequest["kind"]>("stock_investment");
  const [fields, setFields] = useState<SimulatorFields>(EMPTY_FIELDS);
  const [result, setResult] = useState<{ request: SimulationRequest; simulation: SimulationPreview } | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changing anything clears the old answer: it would no longer match the numbers.
  function edit(patch: Partial<SimulatorFields>) {
    setFields(f => ({ ...f, ...patch }));
    setResult(null);
    setSaved(false);
    setError(null);
  }
  function pick(next: SimulationRequest["kind"]) {
    setKind(next);
    setResult(null);
    setSaved(false);
    setError(null);
  }

  async function handleRun() {
    const built = buildRequest(kind, fields);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setRunning(true);
    setError(null);
    setSaved(false);
    const res = await runSimulation(built.request);
    setRunning(false);
    if (!res.ok) {
      setResult(null);
      setError(res.error);
      return;
    }
    setResult({ request: built.request, simulation: res.simulation });
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    const res = await attachSimulation(decision.id, result.request);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    onChange(res.decision);
  }

  const availability = saveAvailability(decision, Date.now());

  return (
    <section aria-label="Simulator" style={{ border: `1px solid ${COLOR.border}`, borderRadius: 14, padding: 16, background: COLOR.card }}>
      <h3 style={{ margin: 0, color: COLOR.gold, fontSize: 18, fontWeight: 700 }}>Simulator</h3>
      <p style={{ margin: "4px 0 0", color: COLOR.muted, fontSize: 13, lineHeight: 1.5 }}>
        Try an idea on your own numbers before you decide. Pilot shows the arithmetic and the assumptions. Nothing here changes a car, a price or a record: you decide.
      </p>

      <div role="group" aria-label="What do you want to try?" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {KIND_CHOICES.map(c => {
          const on = c.kind === kind;
          return (
            <button
              key={c.kind}
              type="button"
              aria-pressed={on}
              onClick={() => pick(c.kind)}
              style={{
                minHeight: 44,
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                color: on ? "#1b1b1b" : COLOR.text,
                background: on ? COLOR.gold : "rgba(255,255,255,0.06)",
                border: `1px solid ${on ? COLOR.gold : COLOR.border}`,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {kind === "stock_investment" ? (
        <Field id={`${uid}-amount`} label="How much would you put into stock? (£)" placeholder="50,000" value={fields.amount} onChange={v => edit({ amount: v })} />
      ) : (
        <>
          <Field id={`${uid}-days`} label="Count a car as older after this many days in stock" placeholder={String(SIM_DEFAULT_DAYS)} hint={`Leave blank to use ${SIM_DEFAULT_DAYS} days.`} value={fields.days} onChange={v => edit({ days: v })} />
          <Field id={`${uid}-cut`} label="Cut each older car by (£)" placeholder={String(SIM_DEFAULT_CUT)} hint={`Leave blank to use £${SIM_DEFAULT_CUT}.`} value={fields.cut} onChange={v => edit({ cut: v })} />
          <Field
            id={`${uid}-extra`}
            label="Extra cars you think the cut would sell (optional)"
            placeholder="Leave blank if you don't know"
            hint="Your records can't tell Pilot this, so it will not guess. If you enter a number it is shown as your own assumption."
            value={fields.extraSales}
            onChange={v => edit({ extraSales: v })}
          />
        </>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="sn-btn sn-btn--gold" onClick={handleRun} disabled={running || saving} style={{ minHeight: 44 }}>
          {running ? "Working it out..." : "Run simulation"}
        </button>
        <span style={{ color: COLOR.faint, fontSize: 12 }}>Running one saves nothing.</span>
      </div>

      {error && (
        <p role="alert" data-part="error" style={{ color: COLOR.error, fontSize: 13, margin: "12px 0 0" }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 18 }}>
          <SimulationView simulation={result.simulation} />
          <SaveBar availability={availability} saved={saved} saving={saving} disabled={running} onSave={handleSave} />
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <SavedSimulations simulations={decision.simulations} />
      </div>
    </section>
  );
}

// Owners and managers only. Anyone else is told so plainly instead of being shown
// controls that would be refused (the server refuses them too).
export default function SimulatorPanel(props: DecisionPanelProps) {
  const { user } = useAuth();
  if (!canUseSimulator(user)) return <NoAccessNotice />;
  return <SimulatorControls {...props} />;
}
