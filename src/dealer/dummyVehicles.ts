// src/dealer/dummyVehicles.ts

import type { Vehicle } from "../types/Vehicle";

export const dummyVehicles: Vehicle[] = [
  {
    id: "DM-001",
    make: "Vauxhall",
    model: "Corsa SE",
    year: 2017,
    mileage: 62000,
    priceRetail: 6995,
    priceTrade: 4500,
    marketHeat: 72,
    riskScore: 28,
    condition: "Good",
    mot: {
      expiry: "2025-04-12",
      advisories: ["Rear tyre close to limit"],
      historyScore: 70,
      history: [
        { date: "2024-04-10", year: 2024, result: "PASS", mileage: 62000, advisories: ["Rear tyre close to legal limit"], failures: [] },
        { date: "2023-04-08", year: 2023, result: "PASS", mileage: 54500, advisories: [], failures: [] }
      ]
    },
    depreciationCurve: [8500, 7800, 7200, 6995],
    finance: {
      apr: 12.9,
      depositMin: 250,
      lenderTier: "Near Prime",
    },
    img: "https://picsum.photos/400/240?random=201",

    status: "In Stock",
  },

  {
    id: "DM-002",
    make: "Peugeot",
    model: "208 Active",
    year: 2018,
    mileage: 54000,
    priceRetail: 7995,
    priceTrade: 5200,
    marketHeat: 75,
    riskScore: 24,
    condition: "Good",
    mot: {
      expiry: "2025-09-01",
      advisories: [],
      historyScore: 78,
      history: [
        { date: "2024-09-02", year: 2024, result: "PASS", mileage: 54000, advisories: [], failures: [] },
        { date: "2023-08-30", year: 2023, result: "PASS", mileage: 46500, advisories: [], failures: [] }
      ]
    },
    depreciationCurve: [9500, 8800, 8200, 7995],
    finance: {
      apr: 11.9,
      depositMin: 300,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=201"
,
    status: "In Stock",
  },

  {
    id: "DM-003",
    make: "Fiat",
    model: "500 Lounge",
    year: 2016,
    mileage: 72000,
    priceRetail: 5995,
    priceTrade: 3800,
    marketHeat: 68,
    riskScore: 33,
    condition: "Fair",
    mot: {
      expiry: "2025-02-18",
      advisories: ["Front pads worn"],
      historyScore: 65,
      history: [
        { date: "2024-02-20", year: 2024, result: "PASS", mileage: 72000, advisories: ["Front brake pads worn"], failures: [] },
        { date: "2023-02-18", year: 2023, result: "FAIL", mileage: 65500, advisories: [], failures: ["Front brake performance imbalanced across axle"] }
      ]
    },
    depreciationCurve: [7500, 6900, 6400, 5995],
    finance: {
      apr: 14.9,
      depositMin: 200,
      lenderTier: "Subprime",
    },
    img: "https://picsum.photos/400/240?random=203",
    status: "In Stock",
  },
];
