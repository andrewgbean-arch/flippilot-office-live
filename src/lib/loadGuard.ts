// When it is safe to save a list that was loaded into memory.
//
// Most providers here save by replacing the server's WHOLE list with
// what they hold in memory. That is only safe when memory is known to be
// this login's real data, so saving is allowed only after a load has
// succeeded, and never while holding a previous login's data or after a
// first load that failed (memory is empty, so a save would erase the
// server's copy).
//
// Pure logic with no React in it so the rules can be unit-tested; see
// useGuardedLoad for the hook that wires it into a provider.
export type LoadFailure = "superseded" | "kept-last-good" | "blocked";

export class LoadGuard {
  // Bumped on every load and every login change, so a slow response that
  // arrives after the login has changed can't land in the new one.
  private seq = 0;
  private saveable = false;
  // True once a load has succeeded for the CURRENT login.
  private hasData = false;

  get canSave(): boolean {
    return this.saveable;
  }

  // Start a load. Saving is blocked while it is in flight (the response
  // will replace what's in memory) and any earlier load is superseded.
  begin(): number {
    this.saveable = false;
    return ++this.seq;
  }

  isCurrent(seq: number): boolean {
    return seq === this.seq;
  }

  // The load returned real data. False (and ignored) if it was superseded.
  succeed(seq: number): boolean {
    if (!this.isCurrent(seq)) return false;
    this.saveable = true;
    this.hasData = true;
    return true;
  }

  // The load failed. A failed REFRESH leaves this login's last-good data
  // in memory, which is still safe to save from, so saving comes back on.
  // A failed FIRST load leaves nothing real to save from, so saving stays
  // blocked and the caller should say so.
  fail(seq: number): LoadFailure {
    if (!this.isCurrent(seq)) return "superseded";
    this.saveable = this.hasData;
    return this.hasData ? "kept-last-good" : "blocked";
  }

  // The login changed or ended: whatever is in memory isn't the new
  // login's, and no load still in flight may land.
  invalidate(): void {
    this.seq++;
    this.saveable = false;
    this.hasData = false;
  }
}
