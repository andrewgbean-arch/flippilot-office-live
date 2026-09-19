import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { FeedbackEntry, FeedbackStatus } from "@/feedback/feedbackTypes";
import { fetchFeedback, loadFeedback, submitFeedback, updateFeedbackStatus } from "@/feedback/feedbackStorage.web";
import { useAuth } from "@/context/AuthContext";
import { createRefreshGuard } from "@/lib/refreshGuard";

interface FeedbackContextType {
  entries: FeedbackEntry[];
  loading: boolean;
  // `photoIds` are photos already uploaded for this post; with at least one,
  // `message` may be empty.
  submit: (message: string, anonymous: boolean, photoIds?: string[]) => Promise<string | null>;
  decide: (id: string, status: FeedbackStatus) => Promise<string | null>;
  // Fetches the board again. The list is otherwise only loaded at login, so
  // without this other people's new posts wouldn't appear, and the (24-hour)
  // photo links on a board left open overnight would have expired. A failed
  // fetch leaves the board as it is.
  refresh: () => Promise<void>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Whatever changes the list other than a refresh (a login change, a post,
  // a status change) bumps this, so an older refresh's answer can't undo it.
  const guardRef = useRef(createRefreshGuard());

  // Same auth-reactive fetch fix as every other provider added this
  // session — keyed on the authenticated user's dealershipId, not `[]`.
  useEffect(() => {
    guardRef.current.bump();
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

  async function submit(message: string, anonymous: boolean, photoIds: string[] = []) {
    const res = await submitFeedback({ message, anonymous, photoIds });
    if (res.ok && res.entry) {
      guardRef.current.bump();
      setEntries(prev => [res.entry!, ...prev]);
    }
    return res.ok ? null : res.error ?? "Could not submit feedback";
  }

  async function decide(id: string, status: FeedbackStatus) {
    const res = await updateFeedbackStatus(id, status);
    if (res.ok) {
      guardRef.current.bump();
      setEntries(res.items);
    }
    return res.ok ? null : res.error ?? "Could not update status";
  }

  async function refresh() {
    if (!user?.dealershipId) return;
    const ticket = guardRef.current.begin();
    const fresh = await fetchFeedback();
    // A failed fetch leaves the board alone; and if a post or status change
    // happened while this was in flight, its answer is older than the screen.
    if (fresh === null || !ticket.isCurrent()) return;
    setEntries(fresh);
  }

  return (
    <FeedbackContext.Provider value={{ entries, loading, submit, decide, refresh }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
