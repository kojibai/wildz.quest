export type WildsCrewTravelEntry = {
  proofDigest: string;
  halted?: boolean;
  /** Presentation only: endpoints of the last actually admitted swept segment. */
  visualStep?: { from: {x:number;y:number;z:number}; to: {x:number;y:number;z:number}; startedAtMs:number; durationMs:number };
  spaceId: string;
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number } | null;
  blocked: boolean;
  paused: boolean;
};
/** Mutable physical presentation bridge; never a world event or ownership authority. */
export type WildsCrewTravelRuntime = Map<string, WildsCrewTravelEntry>;

/** Membership notification is control-path only. Updating a route or physical pose
 * never publishes React state; dispatch, completion and removal do. */
export function createWildsCrewTravelRuntime(onMembershipChange:()=>void):WildsCrewTravelRuntime {
  return new class extends Map<string,WildsCrewTravelEntry> {
    override set(id:string,entry:WildsCrewTravelEntry){const added=!this.has(id);super.set(id,entry);if(added)onMembershipChange();return this;}
    override delete(id:string){const removed=super.delete(id);if(removed)onMembershipChange();return removed;}
    override clear(){const changed=this.size>0;super.clear();if(changed)onMembershipChange();}
  }();
}

export function wildsCrewResidentExcludedIds(party:readonly string[],runtime:ReadonlyMap<string,WildsCrewTravelEntry>):readonly string[] {
  return [...new Set([...party,...runtime.keys()])];
}
/** Selection alone never makes a dispatched or still-dispatching traveler cargo. */
export function wildsCrewTransportAccompanyingIds(ids:readonly string[],modes:Readonly<Record<string,"follow"|"roam">>|undefined,active:{has:(id:string)=>boolean}):readonly string[]{
  return ids.filter(id=>modes?.[id]!=="roam"&&!active.has(id));
}
