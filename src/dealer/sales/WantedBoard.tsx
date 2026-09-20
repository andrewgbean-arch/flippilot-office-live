import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDealer } from "@/context/DealerContext";
import { deleteWanted, loadWanted, setWantedStatus, type WantedItem, type WantedStatus } from "@/lib/wantedApi";
import { askedText, budgetText, contactLinks, groupWanted, keptUntil, matchText, wantText } from "./wantedBoardModel";
import "@/staff/StaffDashboard.css";

type Load = { kind: "loading" } | { kind: "failed"; message: string; forbidden: boolean } | { kind: "ready"; items: WantedItem[]; retentionDays: number };

// People who asked, on the store page, to be told when the dealer gets a car.
// Nothing is sent from here: each person can be called, texted or emailed from
// the dealer's own phone or email app, with the message ready to read first.
export default function WantedBoard() {
  const { user } = useAuth();
  const { dealer } = useDealer();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const res = await loadWanted();
    if (res.ok && res.data) setLoad({ kind: "ready", items: res.data.items, retentionDays: res.data.retentionDays });
    else if (res.status === 403) setLoad({ kind: "failed", forbidden: true, message: res.error || "Your account role doesn't have access to this." });
    else setLoad({ kind: "failed", forbidden: false, message: "Couldn't load the list. Nothing has been lost; please try again." });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const storeUrl = user?.dealershipId ? `${window.location.origin}/store/${user.dealershipId}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link is shown in plain text either way.
    }
  }

  const groups = load.kind === "ready" ? groupWanted(load.items) : null;

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Wanted Cars</h1>
          <p className="sn-hero__subtitle">People who asked, on your store page, to be told when you get a car.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <h2 className="sn-panel__title">How this works</h2>
          <p className="sn-timeclock__subtitle">
            When a customer can&apos;t see the car they want, your store page lets them tell you what they&apos;re after. It lands here, and your sales team
            and managers get a notification. When you get a car that fits, it shows up below with a ready-to-send message.{" "}
            <strong>Nothing is sent for you</strong>: you choose who to contact and how. Each person agreed to be contacted about this, and their details are
            forgotten {load.kind === "ready" ? Math.round(load.retentionDays / 30.4) : 12} months after they last asked.
          </p>
          {storeUrl && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 13, color: "#c7d0ff" }}>{storeUrl}</code>
              <button className="sn-btn sn-btn--gold" onClick={copyLink}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          )}
        </section>

        {load.kind === "loading" && (
          <section className="sn-panel sn-panel--full">
            <p className="sn-empty">Loading…</p>
          </section>
        )}

        {load.kind === "failed" && (
          <section className="sn-panel sn-panel--full">
            <p role="alert" style={{ color: "#f87171" }}>
              {load.message}
            </p>
            {!load.forbidden && (
              <button className="sn-btn sn-btn--ghost" style={{ marginTop: 8 }} onClick={() => void refresh()}>
                Try again
              </button>
            )}
          </section>
        )}

        {groups && load.kind === "ready" && (
          <>
            {load.items.length === 0 && (
              <section className="sn-panel sn-panel--full">
                <p className="sn-empty">Nobody has asked yet. Share your store page and they will.</p>
              </section>
            )}
            <Section title="Waiting for a car you have" items={groups.waitingWithCar} retentionDays={load.retentionDays} dealerName={dealer?.name ?? ""} onChanged={refresh} highlight />
            <Section title="Waiting" items={groups.waiting} retentionDays={load.retentionDays} dealerName={dealer?.name ?? ""} onChanged={refresh} />
            <Section title="Contacted" items={groups.contacted} retentionDays={load.retentionDays} dealerName={dealer?.name ?? ""} onChanged={refresh} />
            <Section title="Closed" items={groups.closed} retentionDays={load.retentionDays} dealerName={dealer?.name ?? ""} onChanged={refresh} />
          </>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  items,
  retentionDays,
  dealerName,
  onChanged,
  highlight = false,
}: {
  title: string;
  items: WantedItem[];
  retentionDays: number;
  dealerName: string;
  onChanged: () => Promise<void>;
  highlight?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">
        {title} — {items.length}
      </h2>
      <div className="sn-leave-list">
        {items.map(item => (
          <WantedRow key={item.id} item={item} retentionDays={retentionDays} dealerName={dealerName} onChanged={onChanged} highlight={highlight} />
        ))}
      </div>
    </section>
  );
}

export function WantedRow({
  item,
  retentionDays,
  dealerName,
  onChanged,
  highlight,
}: {
  item: WantedItem;
  retentionDays: number;
  dealerName: string;
  onChanged: () => Promise<void>;
  highlight: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Prefer a car that is within their budget for the ready-made message.
  const bestMatch = item.matches.find(m => m.overBudgetBy === undefined) ?? item.matches[0];
  const links = contactLinks(item, dealerName, bestMatch?.label);
  const budget = budgetText(item.maxPrice);

  async function changeStatus(status: WantedStatus) {
    setBusy(true);
    setError(null);
    const res = await setWantedStatus(item.id, status);
    if (!res.ok) setError(res.error || "Couldn't save that. Try again.");
    else await onChanged();
    setBusy(false);
  }

  async function forget() {
    setBusy(true);
    setError(null);
    const res = await deleteWanted(item.id);
    if (!res.ok) {
      setError(res.error || "Couldn't remove them. Try again.");
      setBusy(false);
      setConfirming(false);
    } else {
      await onChanged();
    }
  }

  const small = { padding: "4px 10px", fontSize: 12 } as const;

  return (
    <div className="sn-recent-lead" style={{ alignItems: "flex-start", ...(highlight ? { borderLeft: "3px solid #facc15" } : {}) }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sn-recent-lead__name">
          {item.name} — {wantText(item)}
          {budget ? ` · ${budget}` : ""}
        </div>
        {item.note && item.make && <div className="sn-recent-lead__status">“{item.note}”</div>}
        <div className="sn-recent-lead__status">
          Asked {askedText(item.askedAt)} · <span title={item.consent.wording}>agreed to be contacted</span> · kept until {keptUntil(item.askedAt, retentionDays)}
        </div>
        <div className="sn-recent-lead__status">
          {[item.phone, item.email].filter(Boolean).join(" · ")}
        </div>

        {item.matches.length > 0 && item.status !== "closed" && (
          <div style={{ marginTop: 8 }}>
            <div className="sn-recent-lead__status" style={{ marginBottom: 4, color: "#facc15" }}>
              You have {item.matches.length === 1 ? "a car" : `${item.matches.length} cars`} that fit:
            </div>
            {item.matches.map(m => (
              <div key={m.vehicleId} className="sn-recent-lead__status">
                <Link to={`/dealer/inventory/${encodeURIComponent(m.vehicleId)}`} style={{ color: "#c7d0ff", textDecoration: "underline" }}>
                  {matchText(m)}
                </Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {links.call && (
            <a className="sn-btn sn-btn--gold" style={small} href={links.call}>
              Call
            </a>
          )}
          {links.text && (
            <a className="sn-btn sn-btn--ghost" style={small} href={links.text}>
              Text
            </a>
          )}
          {links.email && (
            <a className="sn-btn sn-btn--ghost" style={small} href={links.email}>
              Email
            </a>
          )}
          {item.status === "waiting" && (
            <button className="sn-btn sn-btn--ghost" style={small} disabled={busy} onClick={() => void changeStatus("contacted")}>
              Mark contacted
            </button>
          )}
          {item.status !== "waiting" && (
            <button className="sn-btn sn-btn--ghost" style={small} disabled={busy} onClick={() => void changeStatus("waiting")}>
              Back to waiting
            </button>
          )}
          {item.status !== "closed" && (
            <button className="sn-btn sn-btn--ghost" style={small} disabled={busy} onClick={() => void changeStatus("closed")}>
              Close
            </button>
          )}
          {!confirming ? (
            <button className="sn-btn sn-btn--ghost" style={small} disabled={busy} onClick={() => setConfirming(true)}>
              Forget this person
            </button>
          ) : (
            <>
              <span className="sn-recent-lead__status" style={{ alignSelf: "center" }}>
                Delete their details for good?
              </span>
              <button className="sn-btn sn-btn--gold" style={small} disabled={busy} onClick={() => void forget()}>
                Yes, delete
              </button>
              <button className="sn-btn sn-btn--ghost" style={small} disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
        {error && (
          <div role="alert" style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
