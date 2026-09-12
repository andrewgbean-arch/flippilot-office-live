import { CarRecord } from "@/types/carTypes";

const KEY = "flippilot_cars";

/** Load all cars */
export function loadCars(): CarRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save all cars */
export function saveCars(cars: CarRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(cars));
}

/** Add a new car */
export function addCar(car: CarRecord) {
  const cars = loadCars();
  cars.push(car);
  saveCars(cars);
}

/** Delete a car */
export function deleteCar(id: string) {
  const cars = loadCars().filter((c) => c.id !== id);
  saveCars(cars);
}

/** Update a car */
export function updateCar(updated: CarRecord) {
  const cars = loadCars().map((c) => (c.id === updated.id ? updated : c));
  saveCars(cars);
}
