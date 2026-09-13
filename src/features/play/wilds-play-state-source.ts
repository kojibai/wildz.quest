import type { PlayState } from "./game-state";

/** A shell echo acknowledges our own publication; it is not a remote restore.
 * Track exact objects, so independently restored or claimed state is still admitted.
 * Weak references do not retain a history of gameplay snapshots. */
export function createWildsPlayStateSourceAdmission() {
  const localPublications = new WeakSet<PlayState>();
  return {
    published(state: PlayState) { localPublications.add(state); },
    shouldAdopt(state: PlayState) { return !localPublications.has(state); }
  };
}
