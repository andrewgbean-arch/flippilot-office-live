import { Navigate } from "react-router-dom";

// See AddPurchaseScreen.tsx — same dead-end-placeholder issue. The real
// "Add Sale" flow is a modal inside BookkeepingScreen, not its own route.
export default function AddSaleScreen() {
  return <Navigate to="/bookkeeping" replace />;
}
