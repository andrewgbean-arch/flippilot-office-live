import React, { createContext, useContext, useState, useEffect } from "react";
import type { FeedbackEntry, FeedbackStatus } from "@/feedback/feedbackTypes";
import { loadFeedback, submitFeedback, updateFeedbackStatus } from "@/feedback/feedbackStorage.web";
import { useAuth } from "@/context/AuthContext";

interface FeedbackContextType {
  entries: FeedbackEntry[];
  loading: boolean;
  submit: (message: string, anonymous: boolean) => Promise<string | null>;
  decide: (id: string, status: FeedbackStatus) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Same auth-reactive fetch fix as every other provider added this
  // session — keyed on the authenticated user's dealershipId, not `[]`.
  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setEntries(await loadFeedback());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

  async function submit(message: string, anonymous: boolean) {
    const res = await submitFeedback({ message, anonymous });
    if (res.ok && res.entry) setEntries(prev => [res.entry!, ...prev]);
    return res.ok ? null : res.error ?? "Could not submit feedback";
  }

  async function decide(id: string, status: FeedbackStatus) {
    const res = await updateFeedbackStatus(id, status);
    if (res.ok) setEntries(res.items);
    return res.ok ? null : res.error ?? "Could not update status";
  }

  return (
    <FeedbackContext.Provider value={{ entries, loading, submit, decide }}>{children}</FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
