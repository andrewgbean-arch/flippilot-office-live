import { useState } from "react";
import { useDiary } from "@/context/DiaryContext";
import { toDateKey, addDays, formatDayLabel } from "@/planner/dateUtils";
import "@/staff/StaffDashboard.css";

export default function DiaryBoard() {
  const { entries, loading, addEntry, updateEntry, removeEntry } = useDiary();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [text, setText] = useState("");
  const [isTask, setIsTask] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateKey = toDateKey(selectedDate);
  const isToday = dateKey === toDateKey(new Date());
  const dayEntries = entries
    .filter(e => e.date === dateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  async function handleAdd() {
    if (!text.trim()) {
      setError("Write something before adding it.");
      return;
    }
    setError(null);
    const err = await addEntry({ date: dateKey, text: text.trim(), isTask });
    if (err) {
      setError(err);
      return;
    }
    setText("");
  }

  async function handleToggleDone(id: string, done: boolean) {
    const err = await updateEntry(id, { done });
    if (err) setError(err);
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic">
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Diary</h1>
          <p className="sn-hero__subtitle">Your own reminders, to-dos and notes — private to you, separate from bookings and the rota.</p>
        </div>
      </header>

      <main className="sn-grid">
        <section className="sn-panel sn-panel--full">
          <div className="sn-rota-header">
            <button className="sn-btn sn-btn--ghost" onClick={() => setSelectedDate(d => addDays(d, -1))}>
              ← Prev
            </button>
            <h2 className="sn-panel__title" style={{ margin: "0 16px" }}>
              {isToday ? "Today — " : ""}{formatDayLabel(selectedDate)}
            </h2>
            <button className="sn-btn sn-btn--ghost" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              Next →
            </button>
            {!isToday && (
              <button
                className="sn-btn sn-btn--ghost"
                style={{ marginLeft: 12 }}
                onClick={() => setSelectedDate(new Date())}
              >
                Jump to Today
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 12 }}>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="Add a reminder, to-do, or note for this day..."
              className="sn-input"
              style={{ flex: 1 }}
            />
            <label className="sn-checkbox-row" style={{ marginTop: 0, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={isTask} onChange={e => setIsTask(e.target.checked)} />
              To-do
            </label>
            <button className="sn-btn sn-btn--gold" onClick={handleAdd}>
              Add
            </button>
          </div>
          {error && <p className="sn-empty" style={{ color: "#ff8080" }}>{error}</p>}

          {loading ? (
            <p className="sn-empty">Loading…</p>
          ) : dayEntries.length === 0 ? (
            <p className="sn-empty">Nothing on this day yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEntries.map(entry => (
                <div
                  key={entry.id}
                  className="sn-recent-lead"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <label className="sn-checkbox-row" style={{ marginTop: 0, flex: 1, gap: 10 }}>
                    {entry.isTask ? (
                      <input
                        type="checkbox"
                        checked={entry.done}
                        onChange={e => handleToggleDone(entry.id, e.target.checked)}
                      />
                    ) : (
                      <span style={{ width: 16, display: "inline-block", textAlign: "center" }}>•</span>
                    )}
                    <span style={{ textDecoration: entry.done ? "line-through" : "none", opacity: entry.done ? 0.5 : 1 }}>
                      {entry.text}
                    </span>
                  </label>
                  <button
                    className="sn-btn sn-btn--danger"
                    style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                    onClick={() => removeEntry(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
