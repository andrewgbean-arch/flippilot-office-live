import React, { createContext, useContext, useState, useEffect } from "react";
import type { DiaryEntry } from "@/diary/diaryTypes";
import {
  loadDiaryEntries,
  addDiaryEntry as addDiaryEntryApi,
  updateDiaryEntry as updateDiaryEntryApi,
  deleteDiaryEntry as deleteDiaryEntryApi,
} from "@/diary/diaryStorage.web";
import { useAuth } from "@/context/AuthContext";

interface DiaryContextType {
  entries: DiaryEntry[];
  loading: boolean;
  addEntry: (input: { date: string; text: string; isTask: boolean }) => Promise<string | null>;
  updateEntry: (id: string, patch: { text?: string; done?: boolean }) => Promise<string | null>;
  removeEntry: (id: string) => Promise<void>;
}

const DiaryContext = createContext<DiaryContextType | undefined>(undefined);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setEntries(await loadDiaryEntries());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function addEntry(input: { date: string; text: string; isTask: boolean }) {
    const res = await addDiaryEntryApi(input);
    if (res.ok && res.entry) setEntries(prev => [...prev, res.entry!]);
    return res.ok ? null : res.error ?? "Could not add diary entry";
  }

  async function updateEntry(id: string, patch: { text?: string; done?: boolean }) {
    const res = await updateDiaryEntryApi(id, patch);
    if (res.ok && res.entry) {
      setEntries(prev => prev.map(e => (e.id === id ? res.entry! : e)));
      return null;
    }
    return res.error ?? "Could not update diary entry";
  }

  async function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    await deleteDiaryEntryApi(id);
  }

  return (
    <DiaryContext.Provider value={{ entries, loading, addEntry, updateEntry, removeEntry }}>
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error("useDiary must be used inside DiaryProvider");
  return ctx;
}
