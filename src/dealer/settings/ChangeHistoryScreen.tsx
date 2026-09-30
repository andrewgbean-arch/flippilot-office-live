import { useEffect, useState, type FormEvent } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { useAuth } from "@/context/AuthContext";
import { fetchChangeHistory, type ChangeEntry, type ChangeHistoryPage, type FieldChange } from "@/lib/changeHistoryApi";

// Who changed what, when, and what it was before: every change anyone makes to
// stock, leads, customers, the books, jobs, the rota, pay and the team, kept for
// 90 days (the server's changeHistory.ts). The owner's alone: it covers
// managers too.

const FIELD_NAMES: Record<string, string> = {
  priceRetail: "Retail price",
  priceTrade: "Trade price",
  buyPrice: "Buy price",
  sellPrice: "Sell price",
  purchasePrice: "Purchase price",
  salePrice: "Sale price",
  reg: "Registration",
  vatScheme: "VAT scheme",
  vatRate: "VAT rate",
  vatAmount: "VAT",
  vatIncluded: "VAT included",
  staffRole: "Role",
  autoSignOutMinutes: "Automatic sign-out (minutes)",
  vatNumber: "VAT number",
  assignedToUserId: "Assigned to",
};

/** A stored field name as words: "priceRetail" → "Retail price", "bankAccountNumber" → "Bank account number". */
export function fieldName(field: string): string {
  if (FIELD_NAMES[field]) return FIELD_NAMES[field];
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const MONEY = /price|amount|cost|wage|salary|hourly|pay$|^vat$|net/i;

/** A value as it should read: money in pounds, the VAT rate as a percentage. */
export function fieldValue(field: string, value: string | undefined): string {
  if (value === undefined) return "nothing";
  const n = Number(value);
  if (value.trim() !== "" && Number.isFinite(n)) {
    if (/vatRate/i.test(field)) return `${Math.round(n * 1000) / 10}%`;
    if (/mileage/i.test(field)) return `${n.toLocaleString("en-GB")} miles`;
    if (MONEY.test(field)) return `£${n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  if (value === "true") return "yes";
  if (value === "false") return "no";
  return value;
}

const VERB: Record<ChangeEntry["action"], string> = { added: "added", changed: "changed", removed: "removed", note: "" };
const VERB_COLOUR: Record<ChangeEntry["action"], string> = {
  added: "text-green-400",
  changed: "text-yellow-300",
  removed: "text-red-400",
  note: "text-white/80",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function dayHeading(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function FieldLine({ change, action }: { change: FieldChange; action: ChangeEntry["action"] }) {
  const name = fieldName(change.field);
  // A removed record lists what it held; an added one or a note, what it is now.
  if (action !== "changed") {
    const value = action === "removed" ? change.before : change.after ?? change.before;
    return (
      <li>
        <span className="text-white/60">{name}:</span> {fieldValue(change.field, value)}
      </li>
    );
  }
  return (
    <li>
      <span className="text-white/60">{name}:</span>{" "}
      <span className="line-through text-white/50">{fieldValue(change.field, change.before)}</span>
      {" → "}
      <span className="text-white">{fieldValue(change.field, change.after)}</span>
    </li>
  );
}

export function ChangeRow({ entry }: { entry: ChangeEntry }) {
  // Someone joining the team is recorded as done by themselves.
  const joined = entry.area === "Team" && entry.action === "added" && entry.actorId !== null && entry.actorId === entry.recordId;
  if (joined) {
    return (
      <li className="py-3">
        <p className="text-sm">
          <span className="text-white/50 mr-2">{time(entry.at)}</span>
          <span className="font-semibold text-white">{entry.actorName}</span>{" "}
          <span className="font-semibold text-green-400">joined the team</span>
          <span className="text-white/60"> as {entry.actorRole}</span>
        </p>
      </li>
    );
  }
  return (
    <li className="py-3">
      <p className="text-sm">
        <span className="text-white/50 mr-2">{time(entry.at)}</span>
        <span className="font-semibold text-white">{entry.actorName}</span>
        <span className="text-white/50"> ({entry.actorRole})</span>{" "}
        {entry.action !== "note" && <span className={`font-semibold ${VERB_COLOUR[entry.action]}`}>{VERB[entry.action]} </span>}
        <span className="text-white/60">{entry.area}:</span> <span className="text-white">{entry.recordLabel}</span>
      </p>
      {entry.changes.length > 0 && (
        <>
          {entry.action === "removed" && <p className="text-white/50 text-xs mt-1">What it held:</p>}
          <ul className="mt-1 ml-4 text-sm space-y-0.5 break-words">
            {entry.changes.map((c) => (
              <FieldLine key={c.field} change={c} action={entry.action} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

const DAY_CHOICES = [
  { days: 1, label: "Today" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

const selectClass = "p-2 rounded bg-black/40 border border-white/10 text-white/80 text-sm";

export default function ChangeHistoryScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [days, setDays] = useState(30);
  const [person, setPerson] = useState("");
  const [area, setArea] = useState("");
  const [searchBox, setSearchBox] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<ChangeHistoryPage | null>(null);
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load() {
    setError(null);
    setPage(null);
    const res = await fetchChangeHistory({ days, person, area, search });
    if (!res.ok) return setError(res.error);
    setPage(res);
    setEntries(res.entries);
  }

  useEffect(() => {
    if (isOwner) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, days, person, area, search]);

  async function loadOlder() {
    if (!page?.nextBefore) return;
    setLoadingMore(true);
    const res = await fetchChangeHistory({ days, person, area, search, before: page.nextBefore });
    setLoadingMore(false);
    if (!res.ok) return setError(res.error);
    setPage(res);
    setEntries((all) => [...all, ...res.entries]);
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setSearch(searchBox);
  }

  // Grouped by day, newest first (the server sends them newest first).
  const groups: { day: string; items: ChangeEntry[] }[] = [];
  for (const entry of entries) {
    const day = dayHeading(entry.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-3xl mx-auto">
      <SupernovaHeroHeader title="Change History" subtitle="Who changed what, when, and what it was before. Kept for 90 days." />

      {!isOwner ? (
        <SupernovaGlowCard>
          <p className="text-white/70">Only the dealership owner can see the change history.</p>
        </SupernovaGlowCard>
      ) : (
        <>
          <SupernovaGlowCard className="mb-6">
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-white/60 text-xs flex flex-col gap-1">
                When
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectClass}>
                  {DAY_CHOICES.map((c) => (
                    <option key={c.days} value={c.days}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-white/60 text-xs flex flex-col gap-1">
                Who
                <select value={person} onChange={(e) => setPerson(e.target.value)} className={selectClass}>
                  <option value="">Everyone</option>
                  {(page?.people ?? []).filter((p) => p.id).map((p) => (
                    <option key={p.id!} value={p.id!}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-white/60 text-xs flex flex-col gap-1">
                What
                <select value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
                  <option value="">Everything</option>
                  {(page?.areas ?? []).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <form onSubmit={submitSearch} className="flex gap-2 items-end flex-1 min-w-[200px]">
                <label className="text-white/60 text-xs flex flex-col gap-1 flex-1">
                  Search
                  <input
                    value={searchBox}
                    onChange={(e) => setSearchBox(e.target.value)}
                    placeholder="A reg, a name, a price…"
                    className={`${selectClass} w-full`}
                  />
                </label>
                <button type="submit" className="px-4 py-2 min-h-[40px] rounded-full bg-yellow-400 text-black font-bold text-sm">
                  Search
                </button>
              </form>
            </div>
          </SupernovaGlowCard>

          {error && (
            <p className="text-red-400 text-sm mb-4" role="alert">
              {error}{" "}
              <button type="button" className="underline" onClick={load}>
                Try again
              </button>
            </p>
          )}

          {page === null && !error && <p className="text-white/50">Loading…</p>}

          {page !== null && entries.length === 0 && (
            <SupernovaGlowCard>
              <p className="text-white/70">No changes found. Try a longer time, or clear the search.</p>
            </SupernovaGlowCard>
          )}

          {groups.map((g) => (
            <SupernovaGlowCard key={g.day} className="mb-6">
              <h2 className="text-yellow-300 font-bold text-lg mb-1">{g.day}</h2>
              <ul className="divide-y divide-white/10">
                {g.items.map((entry) => (
                  <ChangeRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </SupernovaGlowCard>
          ))}

          {page?.nextBefore && (
            <div className="text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadOlder}
                className="px-5 py-2 min-h-[44px] rounded-full border border-yellow-400/60 text-yellow-300 text-sm disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Show older changes"}
              </button>
            </div>
          )}

          <p className="text-white/40 text-xs mt-6">
            Everyone on your team is told their changes are recorded. Changes are kept for {page?.keptDays ?? 90} days, then
            deleted. Anything that looks like a password, bank or identity number is never stored, only that it changed.
          </p>
        </>
      )}
    </div>
  );
}
