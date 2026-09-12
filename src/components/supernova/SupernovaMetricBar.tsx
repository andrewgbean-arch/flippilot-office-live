export interface SupernovaMetricBarProps {
  label: string;
  value: number;
  accent?: string;   // ⭐ add this
  color?: string;    // ⭐ optional, if you want both supported
}



export function SupernovaMetricBar({
  label,
  value,
  accent = "blue",
}: SupernovaMetricBarProps) {
  const color =
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
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
