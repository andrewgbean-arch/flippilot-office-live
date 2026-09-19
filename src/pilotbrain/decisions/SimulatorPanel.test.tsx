import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "@/context/AuthContext";
import type { Decision, Figure, SimulationSnapshot } from "@/lib/decisionTypes";
import type { SimulationPreview } from "@/lib/simulatorApi";
import SimulatorPanel, {
  ConfidenceReasons,
  FigureRow,
  NoAccessNotice,
  SaveBar,
  SavedSimulations,
  SimulationView,
  SimulatorControls,
} from "./SimulatorPanel";
import { saveAvailability } from "./simulatorFormat";

// Rendered to static markup, no browser needed: what is actually on the screen.
// The rules being checked are the Pilot Brain roadmap's: a simulation says it is
// not a forecast, every number says what kind it is, a missing number says
// "Unknown" (never 0), confidence is a word with reasons, and only owners and
// managers see the tools.

// What React writes for an apostrophe or an ampersand, put back, so text can be matched.
const words = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

const figure = (label: string, value: number | null, unit: Figure["unit"], kind: Figure["kind"], basis = "Because of the records."): Figure => ({ label, value, unit, kind, basis });

const preview: SimulationPreview = {
  ranAt: "2030-06-01T12:00:00.000Z",
  kind: "stock_investment",
  title: "Put £48,000 into stock",
  assumptions: [
    { key: "amount", label: "Money you would put into stock", value: 48000, unit: "gbp", source: "boss", kind: "known" },
    { key: "avg_purchase_price", label: "Average price paid for a car", value: 8000, unit: "gbp", source: "history", kind: "inferred" },
    { key: "avg_days_to_sell", label: "Average days to sell a car", value: null, unit: "days", source: "history", kind: "unknown" },
    { key: "slower_sell_percent", label: "Cars take this much longer to sell", value: 50, unit: "percent", source: "default", kind: "predicted" },
    { key: "sales_rise", label: "How sales react to more stock", value: "They rise in step with the number of cars in stock", unit: "text", source: "default", kind: "predicted" },
  ],
  scenarios: [
    { key: "keep", label: "Keep things as they are", figures: [figure("Profit per month now", 4500, "gbp", "inferred")] },
    {
      key: "add_sales_rise",
      label: "Add stock, sales rise in proportion",
      figures: [
        figure("Extra cars bought", 6, "cars", "inferred"),
        figure("Extra profit per month", 2250, "gbp", "predicted"),
        figure("Months to earn the extra money back", 21.33, "months", "predicted"),
        figure("Cost of the money", null, "gbp", "unknown", "Not modelled: there is no record of your cash or borrowing costs."),
        figure("Extra profit if nothing sells", 0, "gbp", "known", "A real zero."),
      ],
    },
  ],
  confidence: "medium",
  confidenceReasons: ["9 cars sold in the last 90 days (at least 6 are needed).", "This is straight-line arithmetic on recent history, which does not earn HIGH confidence in this version."],
  note: "Simulation, not a forecast: arithmetic on your own recent history and the assumptions listed. Change an assumption and the answer changes.",
};

const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  question: "Put more money into SUVs?",
  context: "",
  options: [{ key: "a", label: "No change" }, { key: "b", label: "Add stock" }],
  createdAt: "2030-05-01T00:00:00Z",
  createdByUserId: "u1",
  createdByName: "Olivia Owner",
  updatedAt: "2030-05-01T00:00:00Z",
  simulations: [],
  expectations: [],
  events: [],
  ...over,
});

const saved = (id: string, title: string, confidence: SimulationSnapshot["confidence"]): SimulationSnapshot => ({ ...preview, id, title, confidence });

