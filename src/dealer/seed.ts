import { CarRecord } from "@/features/vehicles/models/CarRecord";
import { saveDealerStock } from "@/backend/car/carStorage.web";

export async function seedDealerStock() {
  const now = new Date().toISOString();

  const stock: CarRecord[] = [
    {
      id: "D1",
      make: "Ford",
      model: "Fiesta 1.0 EcoBoost",
      year: 2018,
      mileage: 52000,
      reg: "AB18FFF",

      purchasePrice: 4500,

      sold: false,
      // optional fields → use undefined instead of null


      condition: "good",
      notes: "Seed vehicle",

      mot: {
        expiry: "2026-09-12",
        advisories: [],
        failures: [],
      },

      valuation: 6200,

      createdAt: now,
    },

    {
      id: "D2",
      make: "BMW",
      model: "320d M Sport",
      year: 2017,
      mileage: 78000,
      reg: "BM17MSP",

      purchasePrice: 9000,

      sold: false,

      condition: "excellent",
      notes: "Seed vehicle",

      mot: {
        expiry: "2026-08-01",
        advisories: [],
        failures: [],
      },

      valuation: 11500,

      createdAt: now,
    }
  ];

  await saveDealerStock(stock);
}
