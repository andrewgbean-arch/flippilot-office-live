import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWatcher, type WatcherResult } from "@/lib/pilotBrainApi";

function healthColor(score: number): string {
  if (score >= 75) return "text-green-300 border-green-400/40";
  if (score >= 50) return "text-yellow-300 border-yellow-400/40";
  return "text-red-300 border-red-400/40";
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-red-400/40 bg-red-500/10 text-red-200",
  warning: "border-yellow-400/40 bg-yellow-500/10 text-yellow-200",
  info: "border-white/20 bg-white/5 text-white/70",
};

// V2 (Watcher) — the dashboard's own "Boss, I noticed something"
// surface. Fetching this is also what triggers the real notification
// side-effect on the backend (see pilotBrain.ts) since there's no
// scheduler in this app — loading the dashboard is what "runs the watch".
export default function PilotBrainWatcherCard() {
  const navigate = useNavigate();
  const [watcher, setWatcher] = useState<WatcherResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatcher().then((data) => {
      setWatcher(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-black/20 border border-white/10 rounded-xl p-6 backdrop-blur-xl">
        <p className="text-white/40 text-sm">Pilot Brain is checking your business…</p>
      </div>
    );
  }

  if (!watcher) return null; // not configured / unreachable — quietly omit rather than show a broken card

  const topAlerts = [...watcher.alerts]
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 4);

  return (
    <div
      onClick={() => navigate("/pilot-brain")}
      className="bg-black/20 border border-white/10 rounded-xl p-6 backdrop-blur-xl cursor-pointer hover:border-yellow-400/30 transition"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-yellow-300 font-bold text-lg">Pilot Brain — Watching</h2>
        <div className={`px-3 py-1 rounded-lg border text-sm font-bold ${healthColor(watcher.health.overall)}`}>
          {watcher.health.overall}/100
        </div>
      </div>

      {topAlerts.length === 0 && watcher.risks.length === 0 ? (
        <p className="text-white/60 text-sm">Nothing needs your attention right now — everything's on track.</p>
      ) : (
        <div className="space-y-2">
          {topAlerts.map((a) => (
            <div key={a.sourceKey} className={`px-3 py-2 rounded-lg border text-sm ${SEVERITY_STYLE[a.severity]}`}>
              <span className="font-semibold">{a.title}:</span> {a.message}
            </div>
          ))}
          {watcher.risks.map((r) => (
            <div key={r.title} className="px-3 py-2 rounded-lg border border-orange-400/40 bg-orange-500/10 text-orange-200 text-sm">
              <span className="font-semibold">{r.title}:</span> {r.message}
            </div>
          ))}
        </div>
      )}

      <p className="text-white/30 text-xs mt-4">Tap to talk to Pilot Brain about any of this.</p>
    </div>
  );
}
