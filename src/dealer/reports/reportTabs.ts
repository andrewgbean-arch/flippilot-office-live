// The Reports area: one set of tabs across the reports that used to sit in
// three separate menu groups (Intelligence, Analytics, Risk) and showed the
// same figures on several pages. Each tab is an existing report page; the
// menu's Reports group and the tab bar both come from this list.
export const REPORT_TABS: { to: string; label: string; also?: string[] }[] = [
  { to: "/dealer/analytics", label: "Overview" },
  { to: "/dealer/intelligence/motors", label: "Stock", also: ["/dealer/analytics/inventory"] },
  { to: "/dealer/intelligence/crm", label: "Sales & Leads", also: ["/dealer/analytics/sales"] },
  { to: "/dealer/analytics/lead-conversion", label: "Lead Sources" },
  { to: "/dealer/intelligence/risk", label: "MOT & Risk" },
  { to: "/dealer/analytics/staff", label: "Staff", also: ["/dealer/analytics/branches"] },
];

// Which tab a report page belongs to (a tab's own page, or one of its "also" pages).
export function reportTabFor(pathname: string): string | null {
  for (const t of REPORT_TABS) if (t.to === pathname || t.also?.includes(pathname)) return t.to;
  return null;
}
