"use client";
import type { WildsPresence } from "./multiplayer-core";
import { roomKeyForPosition, WILDS_INTERACTION_DISTANCE } from "./multiplayer-core";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import styles from "./WildsRoamingBattle.module.css";

export type WildsRoamingChallengeTarget = { roomKey: string; ownerId: string; assetId: string; proofDigest: string };
export function WildsRoamingNearby({ players, selfId, position, pending, onChallenge, resumeLabel, onResume }: {
  players: readonly WildsPresence[]; selfId: string; position: { x: number; z: number }; pending: boolean;
  resumeLabel?: string; onResume?: () => void;
  onChallenge: (target: WildsRoamingChallengeTarget) => void;
}) {
  const nearby = players.filter(owner => !owner.practice && owner.status !== "private" && !sameWildzPlayerCoordinate(owner.playerId, selfId))
    .flatMap(owner => (owner.roamingCreatures ?? []).filter(creature => !creature.returning && ["roaming", "observing"].includes(creature.phase)
      && Math.hypot(creature.x - position.x, creature.z - position.z) <= WILDS_INTERACTION_DISTANCE).map(creature => ({ owner, creature }))).slice(0, 6);
  if (!nearby.length && !resumeLabel) return null;
  return <aside className={styles.nearby} aria-label="Nearby roaming creatures"><strong>{nearby.length ? "Roaming creatures nearby" : "Roaming encounter"}</strong>
    {resumeLabel && onResume ? <button disabled={pending} onClick={onResume} type="button">{resumeLabel}</button> : null}
    {nearby.map(({ owner, creature }) => <button disabled={pending} key={`${owner.playerId}:${creature.assetId}`} type="button" onClick={() => onChallenge({
      roomKey: roomKeyForPosition("platform", owner), ownerId: owner.playerId, assetId: creature.assetId, proofDigest: creature.proofDigest
    })}>Challenge {creature.name}<small>Travelling with {owner.handle}</small></button>)}
  </aside>;
}
