import { authHeaders } from "@/lib/authToken";
import { loadList } from "@/lib/loadJson";
import type { Contact, ContactCategory } from "./contactTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

// null = the contacts couldn't be read (dropped connection,
// 401/402/403/5xx, not a list). [] only ever means the server said there
// are none. Editing a contact saves the whole list back, so a failed
// read taken for "no contacts" wiped the rest on the next edit (see
// loadJson.ts).
export async function loadContacts(): Promise<Contact[] | null> {
  return loadList<Contact>("/contacts");
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
