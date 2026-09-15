export type ContactCategory =
  | "parts_supplier"
  | "auction_house"
  | "transport"
  | "valeting"
  | "other";

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  parts_supplier: "Parts Supplier",
  auction_house: "Auction House",
  transport: "Transport / Recovery",
  valeting: "Valeting",
  other: "Other",
};

export interface Contact {
  id: string;
  name: string;
  category: ContactCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  updatedAt: string;
}
