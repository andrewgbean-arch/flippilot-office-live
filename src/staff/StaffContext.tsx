import { createContext, useContext, useEffect, useState } from "react";
import { StaffRecord } from "./staffTypes";
import { loadStaff, saveStaff } from "@/staff/staffStorage.web";
import { useAuth } from "@/context/AuthContext";

// Each write returns null on success, or an error message on failure —
// so a caller can tell a real save from one that silently didn't
// persist (a 403 from a non-manager account, a dropped connection,
// etc) instead of always showing "Saved".
type StaffContextValue = {
  staff: StaffRecord[];
  addStaff: (s: StaffRecord) => Promise<string | null>;
  updateStaff: (s: StaffRecord) => Promise<string | null>;
  removeStaff: (id: string) => Promise<string | null>;
};

const SAVE_ERROR = "Could not save — check your connection and permissions, then try again.";

const StaffContext = createContext<StaffContextValue>({
  staff: [],
  addStaff: async () => SAVE_ERROR,
  updateStaff: async () => SAVE_ERROR,
  removeStaff: async () => SAVE_ERROR,
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
    const ok = await saveStaff(updated);
    if (!ok) return SAVE_ERROR;
    setStaff(updated);
    return null;
  }

  async function updateStaff(updatedRecord: StaffRecord) {
    const current = await loadStaff();
    const updated = current.map(s => (s.id === updatedRecord.id ? updatedRecord : s));
    const ok = await saveStaff(updated);
    if (!ok) return SAVE_ERROR;
    setStaff(updated);
    return null;
  }

  async function removeStaff(id: string) {
    const current = await loadStaff();
    const updated = current.filter(s => s.id !== id);
    const ok = await saveStaff(updated);
    if (!ok) return SAVE_ERROR;
    setStaff(updated);
    return null;
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