import { createContext, useContext, useEffect, useState } from "react";
import { StaffRecord } from "./staffTypes";
import { loadStaff, saveStaff } from "@/staff/staffStorage.web";
import { useAuth } from "@/context/AuthContext";

type StaffContextValue = {
  staff: StaffRecord[];
  addStaff: (s: StaffRecord) => Promise<void>;
  updateStaff: (s: StaffRecord) => Promise<void>;
  removeStaff: (id: string) => Promise<void>;
};

const StaffContext = createContext<StaffContextValue>({
  staff: [],
  addStaff: async () => {},
  updateStaff: async () => {},
  removeStaff: async () => {},
});

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const { user } = useAuth();

  // Was `}, [])` — see InventoryProvider.tsx for the confirmed bug: a
  // real client-side login never re-triggered this fetch, leaving staff
  // stuck empty. Re-running on the authenticated dealershipId fixes it.
  useEffect(() => {
    if (!user?.dealershipId) return;
    loadStaff().then(setStaff);
  }, [user?.dealershipId]);

  async function addStaff(newStaff: StaffRecord) {
    const current = await loadStaff();
    const updated = [...current, newStaff];
    await saveStaff(updated);
    setStaff(updated);
  }

  async function updateStaff(updatedRecord: StaffRecord) {
    const current = await loadStaff();
    const updated = current.map(s => (s.id === updatedRecord.id ? updatedRecord : s));
    await saveStaff(updated);
    setStaff(updated);
  }

  async function removeStaff(id: string) {
    const current = await loadStaff();
    const updated = current.filter(s => s.id !== id);
    await saveStaff(updated);
    setStaff(updated);
  }

  return (
    <StaffContext.Provider value={{ staff, addStaff, updateStaff, removeStaff }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  return useContext(StaffContext);
}