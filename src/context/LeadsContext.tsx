import React, { createContext, useContext, useState, useEffect } from "react";
import type { Lead } from "@/dealer/leads/leadTypes";
import { loadLeads, saveLeads } from "@/dealer/leads/leadStorage.web";

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  refreshLeads: () => void;
  addLead: (lead: Lead) => Promise<void>;
  updateLead: (lead: Lead) => Promise<void>;
  removeLead: (id: string) => Promise<void>;
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLeads = async () => {
    setLoading(true);
    try {
      const stored = await loadLeads();
      setLeads(stored);
    } catch (err) {
      console.error("Lead load failed:", err);
      setLeads([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshLeads();
  }, []);

  async function addLead(newLead: Lead) {
    const current = await loadLeads();
    const updated = [...current, newLead];
    await saveLeads(updated);
    setLeads(updated);
  }

  async function updateLead(updatedLead: Lead) {
    const current = await loadLeads();
    const updated = current.map(l => (l.id === updatedLead.id ? updatedLead : l));
    await saveLeads(updated);
    setLeads(updated);
  }

  async function removeLead(id: string) {
    const current = await loadLeads();
    const updated = current.filter(l => l.id !== id);
    await saveLeads(updated);
    setLeads(updated);
  }

  return (
    <LeadsContext.Provider value={{ leads, loading, refreshLeads, addLead, updateLead, removeLead }}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeads() {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error("useLeads must be used inside LeadsProvider");
  return ctx;
}