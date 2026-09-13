/** Sample player displacement between changed snapshots, never against one render delta. */
export type WildsCrewFollowMotion = { x: number; z: number; changedAt: number; speed: number };
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
