import { useState } from "react";
import { MAX_EXPECTATIONS, OPTION_LABEL_MAX, OPTION_NOTE_MAX, REASONING_MAX, type Decision, type FigureUnit } from "@/lib/decisionTypes";
import type { DecideBody } from "@/lib/decisionsApi";
import {
  BLANK_DECIDE_FORM,
  BLANK_EXPECTATION_ROW,
  HORIZON_DAYS_MAX,
  HORIZON_DAYS_MIN,
  REVIEW_CHOICES,
  UNIT_OPTIONS,
  buildDecideBody,
  type DecideFormValues,
  type ExpectationRowForm,
} from "./decisionFormat";
import { ErrorText, KindTag } from "./decisionUi";

// Boss's decision. Pilot recommends, challenges and simulates; the choice is
// Boss's, and going a different way from Pilot is recorded, not argued with.
// Deciding is final, so it takes a second tap to confirm. What Boss EXPECTS to
// happen is written down now (a prediction, so it is labelled predicted) so that
// at the review each expectation can be set beside what actually happened.
export default function BossDecisionForm({
  decision,
  busy,
  error,
  onSubmit,
}: {
  decision: Decision;
  busy: boolean;
  error: string | null;
  onSubmit: (body: DecideBody) => void;
}) {
  const [form, setForm] = useState<DecideFormValues>(BLANK_DECIDE_FORM);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<DecideBody | null>(null);

  const rec = decision.pilotRecommendation;
  const recOption = rec ? decision.options.find(o => o.key === rec.optionKey) : undefined;
  const set = <K extends keyof DecideFormValues>(key: K, value: DecideFormValues[K]) => {
    setPending(null);
    setForm(prev => ({ ...prev, [key]: value }));
  };
  const setRow = (i: number, patch: Partial<ExpectationRowForm>) =>
    set("expectations", form.expectations.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function review() {
    const built = buildDecideBody(form, decision.options.map(o => o.key));
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
      <h2 className="dj-h2">Your decision</h2>
      <p className="dj-muted">
        You decide. Pilot only advises. If you go a different way from Pilot, that is fine: it is written down, not argued with.
      </p>
      {rec ? (
        <p className="dj-muted">
          Pilot recommended option {rec.optionKey.toUpperCase()}
          {recOption ? `, "${recOption.label}"` : ""} (confidence: {rec.confidence}).
        </p>
      ) : (
        <p className="dj-small">Pilot has not given a recommendation on this one. You can still decide.</p>
      )}

      <div className="dj-label" id="dj-choose">
        Which way are you going?
      </div>
      <div role="radiogroup" aria-labelledby="dj-choose">
        {decision.options.map(o => (
          <label key={o.key} className={`dj-option${form.optionKey === o.key ? " dj-option--chosen" : ""}`}>
            <input type="radio" name="dj-option" checked={form.optionKey === o.key} onChange={() => set("optionKey", o.key)} />
            <span className="dj-letter" aria-hidden="true">
              {o.key.toUpperCase()}
            </span>
            <span style={{ color: "#f5f7ff" }}>
              {o.label}
              {rec?.optionKey === o.key ? <span className="dj-chip dj-chip--plain" style={{ marginLeft: 8 }}>Pilot recommended</span> : null}
              {o.note ? <span className="dj-small" style={{ display: "block" }}>{o.note}</span> : null}
            </span>
          </label>
        ))}
        <label className={`dj-option${form.optionKey === "other" ? " dj-option--chosen" : ""}`}>
          <input type="radio" name="dj-option" checked={form.optionKey === "other"} onChange={() => set("optionKey", "other")} />
          <span style={{ color: "#f5f7ff" }}>Other: something else</span>
        </label>
      </div>
      {form.optionKey === "other" ? (
        <>
          <label className="dj-label" htmlFor="dj-other">
            What are you doing instead?
          </label>
          <input
            id="dj-other"
            className="sn-input dj-input"
            type="text"
            maxLength={OPTION_NOTE_MAX}
            value={form.otherText}
            onChange={e => set("otherText", e.target.value)}
          />
        </>
      ) : null}

      <label className="dj-label" htmlFor="dj-reasoning">
        Why? (optional, but you will be glad of it in three months)
      </label>
      <textarea
        id="dj-reasoning"
        className="sn-input dj-input"
        maxLength={REASONING_MAX}
        value={form.reasoning}
        onChange={e => set("reasoning", e.target.value)}
      />

      <h3 className="dj-h3" style={{ marginTop: 16 }}>
        What do you expect to happen?
      </h3>
      <p className="dj-small">
        Up to {MAX_EXPECTATIONS} numbers. These are predictions <KindTag kind="predicted" />: an assumption about the future. At the review each one is set
        beside what actually happened.
      </p>
      {form.expectations.map((row, i) => (
        <div key={i} className="dj-exp-row">
          <div className="dj-exp-grid">
            <div>
              <label className="dj-label" htmlFor={`dj-metric-${i}`}>
                What are you measuring?
              </label>
              <input
                id={`dj-metric-${i}`}
                className="sn-input dj-input"
                type="text"
                maxLength={OPTION_LABEL_MAX}
                placeholder="For example: Extra profit"
                value={row.metric}
                onChange={e => setRow(i, { metric: e.target.value })}
              />
            </div>
            <div>
              <label className="dj-label" htmlFor={`dj-unit-${i}`}>
                In
              </label>
              <select id={`dj-unit-${i}`} className="sn-input dj-input" value={row.unit} onChange={e => setRow(i, { unit: e.target.value as FigureUnit })}>
                {UNIT_OPTIONS.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="dj-label" htmlFor={`dj-expected-${i}`}>
                You expect
              </label>
              <input
                id={`dj-expected-${i}`}
                className="sn-input dj-input"
                type="text"
                inputMode="decimal"
                placeholder="5000"
                value={row.expected}
                onChange={e => setRow(i, { expected: e.target.value })}
              />
            </div>
            <div>
              <label className="dj-label" htmlFor={`dj-days-${i}`}>
                In how many days
              </label>
              <input
                id={`dj-days-${i}`}
                className="sn-input dj-input"
                type="text"
                inputMode="numeric"
                placeholder={`${HORIZON_DAYS_MIN} to ${HORIZON_DAYS_MAX}`}
                value={row.horizonDays}
                onChange={e => setRow(i, { horizonDays: e.target.value })}
              />
            </div>
          </div>
          <label className="dj-label" htmlFor={`dj-basis-${i}`}>
            What is that based on? (optional)
          </label>
          <input
            id={`dj-basis-${i}`}
            className="sn-input dj-input"
            type="text"
            maxLength={OPTION_NOTE_MAX}
            placeholder="For example: what the last batch made"
            value={row.basis}
            onChange={e => setRow(i, { basis: e.target.value })}
          />
          <button
            type="button"
            className="sn-btn sn-btn--ghost"
            style={{ marginTop: 8 }}
            onClick={() => set("expectations", form.expectations.filter((_, j) => j !== i))}
          >
            Remove this expectation
          </button>
        </div>
      ))}
      {form.expectations.length < MAX_EXPECTATIONS ? (
        <button type="button" className="sn-btn sn-btn--ghost" onClick={() => set("expectations", [...form.expectations, { ...BLANK_EXPECTATION_ROW }])}>
          Add an expectation
        </button>
      ) : null}

      <label className="dj-label" htmlFor="dj-review">
        Look back at how it went
      </label>
      <select id="dj-review" className="sn-input dj-input" value={form.reviewInDays} onChange={e => set("reviewInDays", e.target.value)}>
        {REVIEW_CHOICES.map(c => (
          <option key={c.days} value={String(c.days)}>
            {c.label}
          </option>
        ))}
      </select>

      <ErrorText text={problem ?? error} />

      {pending ? (
        <div className="dj-card" style={{ marginTop: 12 }}>
          <p className="dj-muted" style={{ margin: "0 0 8px" }}>
            Once you record this it cannot be changed. You will still be able to record what actually happened, and that is what the review is for.
          </p>
          <div className="dj-actions" style={{ marginTop: 0 }}>
            <button type="button" className="sn-btn sn-btn--gold dj-btn" disabled={busy} onClick={() => onSubmit(pending)}>
              {busy ? "Saving…" : "Yes, record my decision"}
            </button>
            <button type="button" className="sn-btn sn-btn--ghost dj-btn" disabled={busy} onClick={() => setPending(null)}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <div className="dj-actions">
          <button type="button" className="sn-btn sn-btn--gold dj-btn" disabled={busy} onClick={review}>
            Record my decision
          </button>
        </div>
      )}
    </section>
  );
}
