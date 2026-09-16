import { useStaff } from "./StaffContext";
import "./StaffDashboard.css";

export default function PermissionsManager() {
  const { staff, updateStaff } = useStaff();

  async function togglePermission(id: string, perm: string) {
    const target = staff.find(s => s.id === id);
    if (!target) return;

    const perms = new Set(target.permissions || []);
    perms.has(perm) ? perms.delete(perm) : perms.add(perm);

    const error = await updateStaff({ ...target, permissions: Array.from(perms) });
    if (error) window.alert(error);
  }

  return (
    <div className="sn-panel sn-panel--full">
      <h2 className="sn-panel__title">Permissions Manager</h2>

      <div className="sn-permissions-grid">
        {staff.map(s => (
          <div key={s.id} className="sn-permissions-card">
            <div className="sn-permissions-name">{s.name}</div>
            <div className="sn-permissions-role">{s.role}</div>

            <div className="sn-permissions-list">
              {["view_sales", "edit_staff", "manage_branches"].map(perm => (
                <label key={perm} className="sn-perm-item">
                  <input
                    type="checkbox"
                    checked={s.permissions?.includes(perm) ?? false}
                    onChange={() => togglePermission(s.id, perm)}
                  />
                  {perm}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}