import React, { createContext, useContext, useState } from "react";
export type DealerNotification = {
  id: string;
  type: "MOT" | "SALE" | "STOCK" | "SYSTEM";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};
type DealerNotificationsContextValue = {
  notifications: DealerNotification[];
  addNotification: (
    n: Omit<DealerNotification, "id" | "createdAt" | "read">
  ) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  groupedNotifications: () => {
    type: DealerNotification["type"];
    count: number;
    latest: DealerNotification;
  }[];
};
const DealerNotificationsContext =
  createContext<DealerNotificationsContextValue | null>(null);
export function DealerNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<DealerNotification[]>([]);
  const addNotification: DealerNotificationsContextValue["addNotification"] = (
    n
  ) => {
    setNotifications((prev) => [
      {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
        read: false,
        ...n,
      },
      ...prev,
    ]);
  };
  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };
  const clearAll = () => setNotifications([]);
  const groupedNotifications = () => {
    const groups: Record<
      string,
      {
        type: DealerNotification["type"];
        count: number;
        latest: DealerNotification;
      }
    > = {};
    notifications.forEach((n) => {
      const key = n.type;
      if (!groups[key]) {
        groups[key] = {
          type: key,
          count: 0,
          latest: n,
        };
      }
      groups[key].count += 1;
      if (
        new Date(n.createdAt).getTime() >
        new Date(groups[key].latest.createdAt).getTime()
      ) {
        groups[key].latest = n;
      }
    });
    return Object.values(groups);
  };
  return (
    <DealerNotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        markRead,
        clearAll,
        groupedNotifications, // ⭐ exposed
      }}
    >
      {children}
    </DealerNotificationsContext.Provider>
  );
}
export function useDealerNotifications() {
  const ctx = useContext(DealerNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useDealerNotifications must be used within DealerNotificationsProvider"
    );
  }
  return ctx;
}
