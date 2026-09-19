import { createContext, useContext, useState } from "react";
import { StaffRecord } from "./staffTypes";
import { loadStaff, saveStaff } from "@/staff/staffStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

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
const NOT_LOADED_ERROR =
  "Could not save — the current staff list couldn't be loaded, so saving now could overwrite it. Check your connection and try again.";

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
  // A failed load is reported to the shared banner instead of leaving an
  // empty list that looks like "no staff".
  const { guardSave } = useGuardedLoad<StaffRecord[]>({
    id: "staff",
    label: "staff records",
    key: user?.dealershipId,
    load: loadStaff,
    apply: setStaff,
    clear: () => setStaff([]),
  });

  // Every write below re-reads the server's current roster and saves it
  // back with the one change. That re-read is a load like any other: if
  // it fails it must not be taken for "no staff", or the save replaces
  // the WHOLE roster with just this one record. Null means don't write.
  async function readCurrentStaff(): Promise<StaffRecord[] | null> {
    if (!guardSave()) return null;
    const current = await loadStaff();
    if (current === null) {
      console.warn("Staff not saved: couldn't read the current list, and saving now would overwrite it.");
    }
    return current;
  }

  async function addStaff(newStaff: StaffRecord) {
    const current = await readCurrentStaff();
    if (current === null) return NOT_LOADED_ERROR;
    const updated = [...current, newStaff];
    const ok = await saveStaff(updated);
    if (!ok) return SAVE_ERROR;
    setStaff(updated);
    return null;
  }

  async function updateStaff(updatedRecord: StaffRecord) {
    const current = await readCurrentStaff();
    if (current === null) return NOT_LOADED_ERROR;
    const updated = current.map(s => (s.id === updatedRecord.id ? updatedRecord : s));
    const ok = await saveStaff(updated);
    if (!ok) return SAVE_ERROR;
    setStaff(updated);
    return null;
  }

  async function removeStaff(id: string) {
    const current = await readCurrentStaff();
    if (current === null) return NOT_LOADED_ERROR;
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