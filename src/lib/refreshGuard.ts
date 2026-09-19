// For a list that can be refreshed from the server while the person is also
// changing it (posting, updating a status). A refresh takes a ticket when it
// STARTS; anything that changes the list yourself calls bump(); when the
// refresh's answer arrives it is only applied if its ticket is still
// current, i.e. nothing changed the list in the meantime. Otherwise the
// answer is older than what is already on screen and would undo it.
export interface RefreshGuard {
  bump(): void;
  begin(): { isCurrent(): boolean };
}

export function createRefreshGuard(): RefreshGuard {
  let version = 0;
  return {
    bump() {
      version += 1;
    },
    begin() {
      const started = version;
      return { isCurrent: () => started === version };
    },
  };
}
