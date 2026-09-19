import React, { createContext, useContext, useState } from "react";
import type { Contact, ContactCategory } from "@/contacts/contactTypes";
import {
  loadContacts,
  addContact as addContactApi,
  saveContacts,
  deleteContact as deleteContactApi,
} from "@/contacts/contactStorage.web";
import { useAuth } from "@/context/AuthContext";
import { useGuardedLoad } from "@/lib/useGuardedLoad";

interface ContactsContextType {
  contacts: Contact[];
  loading: boolean;
  addContact: (input: {
    name: string;
    category: ContactCategory;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
  }) => Promise<string | null>;
  // false = nothing was saved because the contacts haven't loaded.
  updateContact: (id: string, patch: Partial<Contact>) => Promise<boolean>;
  removeContact: (id: string) => Promise<void>;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { user } = useAuth();

  // Editing a contact saves the WHOLE list back, so guardSave() refuses
  // until the contacts have loaded for this login. Without it: one failed
  // load, add a contact (a safe server-side append, but it leaves a
  // one-item list on screen), edit it, and the whole-list save replaced
  // every real contact with that one. Add and remove hit per-item
  // endpoints, so they need no guard.
  const { loading, guardSave } = useGuardedLoad<Contact[]>({
    id: "contacts",
    label: "contacts",
    key: user?.dealershipId,
    load: loadContacts,
    apply: setContacts,
    clear: () => setContacts([]),
  });

  async function addContact(input: {
    name: string;
    category: ContactCategory;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
  }) {
    const res = await addContactApi(input);
    if (res.ok && res.entry) setContacts(prev => [...prev, res.entry!]);
    return res.ok ? null : res.error ?? "Could not add contact";
  }

  async function updateContact(id: string, patch: Partial<Contact>) {
    if (!guardSave()) return false;
    const updated = contacts.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
    setContacts(updated);
    await saveContacts(updated);
    return true;
  }

  async function removeContact(id: string) {
    setContacts(prev => prev.filter(c => c.id !== id));
    await deleteContactApi(id);
  }

  return (
    <ContactsContext.Provider value={{ contacts, loading, addContact, updateContact, removeContact }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used inside ContactsProvider");
  return ctx;
}
