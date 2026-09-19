import type { ReactNode } from "react";
import type { DecisionState, FigureKind } from "@/lib/decisionTypes";
import type { Verdict } from "@/lib/decisionsApi";
import { KIND_HELP, STATE_HELP, STATE_LABEL, VERDICT_LABEL, VERDICT_MARK } from "./decisionFormat";

// Small pieces shared by the Decisions screens. The chips say the state or the
// verdict in words: colour only helps (so it still reads in a bright showroom, or
// with colour blindness).

export function StateChip({ state }: { state: DecisionState }) {
  return (
    <span className={`dj-chip dj-chip--${state}`} title={STATE_HELP[state]}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`dj-chip dj-chip--${verdict}`}>
      <span aria-hidden="true">{VERDICT_MARK[verdict]}</span>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

// "known", "inferred", "predicted" or "unknown": what kind of number this is.
export function KindTag({ kind }: { kind: FigureKind }) {
  return (
    <span className={`dj-kind dj-chip--${kind}`} title={KIND_HELP[kind]}>
      {kind}
    </span>
  );
}

export function ErrorText({ text }: { text: string | null | undefined }) {
  return text ? (
    <p className="dj-error" role="alert">
      {text}
    </p>
  ) : null;
}

export function Card({ title, gold, children }: { title?: string; gold?: boolean; children: ReactNode }) {
  return (
    <section className={`dj-card${gold ? " dj-card--gold" : ""}`}>
      {title ? <h2 className="dj-h2">{title}</h2> : null}
      {children}
    </section>
  );
}

// What anyone who is not an owner or a manager sees, instead of a page that would
// only fail (the server answers 403 to them).
export function NotAllowed() {
  return (
    <Card gold>
      <h2 className="dj-h2">Decisions are for owners and managers</h2>
      <p className="dj-muted">
        The Decision Journal holds the big calls about the business, so only the owner and managers can see or use it.
        If you need something looked at, ask one of them.
      </p>
    </Card>
  );
}
