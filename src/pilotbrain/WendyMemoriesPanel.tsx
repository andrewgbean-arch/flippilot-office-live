import { useEffect, useState } from "react";
import { fetchMyMemories, forgetMyMemories, type PilotBrainMemory } from "@/lib/pilotBrainApi";

// "What Wendy remembers about you": the facts Pilot Brain has kept about the
// signed-in person, each one deletable, plus a two-click "forget everything"
// (the same arm-then-confirm pattern as Clear Conversation).
export default function WendyMemoriesPanel({ onClose }: { onClose: () => void }) {
  const [memories, setMemories] = useState<PilotBrainMemory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyMemories().then(result => {
      if (cancelled) return;
      if (!result.ok) setError(result.error ?? "Couldn't load what Wendy remembers.");
      else setMemories(result.memories);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function forget(id?: string) {
    if (!id && !confirmingAll) {
      setConfirmingAll(true);
      return;
    }
    setConfirmingAll(false);
    setBusy(id ?? "all");
    setError(null);
    const result = await forgetMyMemories(id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Couldn't forget that. Please try again.");
      return;
    }
    setMemories(current => (id ? (current ?? []).filter(m => m.id !== id) : []));
  }

  return (
    <section
      aria-label="What Wendy remembers about you"
      style={{
        maxWidth: 800, width: "100%", margin: "10px auto 0", boxSizing: "border-box",
        border: "1px solid rgba(255,215,0,0.25)", borderRadius: 12, padding: "12px 14px",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#ffd84d", margin: 0, flex: 1 }}>What Wendy remembers about you</h2>
        <button onClick={onClose} className="sn-btn" style={{ fontSize: 12, padding: "4px 10px" }}>
          Close
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#f5f7ffa0", margin: "6px 0 10px" }}>
        Wendy keeps short notes about you to make her answers more useful. Only you can see them. Forget any you don't want her to keep.
      </p>

      {error && <p role="alert" style={{ fontSize: 13, color: "#ff8080", margin: "0 0 8px" }}>{error}</p>}

      {memories === null && !error ? (
        <p className="sn-empty">Loading…</p>
      ) : memories !== null && memories.length === 0 ? (
        <p className="sn-empty">Wendy isn't keeping any notes about you.</p>
      ) : memories !== null ? (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {memories.map(m => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#f5f7ff" }}>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{m.fact}</span>
                <button
                  onClick={() => forget(m.id)}
                  disabled={busy !== null}
                  className="sn-btn"
                  aria-label={`Forget: ${m.fact}`}
                  style={{ fontSize: 12, padding: "3px 10px", flexShrink: 0 }}
                >
                  {busy === m.id ? "Forgetting…" : "Forget"}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => forget()}
            onBlur={() => setConfirmingAll(false)}
            disabled={busy !== null}
            className="sn-btn"
            style={{
              fontSize: 12, padding: "4px 10px", marginTop: 10,
              background: confirmingAll ? "rgba(255,80,80,0.2)" : undefined,
              borderColor: confirmingAll ? "rgba(255,80,80,0.5)" : undefined,
              color: confirmingAll ? "#ff8080" : undefined,
            }}
          >
            {busy === "all" ? "Forgetting…" : confirmingAll ? "Click again to confirm" : "Forget everything"}
          </button>
        </>
      ) : null}
    </section>
  );
}
