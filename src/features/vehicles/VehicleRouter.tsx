import { Routes, Route } from "react-router-dom";
import VehicleDetailScreen from "./VehicleDetailScreen";

// InventoryScreen was removed and hasn't been rebuilt yet — this router
// isn't wired into the app's routes yet either, so this is a placeholder
// to keep it compiling until inventory is built here.
function InventoryScreenPlaceholder() {
  return <div style={{ padding: 20 }}>Inventory screen coming soon.</div>;
}

export default function VehicleRouter() {
  return (
    <Routes>
      {/* /vehicles/inventory */}
      <Route path="inventory" element={<InventoryScreenPlaceholder />} />

      {/* /vehicles/ */}
      <Route path="/" element={<InventoryScreenPlaceholder />} />

      {/* /vehicles/:id */}
      <Route path=":id" element={<VehicleDetailScreen />} />
    </Routes>
  );
}
