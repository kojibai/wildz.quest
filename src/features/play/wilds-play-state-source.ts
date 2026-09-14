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

/** Background collection/profile updates cannot relocate an active player.
 * Explicit restores enter through their own handler or a new campaign identity. */
export function retainWildsLocalPosition(incoming: PlayState, current: PlayState): PlayState {
  return { ...incoming, player: current.player, siteSpace: current.siteSpace, partyTravelRevision: current.partyTravelRevision };
}

/** Only player actions advance the player ledger; world observations and export
 * timestamps cannot authorize replacing local gameplay. */
export function wildsPlayerLedgerPulse(state: PlayState): number {
  return (state.actionHistory ?? []).reduce((pulse, entry) =>
    entry.authority === "local" && Number.isSafeInteger(entry.uPulse)
      ? Math.max(pulse, entry.uPulse) : pulse, -1);
}

export function hasLaterWildsPlayerLedger(incoming: PlayState, local: PlayState): boolean {
  return wildsPlayerLedgerPulse(incoming) > wildsPlayerLedgerPulse(local);
}

export function admitWildsForwardPosition(incoming: PlayState, local: PlayState): PlayState {
  if (hasLaterWildsPlayerLedger(local, incoming)) return local;
  return hasLaterWildsPlayerLedger(incoming, local) ? incoming : retainWildsLocalPosition(incoming, local);
}
