// A score out of 100 as a gold rev-counter, like the Dealer OS logo: coloured bands from Bad to
// Excellent, a needle at the score, and the word in the band's colour.
//
// The edges between the bands follow the cut-offs the app already uses, so the word never
// disagrees with the wording beside it (the MOT check calls under 45 high risk, 45 to 69
// medium and 70 up low risk; affordability's Green starts at 75, so it passes its own edges).
// A missing score draws an empty dial that says so, never a needle at zero.

export type BandEdges = readonly [number, number, number, number];

export const DEFAULT_EDGES: BandEdges = [25, 45, 70, 85];

const BANDS = [
  { word: "Bad", colour: "#e5432f" },
  { word: "Poor", colour: "#f08a2b" },
  { word: "Fair", colour: "#f3c431" },
  { word: "Good", colour: "#8fc94a" },
  { word: "Excellent", colour: "#34b35a" },
] as const;

export function cleanScore(score: number | null | undefined): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scoreBand(score: number, edges: BandEdges = DEFAULT_EDGES): { index: number; word: string; colour: string } {
  const value = cleanScore(score) ?? 0;
  const index = edges.filter(edge => value >= edge).length;
  return { index, ...BANDS[index]! };
}

const CENTRE = 88;
const START = 135; // the dial sweeps 270 degrees, open at the bottom like the logo's
const SWEEP = 270;
const angleOf = (value: number) => START + (SWEEP * value) / 100;

function point(radius: number, angle: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [100 + radius * Math.cos(radians), CENTRE + radius * Math.sin(radians)];
}

function arc(radius: number, from: number, to: number): string {
  const [x0, y0] = point(radius, from);
  const [x1, y1] = point(radius, to);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

const GAP = 1.2;

export default function ScoreGauge({
  score,
  label,
  noData = "No data",
  edges = DEFAULT_EDGES,
  width = 200,
}: {
  score: number | null | undefined;
  /** What is being scored, for people using a screen reader: "Business health". */
  label: string;
  /** What to say when there is no score. */
  noData?: string;
  edges?: BandEdges;
  width?: number;
}) {
  const value = cleanScore(score);
  const band = value === null ? null : scoreBand(value, edges);
  const bounds = [0, ...edges, 100];

  const big = width >= 170;

  return (
    <div
      role="img"
      aria-label={value === null ? `${label}: ${noData}` : `${label}: ${value} out of 100, ${band!.word}`}
      style={{ width, maxWidth: "100%", textAlign: "center" }}
    >
      <svg viewBox="14 6 172 142" width="100%" aria-hidden="true" style={{ display: "block", height: "auto" }}>
        <path d={arc(80, START, START + SWEEP)} fill="none" stroke="#d4a017" strokeWidth={3} strokeLinecap="round" />
        {value === null ? (
          <path d={arc(66, START, START + SWEEP)} fill="none" stroke="#3a3a3a" strokeWidth={12} />
        ) : (
          BANDS.map((b, i) => (
            <path
              key={b.word}
              d={arc(66, angleOf(bounds[i]!) + GAP, angleOf(bounds[i + 1]!) - GAP)}
              fill="none"
              stroke={b.colour}
              strokeWidth={12}
            />
          ))
        )}
        {Array.from({ length: 11 }, (_, k) => {
          const [x0, y0] = point(50, angleOf(k * 10));
          const [x1, y1] = point(56, angleOf(k * 10));
          return (
            <line
              key={k}
              x1={x0.toFixed(1)}
              y1={y0.toFixed(1)}
              x2={x1.toFixed(1)}
              y2={y1.toFixed(1)}
              stroke="#d4a017"
              strokeWidth={k % 5 === 0 ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}
        {value !== null && (
          <g style={{ transform: `rotate(${angleOf(value)}deg)`, transformOrigin: `100px ${CENTRE}px`, transition: "transform 0.6s ease-out" }}>
            <line x1={100} y1={CENTRE} x2={154} y2={CENTRE} stroke="#fff3b8" strokeWidth={3.5} strokeLinecap="round" />
          </g>
        )}
        <circle cx={100} cy={CENTRE} r={8} fill="#d4a017" />
        <circle cx={100} cy={CENTRE} r={3} fill="#0a0a0a" />
      </svg>
      <div
        style={{
          marginTop: 2,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          fontSize: big ? 22 : 16,
          lineHeight: 1.15,
          color: band ? band.colour : "#9a9a9a",
        }}
      >
        {band ? band.word : noData}
      </div>
      {value !== null && <div style={{ fontSize: big ? 14 : 12, color: "#bdbdbd" }}>{value}/100</div>}
    </div>
  );
}
