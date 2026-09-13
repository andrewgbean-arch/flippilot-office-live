import { Navigate } from "react-router-dom";

// See AddPurchaseScreen.tsx — same dead-end-placeholder issue. The real
// "Add Cost" flow is a modal inside BookkeepingScreen, not its own route.
export default function AddCostScreen() {
  return <Navigate to="/bookkeeping" replace />;
}
