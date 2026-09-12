import { CarRecord } from "@/features/vehicles/models/CarRecord";

// ⭐ Load dealer stock
export function getDealerStock(): CarRecord[] {
  const raw = localStorage.getItem("flippilot_cars");
  return raw ? JSON.parse(raw) : [];
}

// ⭐ Save dealer stock
export function saveDealerStock(stock: CarRecord[]) {
  localStorage.setItem("flippilot_cars", JSON.stringify(stock));
}

// ⭐ Seed dealer stock once
export function seedDealerStock() {
  const existing = getDealerStock();
  if (existing.length > 0) return existing;

  const seeded: CarRecord[] = [
    {
      id: "1",
      make: "Ford",
      model: "Fiesta",
      year: 2016,
      mileage: 72000,
      purchasePrice: 2800,
      valuation: 3500,
    },
    {
      id: "2",
      make: "BMW",
      model: "118d",
      year: 2014,
      mileage: 98000,
      purchasePrice: 4200,
      valuation: 5200,
    },
  ];

  saveDealerStock(seeded);
  return seeded;
}

// ⭐ Optional alias (keeps your old code working)
export const loadCars = getDealerStock;


