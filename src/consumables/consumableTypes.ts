export interface Consumable {
  id: string;
  name: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  unit?: string;
  currentStock: number;
  reorderThreshold: number;
  notes?: string;
  updatedAt: string;
}
