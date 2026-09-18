// A small shared registry of "this data couldn't be loaded", so ONE
// banner (LoadErrorBanner, in DealerLayout) can tell the dealer instead
// of every screen quietly showing an empty list. Providers report into
// it through useGuardedLoad.
//
// Deliberately a module-level store read with useSyncExternalStore
// rather than another context provider: nothing has to be wrapped in
// main.tsx, and a screen rendered without it just shows no banner
// (saves are still blocked by the guard) instead of crashing.
export interface LoadFailureEntry {
  id: string;
  // Shown in the banner, e.g. "jobs".
  label: string;
  retry: () => Promise<void>;
}

const entries = new Map<string, LoadFailureEntry>();
const listeners = new Set<() => void>();
// useSyncExternalStore needs the same array back until something changes.
let snapshot: readonly LoadFailureEntry[] = [];

function emit() {
  snapshot = [...entries.values()];
  listeners.forEach(listener => listener());
}

export function reportLoadFailure(entry: LoadFailureEntry) {
  entries.set(entry.id, entry);
  emit();
}

export function clearLoadFailure(id: string) {
  if (entries.delete(id)) emit();
}

export function subscribeToLoadFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLoadFailures(): readonly LoadFailureEntry[] {
  return snapshot;
}

// "jobs", "jobs and leads", "jobs, leads and rota"
export function listLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
