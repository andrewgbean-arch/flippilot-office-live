import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import { checkIsSupportAdmin } from "@/lib/supportApi";

export type AdminStatus = "checking" | "admin" | "not";

// The platform-admin pages (the support inbox, the list of every dealership) are for the
// people who run FlipPilot. The server refuses everyone else's requests, so a dealer who types
// the address never sees anyone's data; this just shows them the same plain panel as any other
// page their role can't open, instead of an admin screen with "Not authorized" in it.
export function AdminGateView({ status, children }: { status: AdminStatus; children: ReactNode }) {
  if (status === "admin") return <>{children}</>;
  if (status === "checking") return <p className="mx-auto mt-10 max-w-lg text-center text-white/60">Checking…</p>;
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-yellow-400/40 bg-black/50 p-8 text-center">
      <FiLock className="mx-auto mb-3 text-3xl text-yellow-300" aria-hidden />
      <h1 className="text-xl font-bold text-white">This page isn't open to your role</h1>
      <p className="mt-2 text-white/70">It's for the FlipPilot team who run the platform.</p>
      <Link to="/dealer-dashboard" className="mt-5 inline-block rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">
        Back to the dashboard
      </Link>
    </div>
  );
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    checkIsSupportAdmin().then(isAdmin => {
      if (!cancelled) setStatus(isAdmin ? "admin" : "not");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <AdminGateView status={status}>{children}</AdminGateView>;
}
