import React, { createContext, useContext, useState, useEffect } from "react";
import type { TimeEntry } from "@/timekeeping/timeTypes";
import {
  loadTimeEntries,
  clockIn as clockInApi,
  clockOut as clockOutApi,
} from "@/timekeeping/timeStorage.web";
import { useAuth } from "@/context/AuthContext";

interface TimeClockContextType {
  entries: TimeEntry[];
  loading: boolean;
  myOpenEntry: TimeEntry | null;
  clockIn: () => Promise<string | null>;
  clockOut: () => Promise<string | null>;
}

const TimeClockContext = createContext<TimeClockContextType | undefined>(undefined);

export function TimeClockProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Keyed on the authenticated user's dealershipId, not `[]` — same
  // auth-reactive fetch fix applied to every other provider this
  // session (InventoryProvider/LeadsContext/StaffContext/JobsContext).
  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setEntries(await loadTimeEntries());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  const myOpenEntry = entries.find(e => e.userId === user?.id && e.clockOut === null) ?? null;

  async function handleClockIn(): Promise<string | null> {
    const res = await clockInApi();
    if (res.ok) setEntries(res.items);
    return res.ok ? null : res.error ?? "Could not clock in";
  }

  async function handleClockOut(): Promise<string | null> {
    const res = await clockOutApi();
    if (res.ok) setEntries(res.items);
    return res.ok ? null : res.error ?? "Could not clock out";
  }

  return (
    <TimeClockContext.Provider
      value={{ entries, loading, myOpenEntry, clockIn: handleClockIn, clockOut: handleClockOut }}
    >
      {children}
    </TimeClockContext.Provider>
  );
}

export function useTimeClock() {
  const ctx = useContext(TimeClockContext);
  if (!ctx) throw new Error("useTimeClock must be used inside TimeClockProvider");
  return ctx;
}
