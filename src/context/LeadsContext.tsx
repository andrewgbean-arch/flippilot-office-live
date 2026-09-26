import React, { createContext, useContext, useState } from "react";
import type { Lead } from "@/dealer/leads/leadTypes";
import { loadLeads, saveLeads } from "@/dealer/leads/leadStorage.web";
import { useDealerNotifications } from "@/features/dealer-notifications/DealerNotificationsContext";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

// Each write resolves to false when nothing was saved: the leads haven't
// loaded for this login, or the server's current list couldn't be read.
interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  refreshLeads: () => void;
  addLead: (lead: Lead) => Promise<boolean>;
  updateLead: (lead: Lead) => Promise<boolean>;
  removeLead: (id: string) => Promise<boolean>;
  // Why the last save didn't go through (cleared by the next one that does).
  saveError: string | null;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { addNotification } = useDealerNotifications();
  const { user } = useAuth();

  // Was `}, [])` — see InventoryProvider.tsx for the confirmed bug this
  // caused: a real client-side login (no full page reload) never
  // re-triggered this fetch, so leads stayed stuck at whatever the
  // pre-login unauthenticated attempt got (nothing). Re-running on the
  // authenticated dealershipId fixes it for both a fresh login and a
  // different account logging in over an old session in the same tab.
  // A failed load is reported to the shared banner instead of leaving an
  // empty list that looks like "no leads".
  const { loading, reload, guardSave } = useGuardedLoad<Lead[]>({
    id: "leads",
    label: "leads",
    key: user?.dealershipId,
    load: loadLeads,
    apply: setLeads,
    clear: () => setLeads([]),
  });

  // Every write below re-reads the server's current list and saves it
  // back with the one change. That re-read is a load like any other: if
  // it fails it must not be taken for "no leads", or the save replaces
  // ALL of them with just this one. Null means don't write.
  async function readCurrentLeads(): Promise<Lead[] | null> {
    if (!guardSave()) return null;
    const current = await loadLeads();
    if (current === null) {
      console.warn("Leads not saved: couldn't read the current list, and saving now would overwrite it.");
    }
    return current;
  }

  // Shows the list only once the server has kept it.
  async function save(updated: Lead[]): Promise<boolean> {
    const res = await saveLeads(updated);
    if (!res.ok) {
      setSaveError(res.error ?? "That couldn't be saved.");
      return false;
    }
    setSaveError(null);
    setLeads(updated);
    return true;
  }

  async function addLead(newLead: Lead) {
    const current = await readCurrentLeads();
    if (current === null) return false;
    const updated = [...current, newLead];
    if (!(await save(updated))) return false;

    addNotification({
      type: "SALE",
      title: "New Lead",
      message: `${newLead.name || "A new lead"} was added${newLead.source ? ` via ${newLead.source}` : ""}.`,
    });
    return true;
  }

  async function updateLead(updatedLead: Lead) {
    const current = await readCurrentLeads();
    if (current === null) return false;
    const updated = current.map(l => (l.id === updatedLead.id ? updatedLead : l));
    return save(updated);
  }

  async function removeLead(id: string) {
    const current = await readCurrentLeads();
    if (current === null) return false;
    const updated = current.filter(l => l.id !== id);
    return save(updated);
  }

  return (
    <LeadsContext.Provider value={{ leads, loading, refreshLeads: reload, addLead, updateLead, removeLead, saveError }}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeads() {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error("useLeads must be used inside LeadsProvider");
  return ctx;
}