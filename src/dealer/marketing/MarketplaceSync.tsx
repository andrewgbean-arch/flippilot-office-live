import { useEffect, useState } from "react";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { useAuth } from "@/context/AuthContext";

import { BASE_URL } from "@/lib/apiBaseUrl";

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

// What a portal needs from the dealer, with no "Connected" badge: the old badge
// turned on from a server-wide environment variable that nothing in the app
// uses, so it would have been false for every dealer.
export function PlatformCard({ label, platform }: { label: string; platform: PlatformStatus }) {
  return (
    <SupernovaGlowCard>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white">{label}</h3>
      </div>
      <p className="text-white/60 text-sm">{platform.note}</p>
    </SupernovaGlowCard>
  );
}

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
        subtitle="Download your stock as a CSV feed, or copy its link, for the portals you use."
      />

      <SupernovaSectionDivider label="Live Now" />

      <SupernovaGlowCard>
        <h3 className="text-xl font-bold text-yellow-300 mb-2">
          Generic CSV Stock Feed
        </h3>
        <p className="text-white/70 text-sm mb-4">
          A CSV file of the stock you have not sold, built from your
          inventory each time it is opened. No account or API key needed.
          Download it to upload by hand to a portal that takes CSV uploads,
          or give the link to a portal that has agreed to collect a feed
          from you. FlipPilot does not send your stock to any portal for you.
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

      <SupernovaSectionDivider label="Direct Portal Connections: Not Available Yet" />

      <p className="text-white/60 text-sm">
        FlipPilot cannot send your stock to these portals yet. This is what
        each one needs from you.
      </p>

      {loading && <p className="text-white/60">Checking platform status…</p>}

      {status?.ok &&
        Object.entries(status.platforms)
          .filter(([key]) => key !== "genericFeed")
          .map(([key, platform]) => (
            <PlatformCard key={key} label={PLATFORM_LABELS[key] ?? key} platform={platform} />
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
