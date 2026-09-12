export default function SupplierPerformance() {
  const suppliers = [
    { name: "BCA", margin: "18%", reliability: "High" },
    { name: "Copart", margin: "21%", reliability: "Medium" },
    { name: "Private Sellers", margin: "15%", reliability: "Low" },
  ];

  return (
    <div className="bg-black/40 border border-white/10 p-6 rounded-xl shadow-xl">
      <h3 className="text-lg font-semibold text-white/80 mb-4">
        Supplier Performance
      </h3>

      <div className="grid grid-cols-3 gap-6">
        {suppliers.map((s, i) => (
          <div
            key={i}
            className="bg-black/30 border border-white/10 p-4 rounded-lg"
          >
            <p className="text-white/80 font-semibold">{s.name}</p>
            <p className="text-yellow-300 text-sm">Avg Margin: {s.margin}</p>
            <p className="text-white/60 text-sm">Reliability: {s.reliability}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
