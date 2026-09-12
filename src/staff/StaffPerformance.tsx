import { useStaff } from "./StaffContext";

export default function StaffPerformance() {
  const { staff } = useStaff();

  const performance = staff.map(s => ({
    name: s.name,
    role: s.role,
    score: Math.floor(Math.random() * 40) + 60, // placeholder cosmic score
  }));

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Staff Performance</h2>

      <div className="sn-performance-grid">
        {performance.map((p, i) => (
          <div key={i} className="sn-performance-card">
            <div className="sn-performance-name">{p.name}</div>
            <div className="sn-performance-role">{p.role}</div>

            <div className="sn-performance-score">
              {p.score}
            </div>

            <div className="sn-performance-bar">
              <div
                className="sn-performance-fill"
                style={{ width: `${p.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
