import { Navigate } from "react-router-dom";

// See AddPurchaseScreen.tsx — same dead-end-placeholder issue. The real
// "Add Cost" flow is a modal inside BookkeepingScreen, not its own route.
export default function AddCostScreen() {
  // Opens the hub with the cost form already open (see BookkeepingScreen).
  return <Navigate to="/bookkeeping" replace state={{ openForm: "cost" }} />;
}
