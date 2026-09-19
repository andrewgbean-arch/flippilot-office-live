import { useState } from "react";
import { CONTEXT_MAX, MAX_OPTIONS, MIN_OPTIONS, OPTION_LABEL_MAX, QUESTION_MAX } from "@/lib/decisionTypes";
import type { DecisionDraftInput } from "@/lib/decisionsApi";
import { BLANK_DECISION_FORM, buildDraft, type DecisionFormValues } from "./decisionFormat";
import { ErrorText } from "./decisionUi";

// Writing a decision down: the question, a little background, and two to six ways
// it could go. Used both for a new decision and for editing one that is still open
// (the server only allows that until Pilot has given a recommendation).
export default function DecisionForm({
  heading,
  submitLabel,
  initial = BLANK_DECISION_FORM,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  heading: string;
  submitLabel: string;
  initial?: DecisionFormValues;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: DecisionDraftInput) => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState(initial.question);
  const [context, setContext] = useState(initial.context);
  const [options, setOptions] = useState<string[]>(initial.options.length >= MIN_OPTIONS ? initial.options : [...initial.options, "", ""].slice(0, MIN_OPTIONS));
  const [problem, setProblem] = useState<string | null>(null);

  function submit() {
    const built = buildDraft({ question, context, options });
    if (!built.ok) {
      setProblem(built.error);
      return;
    }
    setProblem(null);
    onSubmit(built.value);
  }

  return (
    <section className="dj-card dj-card--gold">
      <h2 className="dj-h2">{heading}</h2>

      <label className="dj-label" htmlFor="dj-question">
        What are you deciding?
      </label>
      <input
        id="dj-question"
        className="sn-input dj-input"
        type="text"
        maxLength={QUESTION_MAX}
        placeholder="For example: Buy another £50k of SUVs?"
        value={question}
        onChange={e => setQuestion(e.target.value)}
      />

      <label className="dj-label" htmlFor="dj-context">
        Background (optional)
      </label>
      <textarea
        id="dj-context"
        className="sn-input dj-input"
        maxLength={CONTEXT_MAX}
        placeholder="What is going on? Why is this on your mind?"
        value={context}
        onChange={e => setContext(e.target.value)}
      />

      <div className="dj-label">
        The options ({MIN_OPTIONS} to {MAX_OPTIONS})
      </div>
      {options.map((label, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <span className="dj-letter" aria-hidden="true">
            {String.fromCharCode(65 + i)}
          </span>
          <input
            className="sn-input dj-input"
            type="text"
            aria-label={`Option ${String.fromCharCode(65 + i)}`}
            maxLength={OPTION_LABEL_MAX}
            placeholder={i === 0 ? "For example: No change" : "Another way it could go"}
            value={label}
            onChange={e => setOptions(prev => prev.map((o, j) => (j === i ? e.target.value : o)))}
          />
          {options.length > MIN_OPTIONS ? (
            <button
              type="button"
              className="sn-btn sn-btn--ghost"
              aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
              onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      {options.length < MAX_OPTIONS ? (
        <button type="button" className="sn-btn sn-btn--ghost" onClick={() => setOptions(prev => [...prev, ""])}>
          Add another option
        </button>
      ) : null}

      <ErrorText text={problem ?? error} />

      <div className="dj-actions">
        <button type="button" className="sn-btn sn-btn--gold dj-btn" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="sn-btn sn-btn--ghost dj-btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
