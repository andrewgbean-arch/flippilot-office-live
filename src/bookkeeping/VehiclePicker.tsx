import { useInventory } from "@/context/InventoryProvider";

// Add Cost / Add Sale used to only ever target "whichever vehicle was
// purchased most recently" (BookkeepingScreen's selectedVehicleId) with
// no way to pick a different one — a dealer with 9 cars in stock had no
// way to log a cost against car #3. This lets you pick any vehicle in
// the real inventory by reg/make/model.
export default function VehiclePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (vehicleId: string) => void;
}) {
  const { vehicles } = useInventory();

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
    >
      <option value="" disabled>
        {vehicles.length === 0 ? "No vehicles in inventory yet" : "Select a vehicle…"}
      </option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.reg ? `${v.reg} — ` : ""}
          {v.make} {v.model}
        </option>
      ))}
    </select>
  );
}
