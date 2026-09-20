import { useEffect, useState } from "react";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import { fetchSecurityLog, unlockPerson, type SecurityEvent, type SecurityLog } from "@/lib/pilotBrainSecurityApi";

const KIND_LABEL: Record<SecurityEvent["kind"], string> = {
  blocked_message: "Turned away",
  lockout: "Chat paused",
  reply_withheld: "Reply withheld",
  memory_rejected: "Refused to remember",
  probing: "Repeated probing",
};

const KIND_STYLE: Record<SecurityEvent["kind"], string> = {
  blocked_message: "text-yellow-300",
  lockout: "text-red-300",
  reply_withheld: "text-orange-300",
  memory_rejected: "text-orange-300",
  probing: "text-yellow-300",
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EventRow({ event }: { event: SecurityEvent }) {
  return (
    <li className="p-3 rounded bg-black/40 border border-white/10">
      <p className="text-sm">
        <span className={`font-semibold ${KIND_STYLE[event.kind]}`}>{KIND_LABEL[event.kind]}</span>
        <span className="text-white/60"> · {event.userName} · {when(event.at)}</span>
      </p>
      {/* what was actually typed: shown as plain text, never as markup */}
      <p className="text-white/80 text-sm mt-1 break-words">{event.snippet || "(nothing recorded)"}</p>
      {event.categories.length > 0 && (
        <p className="text-white/60 text-xs mt-1">{event.categories.map(c => c.replace(/_/g, " ")).join(" · ")}</p>
      )}
    </li>
  );
}

// What the card shows, separate from fetching it, so it can be tested.
export function SecurityLogView({
  log,
  error,
  busy,
  onUnlock,
}: {
  log: SecurityLog | null;
  error: string | null;
  busy: string | null;
  onUnlock: (userId: string) => void;
}) {
  return (
    <SupernovaGlowCard>
      <h2 className="text-yellow-300 font-bold text-xl mb-3">Pilot Brain Security</h2>
      <p className="text-white/70 mb-3">
        Wendy turns away attempts to get around her rules, pull out her instructions, or plant false "facts". Anything she
        refuses is listed here, along with who tried and what they typed. Someone who keeps trying is paused for 30
        minutes.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {log && log.locked.length > 0 && (
        <div className="mb-4">
          <h3 className="text-white/80 text-sm font-semibold mb-2">Paused right now</h3>
          <ul className="space-y-2">
            {log.locked.map(p => (
              <li key={p.userId} className="p-3 rounded bg-black/40 border border-red-400/30 flex items-center justify-between gap-3">
                <span className="text-sm text-white/90">
                  {p.userName} <span className="text-white/60">· until {when(p.until)}</span>
                </span>
                <SupernovaGlowButton label={busy === p.userId ? "Working…" : "Lift pause"} onClick={busy ? () => {} : () => onUnlock(p.userId)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="text-white/80 text-sm font-semibold mb-2">Recent events</h3>
      {!log ? (
        <p className="text-white/60 text-sm">{error ? "" : "Loading…"}</p>
      ) : log.events.length === 0 ? (
        <p className="text-white/60 text-sm">Nothing so far. No one has tried to get around Wendy's rules.</p>
      ) : (
        <ul className="space-y-2">
          {log.events.map(e => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </SupernovaGlowCard>
  );
}

// Owner-only. Shows what Pilot Brain's protections have turned away, so the
// owner can see who is fishing, and lets them lift a pause early.
export default function PilotBrainSecurityCard() {
  const [log, setLog] = useState<SecurityLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetchSecurityLog();
    if (res.ok && res.data) {
      setLog(res.data);
      setError(null);
    } else {
      setError(res.error || "Couldn't load the security log.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unlock(userId: string) {
    setBusy(userId);
    const res = await unlockPerson(userId);
    setBusy(null);
    if (!res.ok) setError(res.error || "Couldn't lift that pause.");
    await load();
  }

  return <SecurityLogView log={log} error={error} busy={busy} onUnlock={unlock} />;
}
