import { Navigate } from "react-router-dom";

// This was a dead-end placeholder — DealerDashboard's "Bookkeeping
// Module" card links straight to /bookkeeping/add-purchase, but the
// real, working "Add Purchase" flow only ever existed as a modal inside
// BookkeepingScreen (opened via a button there), never as its own
// routed page. Redirecting here instead of showing static placeholder
// text.
export default function AddPurchaseScreen() {
  return <Navigate to="/bookkeeping" replace />;
}
