import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";

import { useDealer } from "@/context/DealerContext";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryProvider";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { authHeaders } from "@/lib/authToken";
import { useTour } from "@/tour/TourProvider";
import { toCSV, downloadCSV } from "@/lib/csv";
import type { TeamMember } from "@/jobs/jobTypes";

import { BASE_URL } from "@/lib/apiBaseUrl";

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

// Change a teammate's role or remove them — the owner-facing side of
// the invite flow above. Both take effect on that person's very next
// request (the backend re-reads the account every time), so removing
// someone here really does cut them off immediately, not when their
// login eventually expires.
function ManageTeamModal({ onClose }: { onClose: () => void }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/team`, { headers: authHeaders() });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error || "Couldn't load your team.");
          return;
        }
        setMembers(data.members);
      } catch {
        if (!cancelled) setError("Backend unreachable — try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeRole(member: TeamMember, staffRole: string) {
    setBusyId(member.id);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/dealership/team/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ staffRole }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to change role.");
        return;
      }
      setMembers((prev) => prev && prev.map((m) => (m.id === member.id ? data.member : m)));
    } catch {
      setError("Backend unreachable — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(member: TeamMember) {
    setBusyId(member.id);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/dealership/team/${member.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      // A 404 means they're already gone (removed from another tab or
      // device) — exactly the state the owner asked for, so just drop
      // the row rather than showing an error about it.
      if (!data.ok && res.status !== 404) {
        setError(data.error || "Failed to remove teammate.");
        return;
      }
      setMembers((prev) => prev && prev.filter((m) => m.id !== member.id));
      setConfirmingId(null);
    } catch {
      setError("Backend unreachable — try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-yellow-400/30 p-6 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <h2 className="text-yellow-300 text-xl font-bold mb-1">Manage Team</h2>
        <p className="text-white/50 text-xs mb-4">
          Role changes and removals take effect on their very next click — no waiting for them to log in again.
        </p>

        {members === null && !error && <p className="text-white/60 text-sm mb-4">Loading team…</p>}

        {members && (
          <ul className="space-y-3 mb-4">
            {members.map((m) => (
              <li key={m.id} className="p-3 rounded bg-black/40 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white/90 font-semibold truncate">{m.name}</p>
                    <p className="text-white/40 text-xs truncate">{m.email}</p>
                  </div>

                  {m.role === "owner" ? (
                    <span className="text-yellow-300 text-xs font-semibold px-2 py-1 rounded bg-yellow-400/10 whitespace-nowrap">
                      Owner
                    </span>
                  ) : (
                    <select
                      aria-label={`Role for ${m.name}`}
                      value={m.staffRole ?? "general"}
                      disabled={busyId === m.id}
                      onChange={(e) => changeRole(m, e.target.value)}
                      className="p-1 rounded bg-black/40 border border-white/10 text-white/80 text-sm disabled:opacity-60"
                    >
                      {STAFF_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {m.role !== "owner" &&
                  (confirmingId === m.id ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-red-300 text-xs">Remove {m.name}? They'll lose access straight away.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={busyId === m.id}
                          className="px-3 py-1 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => removeMember(m)}
                          disabled={busyId === m.id}
                          className="px-3 py-1 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-400 disabled:opacity-60"
                        >
                          {busyId === m.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(m.id)}
                      className="mt-2 text-xs text-red-400 hover:text-red-300"
                    >
                      Remove from team
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDealerProfileModal({ onClose }: { onClose: () => void }) {
  const { dealer, updateDealer } = useDealer();

  const [name, setName] = useState(dealer?.name ?? "");
  const [phone, setPhone] = useState(dealer?.phone ?? "");
  const [address, setAddress] = useState(dealer?.address ?? "");
  const [vatNumber, setVatNumber] = useState(dealer?.vatNumber ?? "");
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
      await updateDealer({ name: name.trim(), phone: phone.trim(), address: address.trim(), vatNumber: vatNumber.trim() });
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

        <label className="text-white/60 text-sm">VAT Number (optional)</label>
        <input
          type="text"
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          placeholder="GB123456789"
          className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mb-4"
        />
        <p className="text-white/40 text-xs -mt-3 mb-4">
          Shown on customer invoices if set. Leave blank if you're not VAT-registered.
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

// Dated filename so a dealer downloading their data more than once
// (e.g. monthly backups) doesn't silently overwrite the last file in
// their downloads folder without realising.
function dated(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startTour } = useTour();
  const { vehicles } = useInventory();
  const { purchases, costs, sales } = useBookkeeping();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);

  function exportVehicles() {
    const headers = ["Make", "Model", "Registration", "Year", "Mileage", "Colour", "Buy Price", "Sell Price", "MOT Expiry"];
    const rows = vehicles.map((v) => [
      v.make, v.model, v.reg ?? "", v.year ?? "", v.mileage ?? "",
      v.colour ?? "", v.priceTrade ?? "", v.priceRetail ?? "", v.mot?.expiry ?? "",
    ]);
    downloadCSV(dated("flippilot-vehicles"), toCSV(headers, rows));
  }

  function exportPurchases() {
    const headers = ["Vehicle ID", "Purchase Price", "Source", "Date", "VAT Rate", "VAT Amount", "Net Amount"];
    const rows = purchases.map((p) => [p.vehicleId, p.purchasePrice, p.source ?? "", p.date, p.vatRate, p.vatAmount, p.netAmount]);
    downloadCSV(dated("flippilot-purchases"), toCSV(headers, rows));
  }

  function exportCosts() {
    const headers = ["Vehicle ID", "Type", "Label", "Category", "Amount", "Date"];
    const rows = costs.map((c) => [c.vehicleId, c.type, c.label ?? "", c.category ?? "", c.amount, c.date]);
    downloadCSV(dated("flippilot-costs"), toCSV(headers, rows));
  }

  function exportSales() {
    const headers = ["Vehicle ID", "Sale Price", "Buyer", "Invoice Number", "Date"];
    const rows = sales.map((s) => [s.vehicleId, s.salePrice, s.buyer ?? "", s.invoiceNumber, s.date]);
    downloadCSV(dated("flippilot-sales"), toCSV(headers, rows));
  }

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-5xl mx-auto">

      {/* HEADER */}
      <div data-tour="tour-settings">
        <SupernovaHeroHeader
          title="Dealer Settings & Preferences"
          subtitle="Configure your FlipPilot Dealer OS experience, preferences, and system behaviour."
        />
      </div>

      {/* Settings Grid */}
      <SupernovaSectionDivider label="Settings" />

      <section data-tour="tour-settings-cards" className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

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

        {/* Team — owner only, since inviting, re-roling or removing
            someone with access to your dealership's data is an
            ownership-level decision */}
        {user?.role === "owner" && (
          <SupernovaGlowCard>
            <h2 className="text-yellow-300 font-bold text-xl mb-3">Team</h2>
            <p className="text-white/70 mb-4">
              Invite a teammate into this dealership — they'll get their
              own login inside your workspace, not a separate one. Change
              what they can access, or remove them when they leave.
            </p>

            <div className="flex flex-wrap gap-2">
              <SupernovaGlowButton label="Invite Teammate" onClick={() => setShowInviteModal(true)} />
              <SupernovaGlowButton label="Manage Team" onClick={() => setShowManageTeamModal(true)} />
            </div>
          </SupernovaGlowCard>
        )}

        {/* Data Import — switching from a spreadsheet or another
            system shouldn't mean re-typing every vehicle/part by hand */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Data Import</h2>
          <p className="text-white/70 mb-4">
            Bring in your existing vehicle stock or parts/consumables list from a CSV file.
          </p>

          <SupernovaGlowButton label="Import from CSV" onClick={() => navigate("/import")} />
        </SupernovaGlowCard>

        {/* Data Export — a dealer's own data shouldn't be locked in;
            downloads real live vehicles/bookkeeping straight from what's
            already loaded, no backend round-trip needed. */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Data Export</h2>
          <p className="text-white/70 mb-4">
            Download your real stock list and bookkeeping records as CSV files — for a backup, or to
            move to another system.
          </p>

          <div className="flex flex-wrap gap-2">
            <SupernovaGlowButton label={`Vehicles (${vehicles.length})`} onClick={exportVehicles} />
            <SupernovaGlowButton label={`Purchases (${purchases.length})`} onClick={exportPurchases} />
            <SupernovaGlowButton label={`Costs (${costs.length})`} onClick={exportCosts} />
            <SupernovaGlowButton label={`Sales (${sales.length})`} onClick={exportSales} />
          </div>
        </SupernovaGlowCard>

        {/* Email Sending — owner only to configure, since connecting a
            real SendGrid account is a credential/billing-adjacent
            decision, same tier as Team invites. */}
        {user?.role === "owner" && (
          <SupernovaGlowCard>
            <h2 className="text-yellow-300 font-bold text-xl mb-3">Email Sending</h2>
            <p className="text-white/70 mb-4">
              Connect your own SendGrid account so FlipPilot can send real emails on your behalf — your domain, your
              bill, not shared with other dealers.
            </p>

            <SupernovaGlowButton label="Manage Email Sending" onClick={() => navigate("/dealer/settings/email")} />
          </SupernovaGlowCard>
        )}

        {/* Product Tour — the same guided walkthrough that runs
            automatically on a new account's first login, re-triggerable
            here for a returning dealer or a new team member. */}
        <SupernovaGlowCard>
          <h2 className="text-yellow-300 font-bold text-xl mb-3">Product Tour</h2>
          <p className="text-white/70 mb-4">
            Walk back through the main parts of FlipPilot — useful for a refresher, or to show a
            new team member around.
          </p>

          <SupernovaGlowButton label="Take the Tour" onClick={startTour} />
        </SupernovaGlowCard>

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
      {showManageTeamModal && <ManageTeamModal onClose={() => setShowManageTeamModal(false)} />}

    </div>
  );
}
