import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function isDuplicateFlip(
  existing: FlipRecord[],
  incoming: {
    title: string;
    barcode?: string | null;
  }
) {
  // 1️⃣ Barcode match (strongest)
  if (incoming.barcode) {
    const match = existing.find(
      (f) => f.barcode && f.barcode === incoming.barcode
    );
    if (match) return match;
  }

  // 2️⃣ Exact title match
  const exact = existing.find(
    (f) => f.title.trim().toLowerCase() === incoming.title.trim().toLowerCase()
  );
  if (exact) return exact;

  // 3️⃣ Fuzzy title match (loose)
  const loose = existing.find((f) =>
    f.title.toLowerCase().includes(incoming.title.toLowerCase())
  );
  if (loose) return loose;

  return null;
}
