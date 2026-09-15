export interface SupernovaMetricBarProps {
  label: string;
  value: number;
  accent?: string; // named colour keyword ("red"/"yellow"/"blue")
  color?: string;  // raw CSS colour (e.g. a hex value), takes priority over accent when set
}

export function SupernovaMetricBar({
  label,
  value,
  accent = "blue",
  color,
}: SupernovaMetricBarProps) {
  // `color` was declared on the prop type (with a comment noting the
  // intent to support both) but never actually read here — every
  // caller passing a raw hex via `color` (PricingWorkflow.tsx's six
  // bars: Retail/Trade Valuation, Market Heat, Demand, Competitiveness,
  // Days to Sell) silently got the same default blue bar regardless of
  // what colour they asked for, losing the at-a-glance red/yellow/green
  // signal those figures are meant to carry.
  const accentClass =
    accent === "yellow"
      ? "bg-yellow-400"
      : accent === "red"
      ? "bg-red-400"
      : "bg-blue-400";

  return (
    <div className="mb-4">
      <div className="flex justify-between text-white/70 mb-1">
        <span>{label}</span>
        <span className="font-bold text-yellow-400">{value}%</span>
      </div>

      <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color ? "" : accentClass}`}
          style={{ width: `${value}%`, ...(color ? { backgroundColor: color } : {}) }}
        />
      </div>
    </div>
  );
}
