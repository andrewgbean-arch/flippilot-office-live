import { useCallback, useEffect, useRef, useState } from "react";
import { LoadGuard } from "@/lib/loadGuard";
import { clearLoadFailure, reportLoadFailure } from "@/lib/loadFailures";

interface Options<T> {
  // Stable name for this data: keys its banner entry and prefixes logs.
  id: string;
  // What the banner calls it, e.g. "jobs".
  label: string;
  // The login this data belongs to (the dealershipId). Falsy = nobody is
  // logged in.
  key: string | undefined;
  // Real server data, or null if it couldn't be read (see loadJson.ts).
  load: () => Promise<T | null>;
  // Put real server data into the provider's state.
  apply: (data: T) => void;
  // Empty the provider's state.
  clear: () => void;
}

// Loads a provider's data for the current login and decides when it is
// safe to save it back. Every provider that replaces a whole server list
// with its in-memory copy needs the same three rules, which is why they
// live here once instead of in each provider:
//
//  1. A failed load must not look like an empty list. It is reported to
//     the shared banner (LoadErrorBanner) with a retry, and saving stays
//     blocked, so the next ordinary save can't overwrite the real data.
//  2. Whatever is in memory belongs to the login it was loaded for. When
//     the login changes it is dropped, and a slow response for the old
//     login can't land in the new one.
//  3. A failed REFRESH keeps this login's last-good data and keeps saving
//     enabled; only a failed FIRST load blocks (see LoadGuard.fail).
//
// Providers call guardSave() at the top of every write that would replace
// a whole list, and bail out when it returns false.
export function useGuardedLoad<T>(options: Options<T>) {
  const [guard] = useState(() => new LoadGuard());
  const [loading, setLoading] = useState(true);

  // Providers pass fresh closures every render; reading the latest ones
  // through a ref keeps `reload` stable, so it can sit in the banner.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  // A named function expression, so a failed load can hand this same
  // function to the banner as its retry.
  const reload = useCallback(async function reload(): Promise<void> {
    const { id, label, load, apply } = latest.current;
    const seq = guard.begin();
    setLoading(true);

    let data: T | null = null;
    try {
      data = await load();
    } catch (err) {
      console.error(`${id}: load threw`, err);
    }

    if (data === null) {
      const outcome = guard.fail(seq);
      if (outcome === "superseded") return; // the login changed while this was in flight
      if (outcome === "blocked") {
        reportLoadFailure({ id, label, retry: reload });
      } else {
        console.warn(`${id}: refresh failed, keeping the data already loaded for this login.`);
      }
      setLoading(false);
      return;
    }

    if (!guard.isCurrent(seq)) return; // superseded
    // Saving is only enabled once the data is actually in state.
    apply(data);
    guard.succeed(seq);
    clearLoadFailure(id);
    setLoading(false);
  }, [guard]);

  // Was `[]` in every provider: fetched once at app boot and never again,
  // so a client-side login (no page reload) kept whatever the brief
  // unauthenticated moment before it had produced. Keying on the login
  // reloads exactly when it changes.
  useEffect(() => {
    // Whatever is in memory now belongs to whoever was logged in before
    // (or to nobody): never to be saved into this account.
    guard.invalidate();
    options.clear();

    if (!options.key) {
      clearLoadFailure(options.id);
      setLoading(false);
      return;
    }

    void reload();
    return () => {
      guard.invalidate();
      clearLoadFailure(options.id);
    };
  }, [options.key]);

  // True when it is safe to replace the server's list with the one in
  // memory. Logs a warning when it isn't so a dropped save is traceable.
  const guardSave = useCallback((): boolean => {
    if (guard.canSave) return true;
    console.warn(
      `${latest.current.id} not saved: it hasn't loaded successfully, and saving now could overwrite what the server already has.`
    );
    return false;
  }, [guard]);

  return { loading, reload, guardSave };
}
