// A tiny stand-in for React's hooks, so a provider component (a plain
// function that calls useState / useEffect / useRef / useCallback) can be
// RUN from an ordinary test with no DOM, and its saves observed.
//
// Why it exists: the data-loss bugs this repo keeps hitting live in the
// providers' glue (load, keep the result, decide whether a later save is
// allowed) rather than in any pure function, and the repo has no jsdom or
// test renderer. Tests substitute these hooks for React's with vi.mock
// ("react"), then mount a real provider, drive it and read the context value
// it renders. Everything else (the provider, useGuardedLoad, LoadGuard, the
// storage modules) is the real code.
//
// Deliberately small. It mimics the parts of React's behaviour the providers
// depend on: state survives between renders, a setState re-renders in a
// microtask (batched, like React), effects run after a render when their
// dependencies changed and are cleaned up before they re-run or on unmount.

type Deps = readonly unknown[] | undefined;

function sameDeps(previous: Deps, next: Deps): boolean {
  if (previous === undefined || next === undefined) return false; // no deps = every render
  if (previous.length !== next.length) return false;
  return previous.every((value, i) => Object.is(value, next[i]));
}

interface StateSlot<T> {
  value: T;
  set: (next: T | ((previous: T) => T)) => void;
}
interface RefSlot<T> {
  current: T;
}
interface EffectSlot {
  deps: Deps;
  ran: boolean;
  cleanup: (() => void) | undefined;
}
interface MemoSlot {
  deps: Deps;
  value: unknown;
}

class Instance<P, R> {
  readonly slots: unknown[] = [];
  private cursor = 0;
  private queuedEffects: (() => void)[] = [];
  private scheduled = false;
  unmounted = false;
  result!: R;

  constructor(
    private readonly component: (props: P) => R,
    public props: P
  ) {}

  nextIndex(): number {
    return this.cursor++;
  }

  queueEffect(run: () => void) {
    this.queuedEffects.push(run);
  }

  render() {
    const outer = active;
    active = this as unknown as Instance<unknown, unknown>;
    this.cursor = 0;
    this.queuedEffects = [];
    try {
      this.result = this.component(this.props);
    } finally {
      active = outer;
    }
    const effects = this.queuedEffects;
    this.queuedEffects = [];
    for (const run of effects) run();
  }

  // A state change re-renders in a microtask, so several setState calls in
  // a row (or across an await) coalesce into one render, as they do in React.
  schedule() {
    if (this.unmounted || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (!this.unmounted) this.render();
    });
  }

  unmount() {
    this.unmounted = true;
    for (const slot of this.slots) {
      const effect = slot as Partial<EffectSlot> | undefined;
      if (effect && "cleanup" in effect && effect.cleanup) {
        effect.cleanup();
        effect.cleanup = undefined;
      }
    }
  }
}

let active: Instance<unknown, unknown> | null = null;

function current(): Instance<unknown, unknown> {
  if (!active) throw new Error("A hook was called outside a mounted component.");
  return active;
}

export function useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
  const instance = current();
  const index = instance.nextIndex();
  if (index >= instance.slots.length) {
    const slot: StateSlot<T> = {
      value: typeof initial === "function" ? (initial as () => T)() : initial,
      set: next => {
        const value = typeof next === "function" ? (next as (previous: T) => T)(slot.value) : next;
        if (Object.is(value, slot.value)) return;
        slot.value = value;
        instance.schedule();
      },
    };
    instance.slots[index] = slot;
  }
  const slot = instance.slots[index] as StateSlot<T>;
  return [slot.value, slot.set];
}

export function useRef<T>(initial: T): RefSlot<T> {
  const instance = current();
  const index = instance.nextIndex();
  if (index >= instance.slots.length) instance.slots[index] = { current: initial } satisfies RefSlot<T>;
  return instance.slots[index] as RefSlot<T>;
}

export function useEffect(effect: () => void | (() => void), deps?: Deps): void {
  const instance = current();
  const index = instance.nextIndex();
  if (index >= instance.slots.length) {
    instance.slots[index] = { deps: undefined, ran: false, cleanup: undefined } satisfies EffectSlot;
  }
  const slot = instance.slots[index] as EffectSlot;
  if (slot.ran && sameDeps(slot.deps, deps)) return;
  instance.queueEffect(() => {
    slot.cleanup?.();
    slot.cleanup = undefined;
    slot.ran = true;
    slot.deps = deps;
    const cleanup = effect();
    slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export function useMemo<T>(factory: () => T, deps: Deps): T {
  const instance = current();
  const index = instance.nextIndex();
  const existing = instance.slots[index] as MemoSlot | undefined;
  if (existing && sameDeps(existing.deps, deps)) return existing.value as T;
  const slot: MemoSlot = { deps, value: factory() };
  instance.slots[index] = slot;
  return slot.value as T;
}

export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: Deps): T {
  return useMemo(() => callback, deps);
}

export interface Mounted<P, R> {
  // What the component returned on its latest render (for a provider, the
  // context element: read `.props.value` for what its consumers would get).
  readonly result: R;
  // Render again now, optionally with new props.
  rerender(props?: P): void;
  // Run the effect cleanups, as React does when the tree goes away.
  unmount(): void;
}

// Renders `component(props)` once, synchronously, and keeps it alive so
// later state changes re-render it.
export function mount<P, R>(component: (props: P) => R, props: P): Mounted<P, R> {
  const instance = new Instance<P, R>(component, props);
  instance.render();
  return {
    get result() {
      return instance.result;
    },
    rerender(next?: P) {
      if (next !== undefined) instance.props = next;
      instance.render();
    },
    unmount() {
      instance.unmount();
    },
  };
}
