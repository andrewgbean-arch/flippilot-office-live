// src/dealer/advancedDealerInventory.ts

import type { Vehicle } from "../types/Vehicle";

export const advancedDealerInventory: Vehicle[] = [
  {
    id: "VX-1001",
    make: "BMW",
    model: "M140i Shadow Edition",
    year: 2019,
    mileage: 41000,
    priceRetail: 22995,
    priceTrade: 19750,
    marketHeat: 92,
    riskScore: 18,
    condition: "Excellent",
    mot: {
      expiry: "2025-11-12",
      advisories: ["Front brake pads wearing thin"],
      historyScore: 88,
      history: [
        { year: 2024, result: "Pass", advisories: ["Front brake pads wearing thin"] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [26500, 24900, 23800, 22995],
    finance: {
      apr: 9.9,
      depositMin: 1500,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=101",
    status: "In Stock",
  },

  {
    id: "VX-1002",
    make: "Audi",
    model: "S3 Quattro",
    year: 2018,
    mileage: 52000,
    priceRetail: 21495,
    priceTrade: 18500,
    marketHeat: 87,
    riskScore: 22,
    condition: "Good",
    mot: {
      expiry: "2025-06-01",
      advisories: [],
      historyScore: 91,
      history: [
        { year: 2024, result: "Pass", advisories: [] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [25500, 23900, 22500, 21495],
    finance: {
      apr: 10.9,
      depositMin: 1000,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=102",
    status: "Reserved",
  },

  {
    id: "VX-1003",
    make: "Mercedes",
    model: "A45 AMG",
    year: 2017,
    mileage: 69000,
    priceRetail: 23995,
    priceTrade: 20500,
    marketHeat: 78,
    riskScore: 34,
    condition: "Good",
    mot: {
      expiry: "2025-03-18",
      advisories: ["Oil leak minor", "Rear tyre close to limit"],
      historyScore: 72,
      history: [
        { year: 2024, result: "Pass", advisories: ["Oil leak minor"] },
        { year: 2023, result: "Fail", advisories: ["Rear tyre close to limit"] }
      ]
    },
    depreciationCurve: [28900, 26500, 24900, 23995],
    finance: {
      apr: 12.9,
      depositMin: 2000,
      lenderTier: "Near Prime",
    },
    img: "https://picsum.photos/400/240?random=103",
    status: "In Stock",
  },

  {
    id: "VX-1004",
    make: "Volkswagen",
    model: "Golf GTI Performance",
    year: 2020,
    mileage: 28000,
    priceRetail: 24995,
    priceTrade: 22500,
    marketHeat: 95,
    riskScore: 12,
    condition: "Excellent",
    mot: {
      expiry: "2026-01-09",
      advisories: [],
      historyScore: 94,
      history: [
        { year: 2024, result: "Pass", advisories: [] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [28900, 26900, 25900, 24995],
    finance: {
      apr: 8.9,
      depositMin: 500,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=104",
    status: "In Prep",
  },

  {
    id: "VX-1005",
    make: "Ford",
    model: "Fiesta ST-3",
    year: 2016,
    mileage: 84000,
    priceRetail: 9995,
    priceTrade: 7500,
    marketHeat: 82,
    riskScore: 41,
    condition: "Fair",
    mot: {
      expiry: "2025-09-22",
      advisories: ["Corrosion on rear springs"],
      historyScore: 68,
      history: [
        { year: 2024, result: "Pass", advisories: ["Corrosion on rear springs"] },
        { year: 2023, result: "Fail", advisories: ["Spring corrosion"] }
      ]
    },
    depreciationCurve: [14500, 12900, 11200, 9995],
    finance: {
      apr: 14.9,
      depositMin: 500,
      lenderTier: "Subprime",
    },
    img: "https://picsum.photos/400/240?random=105",
    status: "In Stock",
  },

  {
    id: "VX-1006",
    make: "Toyota",
    model: "Yaris Hybrid Icon",
    year: 2021,
    mileage: 19000,
    priceRetail: 16995,
    priceTrade: 15000,
    marketHeat: 98,
    riskScore: 9,
    condition: "Excellent",
    mot: {
      expiry: "2026-04-14",
      advisories: [],
      historyScore: 97,
      history: [
        { year: 2024, result: "Pass", advisories: [] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [18900, 17900, 17400, 16995],
    finance: {
      apr: 7.9,
      depositMin: 500,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=106",
    status: "In Stock",
  },

  {
    id: "VX-1007",
    make: "Tesla",
    model: "Model 3 Long Range",
    year: 2020,
    mileage: 33000,
    priceRetail: 27995,
    priceTrade: 25000,
    marketHeat: 89,
    riskScore: 15,
    condition: "Excellent",
    mot: {
      expiry: "2025-12-01",
      advisories: [],
      historyScore: 93,
      history: [
        { year: 2024, result: "Pass", advisories: [] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [32900, 30900, 29500, 27995],
    finance: {
      apr: 6.9,
      depositMin: 2000,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=107",
    status: "In Stock",
  },

  {
    id: "VX-1008",
    make: "Range Rover",
    model: "Sport HSE SDV6",
    year: 2015,
    mileage: 98000,
    priceRetail: 22995,
    priceTrade: 19000,
    marketHeat: 74,
    riskScore: 55,
    condition: "Fair",
    mot: {
      expiry: "2025-07-30",
      advisories: ["Suspension bush worn", "Oil leak"],
      historyScore: 61,
      history: [
        { year: 2024, result: "Fail", advisories: ["Suspension bush worn"] },
        { year: 2023, result: "Pass", advisories: ["Oil leak"] }
      ]
    },
    depreciationCurve: [34500, 30900, 26900, 22995],
    finance: {
      apr: 15.9,
      depositMin: 3000,
      lenderTier: "Subprime",
    },
    img: "https://picsum.photos/400/240?random=108",
    status: "In Stock",
  },

  {
    id: "VX-1009",
    make: "Honda",
    model: "Civic Type R FK8",
    year: 2019,
    mileage: 45000,
    priceRetail: 28995,
    priceTrade: 25500,
    marketHeat: 96,
    riskScore: 19,
    condition: "Excellent",
    mot: {
      expiry: "2025-10-11",
      advisories: [],
      historyScore: 90,
      history: [
        { year: 2024, result: "Pass", advisories: [] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [32900, 30900, 29900, 28995],
    finance: {
      apr: 9.9,
      depositMin: 1500,
      lenderTier: "Prime",
    },
    img: "https://picsum.photos/400/240?random=109",
    status: "In Stock",
  },

  {
    id: "VX-1010",
    make: "Hyundai",
    model: "i30N Performance",
    year: 2018,
    mileage: 56000,
    priceRetail: 19995,
    priceTrade: 17000,
    marketHeat: 88,
    riskScore: 27,
    condition: "Good",
    mot: {
      expiry: "2025-08-05",
      advisories: ["Front discs worn"],
      historyScore: 84,
      history: [
        { year: 2024, result: "Pass", advisories: ["Front discs worn"] },
        { year: 2023, result: "Pass", advisories: [] }
      ]
    },
    depreciationCurve: [23900, 22500, 20900, 19995],
    finance: {
      apr: 11.9,
      depositMin: 1000,
      lenderTier: "Near Prime",
    },
    img: "https://picsum.photos/400/240?random=110",
    status: "In Stock",
  },
];
