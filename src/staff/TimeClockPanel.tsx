import { useState } from "react";
import { useTimeClock } from "@/context/TimeClockContext";
import type { TimeEntry } from "@/timekeeping/timeTypes";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hoursWorked(entry: TimeEntry): string {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
  return ((end - start) / (1000 * 60 * 60)).toFixed(1);
}

export default function TimeClockPanel() {
  const { entries, loading, myOpenEntry, clockIn, clockOut } = useTimeClock();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const todayKey = new Date().toDateString();
  const todaysEntries = entries
    .filter(e => new Date(e.clockIn).toDateString() === todayKey)
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  async function handleClick() {
    setBusy(true);
    setError(null);
    const err = myOpenEntry ? await clockOut() : await clockIn();
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <section className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Time Clock</h2>

      <div className="sn-timeclock">
        <div className="sn-timeclock__status">
          {myOpenEntry ? (
            <span className="sn-timeclock__badge sn-timeclock__badge--in">
              Clocked in since {formatTime(myOpenEntry.clockIn)}
            </span>
          ) : (
            <span className="sn-timeclock__badge sn-timeclock__badge--out">Not clocked in</span>
          )}
          <button
            className={`sn-btn ${myOpenEntry ? "sn-btn--danger" : "sn-btn--gold"}`}
            onClick={handleClick}
            disabled={busy || loading}
          >
            {busy ? "..." : myOpenEntry ? "Clock Out" : "Clock In"}
          </button>
        </div>

        {error && <p className="sn-timeclock__error">{error}</p>}

        <h3 className="sn-timeclock__subtitle">Today's Log</h3>
        {todaysEntries.length === 0 ? (
          <p className="sn-empty">No one has clocked in today yet.</p>
        ) : (
          <table className="sn-timeclock__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {todaysEntries.map(e => (
                <tr key={e.id}>
                  <td>{e.userName}</td>
                  <td>{formatTime(e.clockIn)}</td>
                  <td>{e.clockOut ? formatTime(e.clockOut) : "In progress"}</td>
                  <td>{hoursWorked(e)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