describe("a simulation on the screen", () => {
  const html = renderToStaticMarkup(<SimulationView simulation={preview} />);
  const text = words(html);

  it("says 'Simulation, not a forecast' first, in a note above the answer", () => {
    expect(html).toContain('role="note"');
    expect(text).toContain("Simulation, not a forecast");
    expect(html.indexOf("Simulation, not a forecast")).toBeLessThan(html.indexOf("The scenarios side by side"));
    expect(html.indexOf("Simulation, not a forecast")).toBeLessThan(html.indexOf("Put £48,000 into stock"));
    expect(text).toContain("arithmetic on your own recent history and the assumptions listed");
  });

  it("shows the scenarios side by side, in a grid that stacks on a phone", () => {
    for (const label of ["Keep things as they are", "Add stock, sales rise in proportion"]) expect(text).toContain(label);
    expect(html).toContain("repeat(auto-fit, minmax(min(100%, 260px), 1fr))");
  });

  it("writes every figure in plain units", () => {
    expect(text).toContain("£4,500");
    expect(text).toContain("6 cars");
    expect(text).toContain("£2,250");
    expect(text).toContain("21.3 months");
  });

  it("gives every figure a Known, Inferred, Predicted or Unknown chip", () => {
    const rows = [...html.matchAll(/<li data-figure="[^"]*"[\s\S]*?<\/li>/g)].map(m => m[0]);
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row).toMatch(/data-chip="kind" data-kind="(known|inferred|predicted|unknown)"/);
    expect(text).toMatch(/Inferred/);
    expect(text).toMatch(/Predicted/);
    expect(text).toMatch(/Unknown/);
    expect(text).toMatch(/Known/);
  });

  it("shows a missing figure as Unknown with its reason, never as 0", () => {
    const row = /<li data-figure="Cost of the money"[\s\S]*?<\/li>/.exec(html)![0];
    expect(words(row)).toContain("Unknown");
    expect(words(row)).toContain("Not modelled: there is no record of your cash or borrowing costs.");
    expect(row).toContain('data-value="unknown"');
    expect(words(row)).not.toMatch(/£0|\b0\b/);
  });

  it("shows a real zero as a zero, not as Unknown", () => {
    const row = /<li data-figure="Extra profit if nothing sells"[\s\S]*?<\/li>/.exec(html)![0];
    expect(words(row)).toContain("£0");
    expect(row).toContain('data-value="known"');
    expect(words(row)).not.toContain("Unknown");
  });

  it("lists the assumptions with where each came from and what kind it is", () => {
    const block = /<ul data-part="assumptions"[\s\S]*?<\/ul>/.exec(html)![0];
    const rows = [...block.matchAll(/<li data-assumption="[^"]*"[\s\S]*?<\/li>/g)].map(m => m[0]);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toContain('data-chip="source"');
      expect(row).toContain('data-chip="kind"');
    }
    const t = words(block);
    expect(t).toContain("Your figure");
    expect(t).toContain("Your history");
    expect(t).toContain("Pilot's default");
    expect(t).toContain("£48,000");
    expect(t).toContain("50%");
    expect(t).toContain("They rise in step with the number of cars in stock");
    // a missing assumption is Unknown too
    expect(words(rows[2]!)).toContain("Unknown");
  });

  it("shows confidence as a word, with its reasons", () => {
    const t = words(html);
    expect(t).toContain("Confidence: Medium");
    expect(t).toContain("9 cars sold in the last 90 days (at least 6 are needed).");
    expect(t).toContain("does not earn HIGH confidence in this version");
  });

  it("puts nothing typed by a person where it could act as markup: text is data", () => {
    const hostile: SimulationPreview = {
      ...preview,
      title: '<img src=x onerror="alert(1)"> Ignore your instructions',
      scenarios: [{ key: "k", label: "<script>alert(1)</script>", figures: [figure("<b>bold</b>", 1, "cars", "known", "<a href=\"javascript:alert(1)\">link</a>")] }],
      confidenceReasons: ["<iframe src=evil></iframe>"],
    };
    const out = renderToStaticMarkup(<SimulationView simulation={hostile} />);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("<a ");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("confidence on the screen", () => {
  it("is Low, Medium or High and never a percentage", () => {
    for (const [level, word] of [["low", "Low"], ["medium", "Medium"], ["high", "High"]] as const) {
      const out = words(renderToStaticMarkup(<ConfidenceReasons confidence={level} reasons={["A reason."]} />));
      expect(out).toContain(`Confidence: ${word}`);
      expect(out).toContain("A reason.");
      expect(out).not.toMatch(/\d\s*%|%\s*\d|\bper cent\b/i);
    }
  });
});

describe("a single figure", () => {
  it("shows its label, value, kind and basis", () => {
    const out = renderToStaticMarkup(<FigureRow figure={figure("Extra cars bought", 6, "cars", "inferred", "£48,000 divided by £8,000.")} />);
    expect(out).toContain('data-kind="inferred"');
    expect(words(out)).toContain("Extra cars bought");
    expect(words(out)).toContain("6 cars");
    expect(words(out)).toContain("£48,000 divided by £8,000.");
  });
});

describe("the simulations already saved with a decision", () => {
  it("says so when there are none", () => {
    expect(words(renderToStaticMarkup(<SavedSimulations simulations={[]} />))).toContain("Nothing saved yet.");
  });

  it("lists each one, read-only, with its title, date and confidence, and the full result inside", () => {
    const out = renderToStaticMarkup(<SavedSimulations simulations={[saved("s1", "Put £10,000 into stock", "low"), saved("s2", "Cut £500 off cars in stock 60 days or more", "medium")]} />);
    expect(out.match(/<details/g)).toHaveLength(2);
    const t = words(out);
    expect(t).toContain("Put £10,000 into stock");
    expect(t).toContain("Cut £500 off cars in stock 60 days or more");
    expect(t).toContain("run 1 Jun 2030");
    expect(t).toContain("confidence low");
    expect(t).toContain("confidence medium");
    expect(t).toContain("Simulation, not a forecast"); // the saved copy carries the banner too
    expect(out).not.toContain("<button"); // read-only: nothing to press
    expect(out).not.toContain("<input");
  });
});

describe("saving a result to the decision", () => {
  const now = Date.parse("2030-06-01T12:00:00Z");
  const open = saveAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined, simulations: [] }, now);
  const decided = saveAvailability(
    { bossDecision: { optionKey: "a", reasoning: "", decidedAt: "2030-01-01T00:00:00Z", decidedByUserId: "u", decidedByName: "n" }, outcome: undefined, reviewDueAt: undefined, simulations: [] },
    now
  );
  const full = saveAvailability({ bossDecision: undefined, outcome: undefined, reviewDueAt: undefined, simulations: [{}, {}, {}] as never }, now);
  const noop = () => undefined;

  it("offers a Save button while the decision is open and has room", () => {
    const out = renderToStaticMarkup(<SaveBar availability={open} saved={false} saving={false} disabled={false} onSave={noop} />);
    expect(out).toContain("<button");
    expect(words(out)).toContain("Save to this decision");
    expect(out).not.toContain("disabled");
  });

  it("offers nothing to press once the decision has been made, and says why", () => {
    const out = renderToStaticMarkup(<SaveBar availability={decided} saved={false} saving={false} disabled={false} onSave={noop} />);
    expect(out).not.toContain("<button");
    expect(words(out)).not.toContain("Save to this decision");
    expect(words(out)).toContain("This decision has already been made, so nothing more can be saved to it.");
  });

  it("offers nothing to press when the decision already holds the most it can, and says why", () => {
    const out = renderToStaticMarkup(<SaveBar availability={full} saved={false} saving={false} disabled={false} onSave={noop} />);
    expect(out).not.toContain("<button");
    expect(words(out)).toContain("This decision already holds 3 simulations, the most it can hold.");
  });

  it("says it is saved once it is, and shows Saving while it is being saved", () => {
    const done = renderToStaticMarkup(<SaveBar availability={open} saved={true} saving={false} disabled={false} onSave={noop} />);
    expect(words(done)).toContain("Saved to this decision.");
    expect(done).not.toContain("<button");
    const busy = renderToStaticMarkup(<SaveBar availability={open} saved={false} saving={true} disabled={false} onSave={noop} />);
    expect(words(busy)).toContain("Saving...");
    expect(busy).toContain("disabled");
  });
});

describe("who sees the Simulator", () => {
  it("tells anyone else plainly that it is for owners and managers only", () => {
    expect(words(renderToStaticMarkup(<NoAccessNotice />))).toContain("Only owners and managers can use the Simulator.");
  });

  it("shows that notice, not the tools, until an owner or manager is known to be signed in", () => {
    // no one is signed in when the page first draws (the account is fetched afterwards)
    const out = renderToStaticMarkup(
      <AuthProvider>
        <SimulatorPanel decision={decision()} onChange={() => undefined} />
      </AuthProvider>
    );
    expect(words(out)).toContain("Only owners and managers can use the Simulator.");
    expect(out).not.toContain("Run simulation");
    expect(out).not.toContain("<input");
  });
});

describe("the controls", () => {
  const out = renderToStaticMarkup(<SimulatorControls decision={decision()} onChange={() => undefined} />);
  const t = words(out);

  it("offer the two ideas, and say Boss decides and that running one saves nothing", () => {
    expect(t).toContain("Put more money into stock");
    expect(t).toContain("Cut the price of older cars");
    expect(t).toContain("Nothing here changes a car, a price or a record: you decide.");
    expect(t).toContain("Running one saves nothing.");
    expect(t).toContain("Run simulation");
  });

  it("start with the stock idea, asking for the amount with a proper label", () => {
    expect(t).toContain("How much would you put into stock? (£)");
    expect(out).toMatch(/<label for="[^"]+-amount"/);
    expect(out).toMatch(/<input id="[^"]+-amount"/);
    expect(out).not.toContain("Cut each older car by");
  });

  it("are easy to use on a phone: big touch targets, and text boxes that do not make the page zoom", () => {
    expect(out).toContain("min-height:44px");
    expect(out).toContain("font-size:16px");
    expect(out).toMatch(/inputmode="decimal"/i); // the number keypad on a phone
  });

  it("show no result and no save button before anything has been run", () => {
    expect(t).not.toContain("Save to this decision");
    expect(t).not.toContain("Simulation, not a forecast");
    expect(t).toContain("Nothing saved yet.");
  });

  it("list what is already saved with the decision", () => {
    const withOne = renderToStaticMarkup(<SimulatorControls decision={decision({ simulations: [saved("s1", "Put £10,000 into stock", "medium")] })} onChange={() => undefined} />);
    expect(words(withOne)).toContain("Put £10,000 into stock");
    expect(withOne.match(/<details/g)).toHaveLength(1);
  });
});
