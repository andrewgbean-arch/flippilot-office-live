import { useEffect, useState } from "react";
import { checkIsSupportAdmin } from "@/lib/supportApi";

// Purely a UX decision (show/hide the "Support Inbox" nav link) — the
// real access control is requirePlatformAdmin on the backend routes
// themselves, checked fresh on every request regardless of this.
export function useIsSupportAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkIsSupportAdmin().then(result => {
      if (!cancelled) setIsAdmin(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
