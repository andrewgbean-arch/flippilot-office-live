import { useState } from "react";
import { LESSON_MAX, REASONING_MAX, type Decision } from "@/lib/decisionTypes";
import type { OutcomeBody } from "@/lib/decisionsApi";
import { LESSON_FIELDS, blankOutcomeForm, buildOutcomeBody, formatFigure, type ActualRowForm, type OutcomeFormValues } from "./decisionFormat";
import { ErrorText, KindTag } from "./decisionUi";

// "What actually happened", once Boss has decided. One box per expectation: a
// number, or "Not known" (which is recorded as unknown, never as 0), then notes and
// five short lessons. It can be recorded only once, so it takes a second tap.
export default function OutcomeForm({
  decision,
  busy,
  error,
  onSubmit,
}: {
  decision: Decision;
  busy: boolean;
  error: string | null;
  onSubmit: (body: OutcomeBody) => void;
}) {
  const [form, setForm] = useState<OutcomeFormValues>(() => blankOutcomeForm(decision.expectations.map(e => e.id)));
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<OutcomeBody | null>(null);

  const metrics = Object.fromEntries(decision.expectations.map(e => [e.id, e.metric]));
  const edit = (next: OutcomeFormValues) => {
    setPending(null);
    setForm(next);
  };
  const setRow = (i: number, patch: Partial<ActualRowForm>) =>
    edit({ ...form, actuals: form.actuals.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  function review() {
    const built = buildOutcomeBody(form, metrics);
    if (!built.ok) {
      setProblem(built.error);
      setPending(null);
      return;
    }
    setProblem(null);
    setPending(built.value);
  }

  return (
    <section className="dj-card dj-card--gold">
      <h2 className="dj-h2">What actually happened</h2>
      <p className="dj-muted">
        Set each expectation beside the real result. If you do not know a result, say so: it is kept as unknown, never as zero.
      </p>

      {decision.expectations.length === 0 ? (
        <p className="dj-small">You did not set any expectations, so there is nothing to compare. You can still write down what happened and what you learned.</p>
      ) : null}

      {decision.expectations.map((e, i) => {
        const row = form.actuals[i];
        if (!row) return null;
        return (
          <div key={e.id} className="dj-exp-row">
            <div style={{ fontWeight: 600, color: "#f5f7ff" }}>{e.metric}</div>
            <div className="dj-small">
              You expected {formatFigure(e.expected, e.unit)} <KindTag kind="predicted" /> within {e.horizonDays} {e.horizonDays === 1 ? "day" : "days"}
              {e.basis ? `. Based on: ${e.basis}` : ""}
            </div>
            <label className="dj-label" htmlFor={`dj-actual-${i}`}>
              What actually happened
            </label>
            <input
              id={`dj-actual-${i}`}
              className="sn-input dj-input"
              type="text"
              inputMode="decimal"
              disabled={row.notKnown}
              placeholder={row.notKnown ? "Not known" : "A number"}
              value={row.notKnown ? "" : row.actual}
              onChange={ev => setRow(i, { actual: ev.target.value })}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, color: "#c7d0ff", fontSize: 13, minHeight: 32 }}>
              <input type="checkbox" checked={row.notKnown} onChange={ev => setRow(i, { notKnown: ev.target.checked })} />
              Not known
            </label>
            <label className="dj-label" htmlFor={`dj-actual-note-${i}`}>
              A note about this result (optional)
            </label>
            <input
              id={`dj-actual-note-${i}`}
              className="sn-input dj-input"
              type="text"
              maxLength={LESSON_MAX}
              value={row.note}
              onChange={ev => setRow(i, { note: ev.target.value })}
            />
          </div>
        );
      })}

      <label className="dj-label" htmlFor="dj-outcome-notes">
        What happened, in your own words (optional)
      </label>
      <textarea id="dj-outcome-notes" className="sn-input dj-input" maxLength={REASONING_MAX} value={form.notes} onChange={ev => edit({ ...form, notes: ev.target.value })} />

      <h3 className="dj-h3" style={{ marginTop: 16 }}>
        What you learned (all optional)
      </h3>
      {LESSON_FIELDS.map(f => (
        <div key={f.key}>
          <label className="dj-label" htmlFor={`dj-lesson-${f.key}`}>
            {f.label}
          </label>
          <textarea
            id={`dj-lesson-${f.key}`}
            className="sn-input dj-input"
            maxLength={LESSON_MAX}
            value={form.lessons[f.key]}
            onChange={ev => edit({ ...form, lessons: { ...form.lessons, [f.key]: ev.target.value } })}
          />
        </div>
      ))}

      <ErrorText text={problem ?? error} />

      {pending ? (
        <div className="dj-card" style={{ marginTop: 12 }}>
          <p className="dj-muted" style={{ margin: "0 0 8px" }}>
            Once you record what happened, the decision is closed and this cannot be changed.
          </p>
          <div className="dj-actions" style={{ marginTop: 0 }}>
            <button type="button" className="sn-btn sn-btn--gold dj-btn" disabled={busy} onClick={() => onSubmit(pending)}>
              {busy ? "Saving…" : "Yes, record what happened"}
            </button>
            <button type="button" className="sn-btn sn-btn--ghost dj-btn" disabled={busy} onClick={() => setPending(null)}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="dj-actions">
          <button type="button" className="sn-btn sn-btn--gold dj-btn" disabled={busy} onClick={review}>
            Record what happened
          </button>
        </div>
      )}
    </section>
  );
}
