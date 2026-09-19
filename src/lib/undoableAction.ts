// "Do this in a few seconds, unless they change their mind" — the countdown
// behind Delete Vehicle's Undo toast, kept out of the component on purpose.
//
// The version in EditVehicle read a `pendingDelete` flag from inside a
// setInterval callback. That callback closed over the value from the render in
// which Delete Forever was clicked (false), and setting the flag afterwards
// never changed it, so the delete never ran: the toast said "Vehicle Deleted",
// the car stayed in stock, and stayed on the public store page. Here nothing is
// read from a render at all: the countdown owns its own state, and the
// component just calls start / undo / flush.
//
// `T` is what the action is FOR (the vehicle's id), captured when it starts, so
// it can't end up applying to a different vehicle if the screen is reused.

export type CommitReason =
  | "expired" // the countdown ran out
  | "closed"; // the screen went away first, so it happens now rather than not at all

export interface UndoableAction<T> {
  // Begin the countdown. Ignored if one is already running.
  start(payload: T): void;
  // They changed their mind: nothing happens, and the timer is stopped.
  undo(): void;
  // The screen is closing: if a countdown is running, do it now.
  flush(): void;
  isPending(): boolean;
}

export interface UndoableActionOptions<T> {
  seconds: number;
  onTick: (secondsLeft: number) => void;
  onCommit: (payload: T, reason: CommitReason) => void;
}

export function createUndoableAction<T>(options: UndoableActionOptions<T>): UndoableAction<T> {
  let timer: ReturnType<typeof setInterval> | null = null;
  let pending: { payload: T } | null = null;
  let secondsLeft = 0;

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function commit(reason: CommitReason) {
    if (pending === null) return;
    const { payload } = pending;
    pending = null;
    stop();
    options.onCommit(payload, reason);
  }

  return {
    start(payload) {
      if (pending !== null) return;
      pending = { payload };
      secondsLeft = options.seconds;
      options.onTick(secondsLeft);
      timer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft > 0) {
          options.onTick(secondsLeft);
          return;
        }
        options.onTick(0);
        commit("expired");
      }, 1000);
    },

    undo() {
      pending = null;
      stop();
    },

    flush() {
      commit("closed");
    },

    isPending: () => pending !== null,
  };
}
