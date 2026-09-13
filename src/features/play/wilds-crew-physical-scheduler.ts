import { createWildsCrewPathStepState, planWildsCrewPathNearTarget, wildsCrewRouteNeedsReplan, writeWildsCrewFollowingStep, type WildsCrewNavigationAuthority, type WildsCrewNavigationPoint } from "./wilds-crew-navigation";
import type { WildsCrewTravelEntry, WildsCrewTravelRuntime } from "./wilds-crew-travel-runtime";

export const WILDS_CREW_PHYSICAL_TICK_MS = 100;
export const WILDS_CREW_PHYSICAL_STEPS_PER_TICK = 2;
const ROUTE_CACHE_LIMIT = 12;
const ADMISSION_REFRESH_MS = 500, ADMISSIONS_PER_REFRESH = 16;
type Route = { target:WildsCrewNavigationPoint; direct:ReturnType<typeof createWildsCrewPathStepState>; step:ReturnType<typeof createWildsCrewPathStepState>; waypoints:readonly Readonly<WildsCrewNavigationPoint>[]; directWaypoints:Readonly<WildsCrewNavigationPoint>[]; proofDigest:string };
/** Caller supplies current canonical physical admission. null pauses, while "party"
 * leaves the entry exclusively to its mounted companion writer. Never advances lost time. */
