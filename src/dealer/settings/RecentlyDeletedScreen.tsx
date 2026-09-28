import { useEffect, useState } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { useAuth } from "@/context/AuthContext";
import { deleteForGood, fetchRecentlyDeleted, restoreDeleted, type DeletedItem, type DeletedList } from "@/lib/recentlyDeletedApi";

const LIST_NAMES: Record<DeletedList, string> = {
  leads: "Leads",
  jobs: "Jobs",
  contacts: "Contacts",
  consumables: "Consumables",
};
const ORDER: DeletedList[] = ["leads", "jobs", "contacts", "consumables"];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Anything removed from leads, jobs, contacts or consumables waits here for
// 30 days: put it back, or delete it for good (for example when someone asks
// for their details to be removed). Owner and managers only, as on the server.
export default function RecentlyDeletedScreen() {
  const { user } = useAuth();
  const allowed = user?.role === "owner" || user?.staffRole === "manager";

  const [items, setItems] = useState<DeletedItem[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetchRecentlyDeleted();
    if (res.ok) {
      setItems(res.items);
      setDays(res.keptForDays);
    } else {
      setItems(null);
      setError(res.error);
    }
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  async function restore(item: DeletedItem) {
    setBusyId(item.id);
    setNote(null);
    const res = await restoreDeleted(item.id);
    setBusyId(null);
    if (!res.ok) return setError(res.error);
    setNote(res.alreadyThere ? `“${item.label}” was already back in ${LIST_NAMES[item.list]}.` : `“${item.label}” is back in ${LIST_NAMES[item.list]}.`);
    setItems((all) => (all ?? []).filter((i) => i.id !== item.id));
  }

  async function remove(item: DeletedItem) {
    if (!window.confirm(`Delete “${item.label}” for good? It can't be brought back after this.`)) return;
    setBusyId(item.id);
    setNote(null);
    const res = await deleteForGood(item.id);
    setBusyId(null);
    if (!res.ok) return setError(res.error);
    setNote(`“${item.label}” has been deleted for good.`);
    setItems((all) => (all ?? []).filter((i) => i.id !== item.id));
  }

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-3xl mx-auto">
      <SupernovaHeroHeader title="Recently deleted" subtitle={`Leads, jobs, contacts and consumables removed in the last ${days} days`} />

      {!allowed ? (
        <SupernovaGlowCard>
          <p className="text-white/70">Only the owner or a manager can see and restore deleted items. Ask one of them if you removed something by mistake.</p>
        </SupernovaGlowCard>
      ) : (
        <>
          {error && (
            <p className="text-red-400 text-sm mb-4" role="alert">
              {error}{" "}
              <button type="button" className="underline" onClick={load}>
                Try again
              </button>
            </p>
          )}
          {note && <p className="text-green-400 text-sm mb-4" role="status">{note}</p>}

          {items === null && !error && <p className="text-white/50">Loading…</p>}

          {items !== null && items.length === 0 && (
            <SupernovaGlowCard>
              <p className="text-white/70">Nothing has been deleted in the last {days} days.</p>
            </SupernovaGlowCard>
          )}

          {items !== null &&
            ORDER.filter((list) => items.some((i) => i.list === list)).map((list) => (
              <SupernovaGlowCard key={list} className="mb-6">
                <h2 className="text-yellow-300 font-bold text-xl mb-3">{LIST_NAMES[list]}</h2>
                <ul className="divide-y divide-white/10">
                  {items
                    .filter((i) => i.list === list)
                    .map((item) => (
                      <li key={item.id} className="py-3 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[180px]">
                          <p className="text-white font-semibold">{item.label}</p>
                          <p className="text-white/50 text-xs">
                            Removed by {item.deletedBy}, {when(item.deletedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => restore(item)}
                          className="px-4 py-2 min-h-[44px] rounded-full bg-yellow-400 text-black font-bold text-sm disabled:opacity-50"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => remove(item)}
                          className="px-4 py-2 min-h-[44px] rounded-full border border-red-400/60 text-red-300 text-sm disabled:opacity-50"
                        >
                          Delete for good
                        </button>
                      </li>
                    ))}
                </ul>
              </SupernovaGlowCard>
            ))}
        </>
      )}
    </div>
  );
}
