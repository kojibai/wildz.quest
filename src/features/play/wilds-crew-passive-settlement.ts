import { applyWildsInput, type PlayState } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildsCrewActiveTrips = ReadonlyMap<string,{owner:string;proofDigest:string}>;
/** Physical trips retain their admitted proof until completion. This does not mask live conditions. */
export function isWildsCrewPhysicallyActive(card:PortableCardAsset,owner:string,trips:WildsCrewActiveTrips):boolean {
  const trip=trips.get(card.id);
  return !!trip&&trip.owner===owner&&trip.proofDigest===card.proof.digest&&sameWildzPlayerCoordinate(card.manifest.ownerReceizId,owner);
}
/** Defer checkpoint sealing, preserving the existing queued growth observations in original order. */
export function settleWildsCrewPendingGrowth(state:PlayState,owner:string,trips:WildsCrewActiveTrips,limit=Infinity):PlayState {
  const protectedIds=new Set(state.inventory.filter(card=>isWildsCrewPhysicallyActive(card,owner,trips)).map(card=>card.id));
  const selected:PlayState["pendingTravelGrowthEvents"]=[],retained:PlayState["pendingTravelGrowthEvents"]=[];
  for(const event of state.pendingTravelGrowthEvents){
    if(!protectedIds.has(event.assetId)&&selected.length<limit)selected.push(event);else retained.push(event);
  }
  if(!selected.length)return state;
  const settled=applyWildsInput({...state,pendingTravelGrowthEvents:selected},{type:"settle-pending-travel-growth"});
  return {...settled,pendingTravelGrowthEvents:retained};
}
