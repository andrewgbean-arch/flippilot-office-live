import { authHeaders } from "@/lib/authToken";
import { BASE_URL } from "@/lib/apiBaseUrl";

// The one rule every "load my data" call must follow: a failed read and
// an empty answer are different things. Providers that save the whole
// list back (jobs, leads, contacts, bookkeeping...) treat "empty" as
// "nothing there yet" and write over it, so a dropped connection that
// quietly came back as [] once cost a dealer their real data on the
// next ordinary save (see inventoryStorage.web.ts for the original).
//
// loadJson resolves to null for anything that isn't a successful,
// parseable answer: a network error, a 401/402/403/5xx, a body that
// isn't JSON. Callers must treat null as "could not read", never as
// "there is nothing".
export async function loadJson(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`GET ${path}: could not load`, err);
    return null;
  }
}

// For the `{ ok, items: [...] }` collections. An empty array means the
// server answered successfully and the list really is empty; null means
// it could not be read (including a 200 whose body isn't a list).
export async function loadList<T>(path: string): Promise<T[] | null> {
  const data = (await loadJson(path)) as { items?: unknown } | null;
  return Array.isArray(data?.items) ? (data.items as T[]) : null;
}
