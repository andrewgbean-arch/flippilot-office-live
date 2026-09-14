import { useState } from "react";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { useDealer } from "@/context/DealerContext";
import { useAuth } from "@/context/AuthContext";
import { authHeaders } from "@/lib/authToken";

const BASE_URL = "http://localhost:4001";

const STAFF_ROLE_OPTIONS: { value: "sales" | "finance" | "manager" | "general"; label: string; description: string }[] = [
  { value: "sales", label: "Sales", description: "Leads/CRM and inventory — not bookkeeping or staff" },
  { value: "finance", label: "Finance", description: "Bookkeeping and inventory — not staff management" },
  { value: "manager", label: "Manager", description: "Broad access — bookkeeping, staff, inventory, leads" },
  { value: "general", label: "General", description: "View access; can't record sales/costs or manage staff" },
];

function InviteTeammateModal({ onClose }: { onClose: () => void }) {
  const [inviteeName, setInviteeName] = useState("");
  const [staffRole, setStaffRole] = useState<"sales" | "finance" | "manager" | "general">("general");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateLink() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/dealership/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ inviteeName: inviteeName.trim(), staffRole }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to generate invite link.");
        return;
      }
      setLink(`${window.location.origin}/join?token=${data.token}`);
    } catch {
      setError("Backend unreachable — try again.");
    } finally {
      setGenerating(false);
    }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-yellow-400/30 p-6 rounded-xl w-full max-w-md">
        <h2 className="text-yellow-300 text-xl font-bold mb-4">Invite a Teammate</h2>

        {!link ? (
          <>
            <label className="text-white/60 text-sm">Their Name (optional)</label>
            <input
              type="text"
              value={inviteeName}
              onChange={(e) => setInviteeName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            <label className="text-white/60 text-sm">Their Role</label>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as typeof staffRole)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-1"
            >
              {STAFF_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-white/40 text-xs mb-4">
              {STAFF_ROLE_OPTIONS.find((opt) => opt.value === staffRole)?.description}
            </p>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={generateLink}
                disabled={generating}
                className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-60"
              >
                {generating ? "Generating…" : "Generate Link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white/70 text-sm mb-3">
              {inviteeName.trim()
                ? `Share this link with ${inviteeName.trim()} — they'll`
                : "Share this link with a coworker — they'll"}{" "}
              create their own login and land inside your dealership, not a
              separate one. It expires in 7 days.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={link}
                className="flex-1 p-2 rounded bg-black/40 border border-white/10 text-white/80 text-sm"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 whitespace-nowrap"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditDealerProfileModal({ onClose }: { onClose: () => void }) {
  const { dealer, updateDealer } = useDealer();

  const [name, setName] = useState(dealer?.name ?? "");
  const [phone, setPhone] = useState(dealer?.phone ?? "");
  const [address, setAddress] = useState(dealer?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Dealership name can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDealer({ name: name.trim(), phone: phone.trim(), address: address.trim() });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-yellow-400/30 p-6 rounded-xl w-full max-w-md">
        <h2 className="text-yellow-300 text-xl font-bold mb-4">Edit Dealer Profile</h2>

        <label className="text-white/60 text-sm">Dealership Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Phone</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01803 555 777"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        <label className="text-white/60 text-sm">Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Unit 4, Motor Park, Paignton, Devon"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to change password.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Backend unreachable — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-yellow-400/30 p-6 rounded-xl w-full max-w-md">
        <h2 className="text-yellow-300 text-xl font-bold mb-4">Change Password</h2>

        {success ? (
          <>
            <p className="text-green-400 mb-4">Password changed successfully.</p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="text-white/60 text-sm">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            <label className="text-white/60 text-sm">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            <label className="text-white/60 text-sm">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
            />

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Change Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-5xl mx-auto">

      {/* HEADER */}
      <SupernovaHeroHeader
        title="Dealer Settings & Preferences"
        subtitle="Configure your FlipPilot Dealer OS experience, preferences, and system behaviour."
      />

      {/* Badge */}
      <div className="mb-10">
        <span className="inline-block px-4 py-2 bg-black/40 border border-yellow-400 rounded-lg text-yellow-300 text-sm">
          FlipPilot OS • Supernova V12
        </span>
      </div>

      {/* Settings Grid */}
      <SupernovaSectionDivider label="Settings" />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

        {/* Dealer Profile */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Dealer Profile</h2>
          <p className="text-white/70 mb-4">
            Manage dealership name, phone, and address — shown on your
            public marketplace page.
          </p>

          <SupernovaGlowButton label="Edit Dealer Profile" onClick={() => setShowProfileModal(true)} />
        </SupernovaGlowCard>

        {/* Account & Security */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Account & Security</h2>
          <p className="text-white/70 mb-4">
            Change your account password.
          </p>

          <SupernovaGlowButton label="Change Password" onClick={() => setShowPasswordModal(true)} />
        </SupernovaGlowCard>

        {/* Team — owner only, since inviting someone into your
            dealership's data is an ownership-level decision */}
        {user?.role === "owner" && (
          <SupernovaGlowCard>
            <h2 className="text-yellow-300 font-bold text-xl mb-3">Team</h2>
            <p className="text-white/70 mb-4">
              Invite a teammate into this dealership — they'll get their
              own login inside your workspace, not a separate one.
            </p>

            <SupernovaGlowButton label="Invite Teammate" onClick={() => setShowInviteModal(true)} />
          </SupernovaGlowCard>
        )}

      </section>

      {/* Not built yet — being upfront instead of shipping dead buttons */}
      <SupernovaSectionDivider label="Not Available Yet" />

      <SupernovaGlowCard>
        <h2 className="text-yellow-300 font-bold text-xl mb-4">Coming Soon</h2>

        <ul className="space-y-3 text-white/70">
          <li>• Custom dealer themes</li>
          <li>• Notification preferences</li>
          <li>• Multi‑dealer account switching</li>
          <li>• Exportable configuration profiles</li>
        </ul>
      </SupernovaGlowCard>

      {showProfileModal && <EditDealerProfileModal onClose={() => setShowProfileModal(false)} />}
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showInviteModal && <InviteTeammateModal onClose={() => setShowInviteModal(false)} />}

    </div>
  );
}
