export interface Consumable {
  id: string;
  name: string;
  partNumber?: string;
  description?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  unit?: string;
  currentStock: number;
  reorderThreshold: number;
  notes?: string;
  updatedAt: string;
}
