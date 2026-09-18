import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AwaitingApprovalScreen from "@/screens/AwaitingApprovalScreen";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, approvalStatus } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/60">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (approvalStatus === "pending") {
    return <AwaitingApprovalScreen />;
  }

  return <>{children}</>;
}
