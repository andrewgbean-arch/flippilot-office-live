import React, { createContext, useContext, useState, useMemo } from "react";

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
};

type DealerNotificationsState = {
  notifications: DealerNotification[];
  addNotification: (msg: Omit<DealerNotification, "id" | "timestamp">) => void;
};

const DealerNotificationsContext = createContext<DealerNotificationsState | null>(null);

export function DealerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<DealerNotification[]>([]);

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

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
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
