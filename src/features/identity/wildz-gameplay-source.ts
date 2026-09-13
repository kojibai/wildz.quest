type GameplaySource = Readonly<{
  session: Readonly<{ keyId: string; actorId: string }>;
  restoreEpoch: number;
}>;

/** A delayed old game callback must never write into a newly activated seal. */
export function isCurrentWildzGameplaySource(current: GameplaySource | null, source: GameplaySource) {
  return current !== null && current.session.keyId === source.session.keyId
    && current.session.actorId === source.session.actorId
    && current.restoreEpoch === source.restoreEpoch;
}
