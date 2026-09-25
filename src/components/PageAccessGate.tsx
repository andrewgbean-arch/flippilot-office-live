import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiLock } from "react-icons/fi";

import { useAuth } from "@/context/AuthContext";
import { canOpenPage, NEED_WHO, pageNeed } from "@/lib/pageAccess";

// Stands in for a page this person's role can't open (see pageAccess.ts).
export default function PageAccessGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  if (canOpenPage(user, pathname)) return <>{children}</>;
  const need = pageNeed(pathname)!;
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-yellow-400/40 bg-black/50 p-8 text-center">
      <FiLock className="mx-auto mb-3 text-3xl text-yellow-300" aria-hidden />
      <h1 className="text-xl font-bold text-white">This page isn't open to your role</h1>
      <p className="mt-2 text-white/70">It's for {NEED_WHO[need]}. If you need something from it, ask one of them.</p>
      <Link to="/dealer-dashboard" className="mt-5 inline-block rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">
        Back to the dashboard
      </Link>
    </div>
  );
}
