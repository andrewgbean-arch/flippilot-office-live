import type { CSSProperties, ReactNode } from "react";
import type { Confidence, Decision, DevilsAdvocate, Recommendation } from "@/lib/decisionTypes";
import { CONFIDENCE_COLOURS, CONFIDENCE_LABEL, editedSince, optionLabel, whenText } from "./analysisCardLogic";

// The two answer cards: Pilot's view and the Devil's Advocate. Everything here is
// drawn as plain text (never as markup), so nothing the model wrote can become a
// link, a picture or a script. Confidence is always a word with its reasons,
// never a number or a percentage.

const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(0,0,0,0.25)",
  minWidth: 0,
};
const heading: CSSProperties = { color: "#ffd700", fontWeight: 700, fontSize: 16, margin: "0 0 10px" };
const subheading: CSSProperties = { color: "#f5f7ff", fontWeight: 600, fontSize: 13, margin: "14px 0 4px" };
const body: CSSProperties = { color: "#f5f7ffcc", fontSize: 14, lineHeight: 1.5, margin: 0, overflowWrap: "anywhere" };
const list: CSSProperties = { ...body, paddingLeft: 18 };
const small: CSSProperties = { color: "#f5f7ff80", fontSize: 12, lineHeight: 1.4, margin: "12px 0 0" };

// A stored list can be missing or not a list if a record was damaged; show nothing rather than fail.
const asList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={list}>
      {items.map((text, i) => (
        <li key={i}>{text}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h4 style={subheading}>{title}</h4>
      {children}
    </>
  );
}

export function ConfidenceChip({ level, reasons }: { level: Confidence; reasons: string[] }) {
  const colours = CONFIDENCE_COLOURS[level] ?? CONFIDENCE_COLOURS.low;
  const why = asList(reasons);
  return (
    <div>
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          color: colours.text,
          border: `1px solid ${colours.border}`,
          background: colours.background,
        }}
      >
        {CONFIDENCE_LABEL[level] ?? "Confidence not stated"}
      </span>
      {why.length > 0 && <Bullets items={why} />}
    </div>
  );
}

function StaleNote({ decision, answeredAt }: { decision: Decision; answeredAt: string }) {
  if (!editedSince(decision, answeredAt)) return null;
  return <p style={{ ...small, color: "#ffb08a" }}>This decision was edited after this was written, so it may be about an older version. Ask again to refresh it.</p>;
}

export function PilotViewCard({ decision, view }: { decision: Decision; view: Recommendation }) {
  const unknowns = asList(view.unknowns);
  return (
    <article style={card} aria-label="Pilot's view">
      <h3 style={heading}>{"Pilot's view"}</h3>
      <p style={{ ...body, color: "#f5f7ff", fontWeight: 600 }}>Pilot recommends: {optionLabel(decision, view.optionKey)}</p>
      <p style={{ ...body, marginTop: 8 }}>{view.reasoning}</p>

      <Section title="How sure is Pilot?">
        <ConfidenceChip level={view.confidence} reasons={view.confidenceReasons} />
      </Section>

      <Section title="What Pilot does not know">
        {unknowns.length > 0 ? <Bullets items={unknowns} /> : <p style={body}>Pilot listed nothing it could not tell. Check that against what you know.</p>}
      </Section>

      <p style={small}>Asked {whenText(view.askedAt)}.</p>
      <StaleNote decision={decision} answeredAt={view.askedAt} />
    </article>
  );
}

export function DevilsAdvocateCard({ decision, view }: { decision: Decision; view: DevilsAdvocate }) {
  return (
    <article style={card} aria-label="The Devil's Advocate">
      <h3 style={heading}>{"The Devil's Advocate"}</h3>
      <p style={{ ...body, marginBottom: 2 }}>Argues against the plan on purpose, to test it. It is not a prediction.</p>

      <Section title="Case for">
        <Bullets items={asList(view.caseFor)} />
      </Section>
      <Section title="Case against">
        <Bullets items={asList(view.caseAgainst)} />
      </Section>
      <Section title="What must be true">
        <Bullets items={asList(view.assumptions)} />
      </Section>
      <Section title="What we do not know">
        <Bullets items={asList(view.unknowns)} />
      </Section>
      <Section title="If we are wrong">
        <p style={body}>{view.downside}</p>
      </Section>
      <Section title="A safer alternative">
        <p style={body}>{view.alternative}</p>
      </Section>
      <Section title="Pilot's view">
        <p style={body}>{view.pilotView}</p>
        <div style={{ marginTop: 8 }}>
          <ConfidenceChip level={view.confidence} reasons={view.confidenceReasons} />
        </div>
      </Section>

      <p style={small}>Run {whenText(view.ranAt)}.</p>
      <StaleNote decision={decision} answeredAt={view.ranAt} />
    </article>
  );
}
