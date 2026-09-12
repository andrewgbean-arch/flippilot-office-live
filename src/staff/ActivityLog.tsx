import { useStaff } from "./StaffContext";

export default function ActivityLog() {
  const { staff } = useStaff();

  const logs = staff
    .filter(s => s.lastActive)
    .map(s => ({
      name: s.name,
      role: s.role,
      time: s.lastActive!,
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Activity Log</h2>

      <div className="sn-activity-log">
        {logs.map((log, i) => (
          <div key={i} className="sn-activity-item">
            <div className="sn-activity-name">{log.name}</div>
            <div className="sn-activity-role">{log.role}</div>
            <div className="sn-activity-time">
              {new Date(log.time).toLocaleString()}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <p className="sn-empty">No activity recorded yet.</p>
        )}
      </div>
    </div>
  );
}