export function createWildsCrewPhysicalScheduler(input:{
  runtime:()=>WildsCrewTravelRuntime;
  admit:(assetId:string,entry:WildsCrewTravelEntry)=>WildsCrewNavigationAuthority|"party"|null;
}) {
  const routes=new Map<string,Route>();
  const eligible=new Set<string>();
  let iterator:IterableIterator<string>|null=null,admissionIterator:IterableIterator<[string,WildsCrewTravelEntry]>|null=null,priorRuntime:WildsCrewTravelRuntime|null=null;
  let admissionDue=-Infinity,knownRuntimeSize=-1;
  let waitingPlanner:string|null=null;
  return {
    tick(nowMs=performance.now()){
      const runtime=input.runtime();
      if(runtime!==priorRuntime){priorRuntime=runtime;iterator=null;admissionIterator=null;routes.clear();eligible.clear();waitingPlanner=null;admissionDue=-Infinity;knownRuntimeSize=-1;}
      let plans=0,processed=0,examined=0;
      // Discover/update membership in bounded batches. Inactive history stays in the
      // runtime but does not permanently consume physical service slots.
      if(nowMs>=admissionDue||runtime.size!==knownRuntimeSize){
        admissionDue=nowMs+ADMISSION_REFRESH_MS;knownRuntimeSize=runtime.size;
        for(let i=0;i<Math.min(ADMISSIONS_PER_REFRESH,runtime.size);i++){
          admissionIterator??=runtime.entries();let next=admissionIterator.next();
          if(next.done){admissionIterator=runtime.entries();next=admissionIterator.next();}if(next.done)break;
          const [id,entry]=next.value,authority=input.admit(id,entry);examined++;
          if(authority&&authority!=="party"&&entry.position&&!entry.halted)eligible.add(id);
          else {eligible.delete(id);routes.delete(id);if(authority!=="party")entry.paused=true;else delete entry.visualStep;}
        }
      }
      if(waitingPlanner!==null&&(!runtime.has(waitingPlanner)||!eligible.has(waitingPlanner)))waitingPlanner=null;
      for(let i=0;i<Math.min(WILDS_CREW_PHYSICAL_STEPS_PER_TICK,eligible.size);i++){
        iterator??=eligible.keys();let next=iterator.next();
        if(next.done){iterator=eligible.keys();next=iterator.next();}if(next.done)break;
        const assetId=next.value,entry=runtime.get(assetId);processed++;
        if(!entry){eligible.delete(assetId);routes.delete(assetId);continue;}
        // Geometry, proof, condition and party ownership remain fresh at every step.
        const authority=input.admit(assetId,entry);examined++;
        if(authority==="party"){eligible.delete(assetId);if(waitingPlanner===assetId)waitingPlanner=null;routes.delete(assetId);delete entry.visualStep;continue;}
        if(!authority||!entry.position||entry.halted){eligible.delete(assetId);if(waitingPlanner===assetId)waitingPlanner=null;entry.paused=true;routes.delete(assetId);continue;}
        entry.paused=false;
        // Finish the admitted segment before starting another after roster shrink.
        // This bounds presentation backlog to one segment and never cuts corners.
        if(entry.visualStep && nowMs < entry.visualStep.startedAtMs + entry.visualStep.durationMs)continue;
        let route=routes.get(assetId);
        if(!route||route.proofDigest!==entry.proofDigest){
          if(routes.size>=ROUTE_CACHE_LIMIT)routes.delete(routes.keys().next().value!);
          const target={...entry.target};
          route={target,direct:createWildsCrewPathStepState(),step:createWildsCrewPathStepState(),waypoints:[],directWaypoints:[target],proofDigest:entry.proofDigest};routes.set(assetId,route);
        }
        if(route.target.x!==entry.target.x||route.target.y!==entry.target.y||route.target.z!==entry.target.z){
          // A moving owner must not erase an admitted detour every update.
          const changedJourney=Math.hypot(route.target.x-entry.target.x,route.target.z-entry.target.z)>8;
          Object.assign(route.target,entry.target);
          if(changedJourney || route.step.reason!=="moving"){
            route.waypoints=[];route.step.waypointIndex=0;route.step.reason="arrived";
          }
        }
        const beforeX=entry.position.x,beforeY=entry.position.y,beforeZ=entry.position.z;
        writeWildsCrewFollowingStep(entry.position,route.target,route.waypoints,route.step,route.direct,route.directWaypoints,{...authority,speed:5.5,deltaSeconds:WILDS_CREW_PHYSICAL_TICK_MS/1000});
        if(route.direct.reason==="mode-not-permitted"||route.direct.reason==="invalid-input"){if(waitingPlanner===assetId)waitingPlanner=null;entry.paused=true;continue;}
        entry.blocked=route.direct.reason==="blocked"&&route.step.reason!=="moving";
        const needsPlan=wildsCrewRouteNeedsReplan(route.waypoints,route.step,route.direct);
        if(!needsPlan&&waitingPlanner===assetId)waitingPlanner=null;
        if(needsPlan&&plans<1&&(waitingPlanner===null||waitingPlanner===assetId)){
          if(waitingPlanner===assetId)waitingPlanner=null;
          plans++;
          const planned=planWildsCrewPathNearTarget({...authority,start:entry.position,target:route.target,cellSize:.6,maxNodes:192,maxDistance:24});
          route.waypoints=planned.waypoints;route.step.waypointIndex=0;
          route.step.reason=planned.reason==="path"?"moving":planned.reason==="arrived"?"arrived":"blocked";
          // Eviction may discard the rest of this route before the next round.
          // Take its first admitted segment now, only if direct movement did not
          // already consume this visit's step. Never join two corner segments.
          if(route.step.reason==="moving"&&entry.position.x===beforeX&&entry.position.y===beforeY&&entry.position.z===beforeZ)
            writeWildsCrewFollowingStep(entry.position,route.target,route.waypoints,route.step,route.direct,route.directWaypoints,{...authority,speed:5.5,deltaSeconds:WILDS_CREW_PHYSICAL_TICK_MS/1000});
          entry.blocked=route.step.reason==="blocked";
        }else if(needsPlan&&waitingPlanner===null)waitingPlanner=assetId;
        if(entry.position.x!==beforeX||entry.position.y!==beforeY||entry.position.z!==beforeZ){
          const visual=entry.visualStep??(entry.visualStep={from:{x:beforeX,y:beforeY,z:beforeZ},to:{...entry.position},startedAtMs:nowMs,durationMs:100});
          visual.from.x=beforeX;visual.from.y=beforeY;visual.from.z=beforeZ;
          visual.to.x=entry.position.x;visual.to.y=entry.position.y;visual.to.z=entry.position.z;
          visual.startedAtMs=nowMs;
          // More dispatched agents share the same fixed work budget; rendering spans
          // their expected service interval without inventing additional travel.
          visual.durationMs=Math.max(100,Math.ceil(eligible.size/WILDS_CREW_PHYSICAL_STEPS_PER_TICK)*WILDS_CREW_PHYSICAL_TICK_MS);
        }

      }
      return {processed,plans,cachedRoutes:routes.size,examined,eligibleAgents:eligible.size};
    },
    clear(){routes.clear();eligible.clear();iterator=null;admissionIterator=null;priorRuntime=null;waitingPlanner=null;admissionDue=-Infinity;knownRuntimeSize=-1;}
  };
}

/** Allocation-free presentation interpolation along one admitted segment only.
 * A stale segment (party handoff/transport/new position) cannot project predicted travel. */
export function writeWildsCrewVisualPosition(output:WildsCrewNavigationPoint,entry:WildsCrewTravelEntry,nowMs:number):number {
  const position=entry.position;if(!position)return 0;
  const visual=entry.visualStep;
  if(!visual||visual.to.x!==position.x||visual.to.y!==position.y||visual.to.z!==position.z||!Number.isFinite(nowMs)||visual.durationMs<=0){
    output.x=position.x;output.y=position.y;output.z=position.z;return 0;
  }
  const fraction=Math.max(0,Math.min(1,(nowMs-visual.startedAtMs)/visual.durationMs));
  output.x=visual.from.x+(visual.to.x-visual.from.x)*fraction;
  output.y=visual.from.y+(visual.to.y-visual.from.y)*fraction;
  output.z=visual.from.z+(visual.to.z-visual.from.z)*fraction;
  return fraction<1?Math.hypot(visual.to.x-visual.from.x,visual.to.y-visual.from.y,visual.to.z-visual.from.z)/(visual.durationMs/1000):0;
}
