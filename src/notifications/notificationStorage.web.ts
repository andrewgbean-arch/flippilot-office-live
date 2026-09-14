import { authHeaders } from "@/lib/authToken";
import type { StaffNotification, NotificationType } from "./notificationTypes";

const BASE_URL = "http://localhost:4001";

export async function loadNotifications(): Promise<StaffNotification[]> {
  try {
    const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadNotifications: backend unreachable", err);
    return [];
  }
}

export async function sendNotification(input: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
}): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch (err) {
    console.error("sendNotification: backend unreachable", err);
    return false;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/notifications/${id}/read`, { method: "PUT", headers: authHeaders() });
  } catch (err) {
    console.error("markNotificationRead: backend unreachable", err);
  }
}

export async function dismissNotification(id: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
  } catch (err) {
    console.error("dismissNotification: backend unreachable", err);
  }
}
