/** Sample player displacement between changed snapshots, never against one render delta. */
export type WildsCrewFollowMotion = { x: number; z: number; changedAt: number; speed: number };
export type WildsCrewFollowPresentation = { x: number; y: number; z: number; distance: number; speed: number; travelled: number };
/** Smooth only the player-relative display pose. Collision and travel retain their
 * admitted positions; filtering cumulative distance also keeps every gait stride. */
export function writeWildsCrewFollowPresentation(state: WildsCrewFollowPresentation, local: { x: number; y: number; z: number }, moved: number, delta: number, reset = false): void {
  if (reset) {
    state.x = local.x; state.y = local.y; state.z = local.z; state.distance = 0; state.speed = 0; state.travelled = 0;
    return;
  }
  const dt = Math.max(0, Math.min(.1, delta));
  if (dt === 0) return;
  const blend = 1 - Math.exp(-18 * dt);
  state.x += (local.x - state.x) * blend;
  state.y += (local.y - state.y) * blend;
  state.z += (local.z - state.z) * blend;
  state.travelled += moved;
  const previousDistance = state.distance;
  state.distance += (state.travelled - state.distance) * blend;
  state.speed = (state.distance - previousDistance) / dt;
}
export function writeWildsCrewFollowSpeed(state: WildsCrewFollowMotion, player: { x: number; z: number }, nowSeconds: number, gap: number): number {
  const distance = Math.hypot(player.x - state.x, player.z - state.z);
  if (distance > .000001) {
    const elapsed = nowSeconds - state.changedAt;
    if (elapsed > .015) state.speed = Math.min(72, distance / elapsed);
    state.x = player.x; state.z = player.z; state.changedAt = nowSeconds;
  }
  const age = Math.max(0, nowSeconds - state.changedAt);
  const measured = state.speed * Math.max(0, 1 - Math.max(0, age - .18) / .32);
  return Math.min(72, Math.max(5.5, measured + Math.min(10, Math.max(0, gap) * 4)));
}

import type { WildsCrewNavigationAuthority, WildsCrewNavigationPoint, WildsCrewNavigationSample } from "./wilds-crew-navigation";
/** Explicit accompanying-party recovery, not a swept journey from the old pose.
 * Validates the player's current ground landing, then its adjacent formation segment.
 * The caller must discard gait distance for this reposition; expedition actors never use it. */
export function writeWildsCrewFollowRegroup(position:WildsCrewNavigationPoint,player:Readonly<WildsCrewNavigationPoint>,formation:Readonly<WildsCrewNavigationPoint>,scratch:WildsCrewNavigationSample,authority:WildsCrewNavigationAuthority,allowed:boolean):boolean {
  if(!allowed||!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(position.z)||authority.mode!=="walk"||!authority.permittedModes.includes("walk")||(!Number.isFinite(player.x)||!Number.isFinite(player.y)||!Number.isFinite(player.z)||!Number.isFinite(formation.x)||!Number.isFinite(formation.y)||!Number.isFinite(formation.z))
    ||Math.hypot(position.x-formation.x,position.z-formation.z)<=3||Math.hypot(player.x-formation.x,player.z-formation.z)>2)return false;
  scratch.allowed=false;scratch.y=NaN;authority.sampleSegment(player,player,"walk",scratch);
  if(!scratch.allowed||!Number.isFinite(scratch.y))return false;
  const floor=scratch.y;
  scratch.allowed=false;scratch.y=NaN;authority.sampleSegment(player,formation,"walk",scratch);
  if(scratch.allowed&&Number.isFinite(scratch.y)){position.x=formation.x;position.y=scratch.y;position.z=formation.z;}
  else{position.x=player.x;position.y=floor;position.z=player.z;}
  return true;
}
