// What the public Car Passport endpoint returns (see the backend's
// engines/carPassport.ts, which decides what a stranger may see). Anything not
// here isn't sent.

export interface PassportDealer {
  name: string;
  phone?: string;
  address?: string;
}

export type MotResult = "pass" | "fail" | "unknown";

export interface PassportMotTest {
  date?: string;
  year?: number;
  result: MotResult;
  mileage?: number;
  advisories: string[];
  failures: string[];
}

export interface PassportMot {
  expiry?: string;
  state: "valid" | "expired" | "unknown";
  daysLeft?: number;
  tests: PassportMotTest[];
}

export interface PassportMarket {
  averageAsking: number;
  lowest?: number;
  highest?: number;
  listings: number;
  checkedOn: string;
  difference: number;
  basis: "make and model";
}

export interface PassportCar {
  id: string;
  year?: number;
  make: string;
  model: string;
  mileage?: number;
  colour?: string;
  reg?: string;
  fuelType?: string;
  askingPrice: number | null;
  images: string[];
}

export interface AvailablePassport {
  sold: false;
  dealer: PassportDealer;
  car: PassportCar;
  mot?: PassportMot;
  emissions?: { fuelType: string; euroStatus?: string };
  market?: PassportMarket;
  workDone: string[];
  note?: string;
  generatedAt: string;
}

export interface SoldPassport {
  sold: true;
  dealer: PassportDealer;
  car: { year?: number; make: string; model: string };
}

export type PublicPassport = AvailablePassport | SoldPassport;
