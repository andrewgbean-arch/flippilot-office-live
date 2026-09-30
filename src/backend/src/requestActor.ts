import { AsyncLocalStorage } from "node:async_hooks";

// Who is making the current request, available anywhere while it runs (the
// change history in changeHistory.ts reads it when a record is saved, without
// every route having to pass the person along). requireAuth sets it once it
// knows who the signed-in person is. Requests with nobody signed in (the public
// booking form, webhooks, background tidy-ups) have no actor, and nothing they
// save is put in the change history.

export interface Actor {
  id: string;
  name: string;
  role: "owner" | "staff";
  staffRole?: string;
}

interface Context {
  actor: Actor;
  // While true, saves are not recorded (see withoutChangeHistory).
  quiet: boolean;
}

const store = new AsyncLocalStorage<Context>();

export function runAsActor<T>(actor: Actor, fn: () => T): T {
  return store.run({ actor, quiet: false }, fn);
}

/** The signed-in person making this request, or null (nobody, or history paused). */
export function currentActor(): Actor | null {
  const ctx = store.getStore();
  return ctx && !ctx.quiet ? ctx.actor : null;
}

/** The signed-in person making this request, even while history is paused. */
export function requestActor(): Actor | null {
  return store.getStore()?.actor ?? null;
}

/**
 * Saves made inside `fn` are not put in the change history: erasing a
 * customer's details must not copy them into the history on the way out.
 * Synchronous code only: an await inside would let other work run while paused.
 */
export function withoutChangeHistory<T>(fn: () => T): T {
  const ctx = store.getStore();
  if (!ctx) return fn();
  const before = ctx.quiet;
  ctx.quiet = true;
  try {
    return fn();
  } finally {
    ctx.quiet = before;
  }
}
