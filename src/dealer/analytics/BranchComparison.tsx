import { useStaff } from "@/staff/StaffContext";

// "Branch" only exists as a field on staff records — vehicles and leads
// aren't tagged by branch anywhere in the data model, so a genuine sales/
// inventory-per-branch comparison isn't possible yet. This shows the one
// real branch breakdown that IS possible (staffing), and says so plainly
// rather than the bare "add your logic here" stub this used to be.
export default function BranchComparison() {
  const { staff } = useStaff();

  const branches = staff.reduce((acc, s) => {
    const branch = s.branch || "Unassigned";
    if (!acc[branch]) acc[branch] = { total: 0, active: 0 };
    acc[branch].total += 1;
    if (s.active) acc[branch].active += 1;
    return acc;
  }, {} as Record<string, { total: number; active: number }>);

  const branchNames = Object.keys(branches).sort();

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold text-yellow-300 mb-2">Branch Comparison</h1>
      <p className="text-white/60 mb-6">
        Staffing by branch — the only field tagged by branch today.
        Vehicle and lead records aren't linked to a branch yet, so
        sales/inventory comparison per branch isn't available.
      </p>

      {branchNames.length === 0 ? (
        <p className="text-white/50">
          No staff with a branch assigned yet. Add one from Staff → Add Staff.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {branchNames.map((name) => (
            <div
              key={name}
              className="bg-black/40 border border-yellow-400/20 rounded-xl p-6"
            >
              <h2 className="text-yellow-300 font-bold text-lg mb-3">{name}</h2>
              <p className="text-white/70">
                {branches[name]!.total} staff total
              </p>
              <p className="text-white/70">
                {branches[name]!.active} active
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
