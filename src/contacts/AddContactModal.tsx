import { useState } from "react";
import { useContacts } from "@/context/ContactsContext";
import type { Contact, ContactCategory } from "./contactTypes";
import { CONTACT_CATEGORY_LABELS } from "./contactTypes";

interface AddContactModalProps {
  existing?: Contact;
  onClose: () => void;
}

export default function AddContactModal({ existing, onClose }: AddContactModalProps) {
  const { addContact, updateContact } = useContacts();
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<ContactCategory>(existing?.category ?? "parts_supplier");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter a business name before saving.");
      return;
    }
    setSaving(true);
    setError(null);

    const fields = {
      name: name.trim(),
      category,
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    if (existing) {
      const ok = await updateContact(existing.id, fields);
      setSaving(false);
      if (!ok) {
        setError("Couldn't save because your contacts couldn't be loaded. Nothing was changed — try again shortly.");
        return;
      }
      onClose();
      return;
    }

    const err = await addContact(fields);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/80 border border-white/10 p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-white/80 text-xl font-semibold mb-4">{existing ? "Edit Contact" : "Add Contact"}</h2>

        <label className="text-white/60 text-sm">Business Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. BCA, Halfords Trade, ABC Recovery..."
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as ContactCategory)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        >
          {Object.entries(CONTACT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label className="text-white/60 text-sm">Contact Person (optional)</label>
        <input
          type="text"
          value={contactName}
          onChange={e => setContactName(e.target.value)}
          placeholder="Who to ask for"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/60 text-sm">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm">Phone (optional)</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
            />
          </div>
        </div>

        <label className="text-white/60 text-sm">Address (optional)</label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-300"
          >
            {saving ? "…" : existing ? "Save Changes" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
