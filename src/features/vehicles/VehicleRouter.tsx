import { Routes, Route } from "react-router-dom";
import InventoryScreen from "./InventoryScreen";
import VehicleDetailScreen from "./VehicleDetailScreen";

export default function VehicleRouter() {
  return (
    <Routes>
      {/* /vehicles/inventory */}
      <Route path="inventory" element={<InventoryScreen />} />

      {/* /vehicles/ */}
      <Route path="/" element={<InventoryScreen />} />

      {/* /vehicles/:id */}
      <Route path=":id" element={<VehicleDetailScreen />} />
    </Routes>
  );
}
