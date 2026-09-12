export default function InventoryDashboard() {
  return (
    <div className="span-white space-y-6">
      <h1 className="span-3xl font-bold span-gold drop-shadow-lg">
        Inventory Manager
      </h1>
      <p className="span-white/70">
        Welcome to your dealer inventory. This is where all vehicles will appear once we connect your data.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="p-6 bg-white/5 rounded-xl border border-white/10">
          <h2 className="span-xl font-semibold span-gold">Total Vehicles</h2>
          <p className="span-4xl font-bold mt-2">0</p>
        </div>
        <div className="p-6 bg-white/5 rounded-xl border border-white/10">
          <h2 className="span-xl font-semibold span-gold">Avg. Profit</h2>
          <p className="span-4xl font-bold mt-2">£0</p>
        </div>
        <div className="p-6 bg-white/5 rounded-xl border border-white/10">
          <h2 className="span-xl font-semibold span-gold">Reconditioning</h2>
          <p className="span-4xl font-bold mt-2">0 active</p>
        </div>
      </div>
      <div className="mt-10 p-6 bg-white/5 rounded-xl border border-white/10">
        <h2 className="span-xl font-semibold span-gold mb-4">Vehicle List</h2>
        <p className="span-white/60">No vehicles yet. We will connect your storage next.</p>
      </div>
    </div>
  );
}
