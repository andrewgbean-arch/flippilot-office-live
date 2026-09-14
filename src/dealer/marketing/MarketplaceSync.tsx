import { useEffect, useState } from "react";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = "http://localhost:4001";

type PlatformStatus = {
  available: boolean;
  method: string;
  note: string;
};

type StatusResponse = {
  ok: boolean;
  platforms: Record<string, PlatformStatus>;
};

const PLATFORM_LABELS: Record<string, string> = {
  genericFeed: "Generic CSV Stock Feed",
  autotrader: "AutoTrader",
  motorsCoUk: "Motors.co.uk",
  ebayMotors: "eBay Motors",
  gumtree: "Gumtree",
};

export default function MarketplaceSync() {
  const { user } = useAuth();
  // Was a single hardcoded URL reading a global, disconnected
  // collection — every dealer got the same (always-empty) feed. Real
  // per-dealer inventory only exists scoped by dealershipId, so the
  // feed URL has to be too.
  const feedUrl = user ? `${BASE_URL}/syndication/${user.dealershipId}/feed.csv` : null;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/syndication/status`)
      .then(res => res.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  function copyFeedUrl() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="px-6 py-10 space-y-10">
      <SupernovaHeroHeader
        title="Marketplace Sync"
        subtitle="Push your stock to AutoTrader, Motors.co.uk, eBay Motors and other portals."
      />

      <SupernovaSectionDivider label="Live Now" />

      <SupernovaGlowCard>
        <h3 className="text-xl font-bold text-yellow-300 mb-2">
          Generic CSV Stock Feed
        </h3>
        <p className="text-white/70 text-sm mb-4">
          Works right now, no account or API key needed. Several portals
          (including Motors.co.uk) accept a stock feed like this directly —
          point their feed importer at this URL, or download it and upload
          manually.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          {feedUrl && (
            <a
              href={feedUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
            >
              Download Feed
            </a>
          )}
          <button
            onClick={copyFeedUrl}
            disabled={!feedUrl}
            className="px-4 py-2 rounded-lg bg-black/40 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-black/60 transition disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy Feed URL"}
          </button>
        </div>
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="Needs a Business Account First" />

      {loading && <p className="text-white/60">Checking platform status…</p>}

      {status?.ok &&
        Object.entries(status.platforms)
          .filter(([key]) => key !== "genericFeed")
          .map(([key, platform]) => (
            <SupernovaGlowCard key={key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white">
                  {PLATFORM_LABELS[key] ?? key}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    platform.available
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60"
                      : "bg-white/10 text-white/50 border border-white/20"
                  }`}
                >
                  {platform.available ? "Connected" : "Not Connected"}
                </span>
              </div>
              <p className="text-white/60 text-sm">{platform.note}</p>
            </SupernovaGlowCard>
          ))}

      {!loading && !status?.ok && (
        <SupernovaGlowCard>
          <p className="text-white/60 text-sm">
            Couldn't reach the sync status service — is the backend running?
          </p>
        </SupernovaGlowCard>
      )}
    </div>
  );
}
