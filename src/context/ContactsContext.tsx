import React, { createContext, useContext, useState, useEffect } from "react";
import type { Contact, ContactCategory } from "@/contacts/contactTypes";
import {
  loadContacts,
  addContact as addContactApi,
  saveContacts,
  deleteContact as deleteContactApi,
} from "@/contacts/contactStorage.web";
import { useAuth } from "@/context/AuthContext";

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
  updateContact: (id: string, patch: Partial<Contact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.dealershipId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setContacts(await loadContacts());
      setLoading(false);
    })();
  }, [user?.dealershipId]);

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
    const updated = contacts.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
    setContacts(updated);
    await saveContacts(updated);
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
