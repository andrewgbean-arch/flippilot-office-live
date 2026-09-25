import type { AuthUser } from "@/context/AuthContext";
import { canManageStaff, canSeeMoney, canSeeWanted, isOwner } from "./permissions";

// Which pages need more than a login, in one list: the menu leaves out what
// someone can't open, and the page frame shows a plain "not for your role"
// panel if they reach one anyway (a bookmark, a link a colleague sent). The
// server refuses the data regardless; this keeps the screens honest about it.

export type PageNeed = "money" | "staff" | "owner" | "wanted";

const PAGE_NEEDS: { prefix: string; need: PageNeed }[] = [
  { prefix: "/bookkeeping", need: "money" },
  { prefix: "/dealer/finance/profit-breakdown", need: "money" },
  { prefix: "/dealer/workflow/recon", need: "money" },
  // a car's parts and labour costs, and a purchase source's figures, are the books
  { prefix: "/dealer/inventory/parts-labour", need: "money" },
  { prefix: "/supplier", need: "money" },
  { prefix: "/dealer/staff/add", need: "staff" },
  // the server answers 403 to everyone else (requireStaffRole("manager"))
  { prefix: "/pilot-brain/decisions", need: "staff" },
  { prefix: "/dealer/sales/wanted", need: "wanted" },
  { prefix: "/billing", need: "owner" },
];

export const NEED_WHO: Record<PageNeed, string> = {
  money: "the owner, managers and finance",
  staff: "the owner and managers",
  owner: "the dealership owner",
  wanted: "sales, managers and the owner",
};

const CHECK: Record<PageNeed, (user: AuthUser | null) => boolean> = {
  money: canSeeMoney,
  staff: canManageStaff,
  owner: isOwner,
  wanted: canSeeWanted,
};

// What a page at this address needs, or null when any login will do.
export function pageNeed(path: string): PageNeed | null {
  const hit = PAGE_NEEDS.find(p => path === p.prefix || path.startsWith(`${p.prefix}/`));
  return hit ? hit.need : null;
}

export function canOpenPage(user: AuthUser | null, path: string): boolean {
  const need = pageNeed(path);
  return need === null || CHECK[need](user);
}
