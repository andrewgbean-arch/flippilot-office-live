import { authHeaders } from "@/lib/authToken";
import type { Contact, ContactCategory } from "./contactTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

export async function loadContacts(): Promise<Contact[]> {
  try {
    const res = await fetch(`${BASE_URL}/contacts`, { headers: authHeaders() });
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("loadContacts: backend unreachable", err);
    return [];
  }
}

export async function addContact(input: {
  name: string;
  category: ContactCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string; entry?: Contact }> {
  try {
    const res = await fetch(`${BASE_URL}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: res.ok, error: data.error, entry: data.entry };
  } catch (err) {
    console.error("addContact: backend unreachable", err);
    return { ok: false, error: "Network error" };
  }
}

export async function saveContacts(items: Contact[]): Promise<void> {
  try {
    await fetch(`${BASE_URL}/contacts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items }),
    });
  } catch (err) {
    console.error("saveContacts: backend unreachable", err);
  }
}

export async function deleteContact(id: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/contacts/${id}`, { method: "DELETE", headers: authHeaders() });
  } catch (err) {
    console.error("deleteContact: backend unreachable", err);
  }
}
