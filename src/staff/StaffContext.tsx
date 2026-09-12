import { createContext, useContext, useEffect, useState } from "react";
import { StaffRecord } from "./staffTypes";
import { loadStaff, saveStaff } from "@/staff/staffStorage.web";

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

  useEffect(() => {
    loadStaff().then(setStaff);
  }, []);

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