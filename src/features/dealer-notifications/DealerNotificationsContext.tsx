import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { loadNotifications, dismissNotification } from "@/notifications/notificationStorage.web";

export type DealerNotification = {
  id: string;
  message: string;
  title?: string;
  type:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "SYSTEM"
    | "STOCK"
    | "SALE"
    | "MOT";
  timestamp: string;
  // True for a notification that genuinely came from the backend
  // (sent by someone, addressed to this exact account) rather than a
  // same-session, same-tab local notice (an MOT alert, "you just
  // created this job" feedback). Only persisted ones are dismissed on
  // the server too — see the comment below on why this distinction
  // exists at all.
  persisted?: boolean;
};

type DealerNotificationsState = {
  notifications: DealerNotification[];
  addNotification: (msg: Omit<DealerNotification, "id" | "timestamp">) => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
};

const DealerNotificationsContext = createContext<DealerNotificationsState | null>(null);

const POLL_INTERVAL_MS = 45_000;

export function DealerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<DealerNotification[]>([]);
  const { user } = useAuth();

  // This bell used to be pure in-memory React state with no backend
  // at all — an "addNotification" call only ever reached whichever
  // browser tab made it, never the actual intended recipient on their
  // own login (confirmed by checking every existing caller: MOT
  // alerts and "Job Assigned" both fire from the creator's own
  // session, not the assignee's). This effect adds the other half —
  // real, backend-persisted notifications addressed to THIS account —
  // merged into the same list the bell already renders, so genuinely
  // cross-account delivery (a published rota, a shift change, a leave
  // decision) now actually reaches the right person. Polls rather
  // than pushing since there's no websocket/SSE layer in this app yet.
  useEffect(() => {
    if (!user?.dealershipId || !user?.id) return;

    let cancelled = false;
    async function poll() {
      const items = await loadNotifications();
      if (cancelled) return;
      setNotifications(prev => {
        const localOnly = prev.filter(n => !n.persisted);
        const fromBackend: DealerNotification[] = items.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          timestamp: n.createdAt,
          persisted: true,
        }));
        return [...localOnly, ...fromBackend];
      });
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.dealershipId, user?.id]);

  const addNotification: DealerNotificationsState["addNotification"] = (msg) => {
    setNotifications((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...msg,
      },
    ]);
  };

  const clearNotification = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target?.persisted) {
      dismissNotification(id).catch(() => {});
    }
  };

  const clearAll = () => {
    const persistedIds = notifications.filter((n) => n.persisted).map((n) => n.id);
    setNotifications([]);
    persistedIds.forEach((id) => dismissNotification(id).catch(() => {}));
  };

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      clearNotification,
      clearAll,
    }),
    [notifications]
  );

  return (
    <DealerNotificationsContext.Provider value={value}>
      {children}
    </DealerNotificationsContext.Provider>
  );
}

export function useDealerNotifications() {
  const ctx = useContext(DealerNotificationsContext);
  if (!ctx) {
    throw new Error("useDealerNotifications must be used within DealerNotificationsProvider");
  }
  return ctx;
}