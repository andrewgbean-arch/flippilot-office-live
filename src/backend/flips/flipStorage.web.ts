export type FlipRecord = {
  id: string;
  title: string;
  barcode: string | null;
  image: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  profit: number | null;
  roi: number | null;
  confidence: number | null;
  date: string;
  favourite: boolean;
};

const STORAGE_KEY = "flippilot_history";

/** Load flip history */
export function loadFlipHistory(): FlipRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save flip history */
export function saveFlipHistory(history: FlipRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** Add a flip record */
export function saveFlipRecord(record: FlipRecord) {
  const history = loadFlipHistory();
  const updated = [record, ...history];
  saveFlipHistory(updated);
  return true;
}

/** Delete a flip record */
export function deleteFlipRecord(id: string) {
  const history = loadFlipHistory().filter((f) => f.id !== id);
  saveFlipHistory(history);
}

/** Update a flip record */
export function updateFlipRecord(updated: FlipRecord) {
  const history = loadFlipHistory().map((f) =>
    f.id === updated.id ? updated : f
  );
  saveFlipHistory(history);
}
