import { useEffect, useState } from "react";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { SupernovaSectionDivider } from "@/components/supernova/SupernovaSectionDivider";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import { useAuth } from "@/context/AuthContext";

import { BASE_URL } from "@/lib/apiBaseUrl";
import { authHeaders } from "@/lib/authToken";

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
  // The URL carries a secret ?token= the server generates per dealership —
  // dealershipId alone isn't enough to keep this feed private (it's the
  // same id shown on the public storefront link), so it's fetched from the
  // server rather than built here from dealershipId like the old version
  // did.
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedUrlError, setFeedUrlError] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  function loadFeedUrl() {
    setFeedUrlError(false);
    fetch(`${BASE_URL}/syndication/feed-url`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => setFeedUrl(data.feedUrl))
      .catch(() => setFeedUrlError(true));
  }

  useEffect(() => {
    if (!user) return;
    loadFeedUrl();
  }, [user]);

  useEffect(() => {
    fetch(`${BASE_URL}/syndication/status`)
      .then(res => res.json())
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  function copyFeedUrl() {
    if (!feedUrl) return;
    setCopyFailed(false);
    navigator.clipboard.writeText(feedUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // A browser can refuse clipboard access (permissions policy, an
      // embedded context, an older browser) — without this the button
      // would silently do nothing, leaving the dealer thinking it's
      // broken rather than telling them to select and copy it by hand.
      () => setCopyFailed(true)
    );
  }

  function regenerateFeedUrl() {
    setRegenerating(true);
    fetch(`${BASE_URL}/syndication/regenerate-token`, { method: "POST", headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => setFeedUrl(data.feedUrl))
      .catch(() => setFeedUrlError(true))
      .finally(() => setRegenerating(false));
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
          {user?.role === "owner" && (
            <button
              onClick={regenerateFeedUrl}
              disabled={regenerating}
              className="px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white/70 font-semibold hover:bg-black/60 transition disabled:opacity-50"
            >
              {regenerating ? "Getting a new link…" : "Get a New Link"}
            </button>
          )}
        </div>
        {feedUrlError && (
          <p className="text-red-400 text-sm mt-3">
            Couldn't get your feed link. <button onClick={loadFeedUrl} className="underline">Try again</button>.
          </p>
        )}
        {copyFailed && feedUrl && (
          <div className="mt-3">
            <p className="text-red-400 text-sm mb-1">
              Couldn't copy automatically — select the link below and copy it yourself.
            </p>
            <input
              readOnly
              value={feedUrl}
              onFocus={e => e.currentTarget.select()}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white/80 text-xs"
            />
          </div>
        )}
        {user?.role === "owner" && (
          <p className="text-white/40 text-xs mt-3">
            Only share this link with a portal you actually use — whoever has it can read your live stock. If it's ever shared by mistake, press Get a New Link to shut off the old one.
          </p>
        )}
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
