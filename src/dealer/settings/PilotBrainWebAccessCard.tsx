import { useEffect, useState } from "react";

import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "@/components/supernova/SupernovaGlowButton";
import {
  fetchWebAccess,
  setWebAccess,
  type WebAccessState,
  type WebSearchLogEntry,
} from "@/lib/pilotBrainWebApi";

// The URL comes from a web search result, so only a genuine web link
// is ever made clickable.
function isWebLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function SearchRow({ entry }: { entry: WebSearchLogEntry }) {
  return (
    <li className="p-3 rounded bg-black/40 border border-white/10">
      <p className="text-white/90 text-sm break-words">“{entry.query || "(no query recorded)"}”</p>
      <p className="text-white/40 text-xs mt-1">
        {when(entry.at)} · asked by {entry.askedByName || "someone"} ·{" "}
        {entry.errorCode ? (
          <span className="text-red-300">didn't run ({entry.errorCode.replace(/_/g, " ")})</span>
        ) : (
          `${entry.resultCount} result${entry.resultCount === 1 ? "" : "s"}`
        )}
      </p>
      {entry.sources.length > 0 && (
        <p className="text-xs mt-1 break-words">
          {entry.sources.slice(0, 4).map((s, i) => (
            <span key={s.url}>
              {i > 0 && <span className="text-white/30"> · </span>}
              {isWebLink(s.url) ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-yellow-300/90 underline">
                  {hostOf(s.url)}
                </a>
              ) : (
                <span className="text-white/50">{hostOf(s.url)}</span>
              )}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

// Owner-only switch for Pilot Brain's live web lookups. Shows the real
// state (on/off, today's allowance) and — the thing Pilot Brain itself
// asked for — a log of every search it has run and where it looked.
// Renders nothing when the dealership doesn't have Pilot Brain (the
// backend refuses the request), rather than a switch that can't work.
export default function PilotBrainWebAccessCard() {
  const [state, setState] = useState<WebAccessState | null>(null);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchWebAccess();
      if (cancelled) return;
      if (res.ok && res.state) setState(res.state);
      else setAvailable(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!state) return;
    setSaving(true);
    setError(null);
    const res = await setWebAccess(!state.enabled);
    setSaving(false);
    if (res.ok && res.state) setState(res.state);
    else setError(res.error || "Couldn't change that — try again.");
  }

  if (!available || !state) return null;

  return (
    <SupernovaGlowCard>
      <h2 className="text-yellow-300 font-bold text-xl mb-3">Pilot Brain Web Access</h2>
      <p className="text-white/70 mb-3">
        Let Wendy (Pilot Brain) look things up on the live web — like what similar cars are being advertised for on
        AutoTrader and other UK motor sites. She always shows her sources, and every search she runs is listed below.
      </p>

      <p className={`text-sm mb-1 font-semibold ${state.enabled ? "text-green-400" : "text-white/50"}`}>
        {state.enabled ? "Web access is ON" : "Web access is OFF"}
      </p>
      <p className="text-white/40 text-xs mb-4">
        {state.usedToday} of {state.dailyCap} searches used today. Listing prices are asking prices, not what cars
        actually sold for.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="mb-4">
        <SupernovaGlowButton
          label={saving ? "Saving…" : state.enabled ? "Turn Off" : "Turn On"}
          onClick={saving ? () => {} : toggle}
        />
      </div>

      <h3 className="text-white/80 text-sm font-semibold mb-2">Recent searches</h3>
      {state.recent.length === 0 ? (
        <p className="text-white/40 text-sm">No searches yet.</p>
      ) : (
        <ul className="space-y-2">
          {state.recent.map((entry) => (
            <SearchRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </SupernovaGlowCard>
  );
}
