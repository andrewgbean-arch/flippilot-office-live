export interface StockMovement {
  id: string;
  type: "receive" | "adjust";
  quantity: number;
  date: string;
  cost?: number;
  supplier?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

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
  movements?: StockMovement[];
  updatedAt: string;
}
