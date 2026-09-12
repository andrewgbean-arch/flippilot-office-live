export default function CostBreakdown() {
  const costs = [
    { label: "Repairs", value: "£4,200", color: "text-red-300" },
    { label: "Parts", value: "£1,850", color: "text-blue-300" },
    { label: "Transport", value: "£600", color: "text-purple-300" },
    { label: "Auction Fees", value: "£900", color: "text-yellow-300" },
  ];

  return (
    <div className="bg-black/40 border border-white/10 p-6 rounded-xl shadow-xl">
      <h3 className="text-lg font-semibold text-white/80 mb-4">
        Cost Breakdown
      </h3>

      <div className="grid grid-cols-4 gap-6">
        {costs.map((c, i) => (
          <div key={i} className="bg-black/30 border border-white/10 p-4 rounded-lg">
            <p className="text-white/80">{c.label}</p>
            <p className={`${c.color} text-xl font-bold`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
