import { canonicalizeReceizV122, digestReceizCanonicalV122 } from "@receiz/sdk";
import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";
import { KAI_PULSE_DURATION_MS } from "./kai-klok-moment";
import type { WildsCrewDisposition } from "./wilds-crew-policy";
import type { WildsCrewNavigationPoint } from "./wilds-crew-navigation";

export const WILDS_CREW_EXPEDITION_ARRIVAL_RADIUS = .8;
export const WILDS_CREW_EXPEDITION_OBSERVE_UPULSES = Math.ceil(1000 / KAI_PULSE_DURATION_MS * 1_000_000);
export type WildsCrewExpeditionPoint = Readonly<WildsCrewNavigationPoint>;
/** Caller-supplied known canonical coordinates, never generated places or discoveries.
 * Reachability is a planning filter; movement must still resample current geometry. */
export type WildsCrewExpeditionCandidate = Readonly<{
  pointId:string;spaceId:string;position:WildsCrewExpeditionPoint;risk:number;reachable:boolean;
}>;
export type WildsCrewExpeditionStart = Readonly<{
  ownerReceizId:string;assetId:string;proofDigest:string;disposition:WildsCrewDisposition;
  origin:WildsCrewExpeditionPoint;spaceId:string;candidates:readonly WildsCrewExpeditionCandidate[];
  kaiUPulse:number;requestId:string;
}>;
export type WildsCrewExpeditionPhase = "outbound"|"observing"|"returning"|"completed"|"blocked";
export type WildsCrewExpedition = Readonly<{
  schema:"wildz.crew.expedition.v1";authority:"local-observation";
  head:string;previousHead:string|null;revision:number;expeditionId:string;
  ownerReceizId:string;assetId:string;proofDigest:string;identityAnchor:string;
  spaceId:string;origin:WildsCrewExpeditionPoint;home:WildsCrewExpeditionPoint;
  stops:readonly WildsCrewExpeditionCandidate[];stopIndex:number;
  currentStop:WildsCrewExpeditionCandidate|null;goal:WildsCrewExpeditionPoint|null;
  phase:WildsCrewExpeditionPhase;totalObserved?:number;
  kind:"route-retried"|"itinerary-continued"|"started"|"visited"|"continued"|"recalled"|"blocked"|"returned"|"transported"|"return-retargeted"|"superseded";
  /** Descriptive reference only: the ended row retains its original proof binding. */
  replacementProofDigest?:string;
  visitedPointIds:readonly string[];recallRequested:boolean;blocker:string|null;
  observedKaiUPulse:number;causalKaiUPulse:number;observingSinceKaiUPulse:number|null;
  /** Most recently admitted physical anchor, retained by nonpositional controls. */
  actualPosition:WildsCrewExpeditionPoint|null;actualSpaceId:string|null;
}>;
export type WildsCrewExpeditionChange = Readonly<{
  ownerReceizId:string;assetId:string;expectedHead:string;kaiUPulse:number;
}>;
export type WildsCrewExpeditionRecall = WildsCrewExpeditionChange & Readonly<{returnPosition?:WildsCrewExpeditionPoint;spaceId?:string}>;
export type WildsCrewExpeditionReturnTarget = WildsCrewExpeditionChange & Readonly<{returnPosition:WildsCrewExpeditionPoint;spaceId:string}>;
export function wildsCrewReturnNeedsRetarget(row:Pick<WildsCrewExpedition,"phase"|"spaceId"|"home">,position:WildsCrewExpeditionPoint,spaceId:string):boolean {
  return row.phase==="returning"&&row.spaceId===spaceId&&(Math.hypot(row.home.x-position.x,row.home.z-position.z)>2
    ||Math.abs(row.home.y-position.y)>WILDS_CREW_EXPEDITION_ARRIVAL_RADIUS);
}
export type WildsCrewExpeditionArrival = WildsCrewExpeditionChange & Readonly<{
  actualPosition:WildsCrewExpeditionPoint;spaceId:string;
}>;
const id=(value:string)=>typeof value==="string"&&value.length>0&&value.length<=512;
const pulse=(value:number)=>Number.isSafeInteger(value)&&value>=0;
const point=(value:WildsCrewExpeditionPoint)=>!!value&&[value.x,value.y,value.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9);
const distance=(a:WildsCrewExpeditionPoint,b:WildsCrewExpeditionPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const equal=(a:unknown,b:unknown)=>canonicalizeReceizV122(a)===canonicalizeReceizV122(b);
const fail=(code:string):never=>{throw new Error(`crew_expedition_${code}`);};
function affinity(seed:number,value:string){
  let hash=seed>>>0;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619)>>>0;
  return hash/0x100000000;
}

/** Deterministic individuality from the current genome's prepared disposition. This
 * chooses local travel intentions only; it grants no ability, reward or world effect. */
export function chooseWildsCrewExpeditionStops(input:Pick<WildsCrewExpeditionStart,"assetId"|"proofDigest"|"disposition"|"origin"|"spaceId"|"candidates">):WildsCrewExpeditionCandidate[]{
  const d=input.disposition;
  if(!id(input.assetId)||!id(input.proofDigest)||!d||d.assetId!==input.assetId||d.proofDigest!==input.proofDigest||!id(d.identityAnchor))return fail("proof_mismatch");
  if(!point(input.origin)||!id(input.spaceId)||input.candidates.length>128||!Number.isFinite(d.riskTolerance)||d.riskTolerance<0||d.riskTolerance>100
    ||!Number.isSafeInteger(d.preferenceSeed)||d.preferenceSeed<0||d.preferenceSeed>0xffffffff)return fail("input_invalid");
  const known=new Set<string>();
  const ranked=input.candidates.flatMap(candidate=>{
    if(!id(candidate.pointId)||!point(candidate.position)||candidate.spaceId!==input.spaceId||candidate.reachable!==true
      ||!Number.isFinite(candidate.risk)||candidate.risk<0||candidate.risk>d.riskTolerance)return [];
    if(known.has(candidate.pointId))return fail("duplicate_point");known.add(candidate.pointId);
    const range=distance(input.origin,candidate.position);if(range<8||range>32)return [];
    // Safety dominates individual affinity. Curious/brave creatures favour farther
    // observed points through their genome-derived risk tolerance, within the same cap.
    const desiredDistance=Math.min(28,8+d.riskTolerance*.6);
    return [{candidate,score:candidate.risk*4+Math.abs(range-desiredDistance)-affinity(d.preferenceSeed,candidate.pointId)*4}];
  }).sort((a,b)=>a.score-b.score||a.candidate.pointId.localeCompare(b.candidate.pointId));
  const stops:WildsCrewExpeditionCandidate[]=[];
  for(const {candidate} of ranked){
    if(stops.every(stop=>distance(stop.position,candidate.position)>=4))stops.push(structuredClone(candidate));
    if(stops.length===3)break;
  }
  return stops;
}

/** Owner/asset scoped local excursion journal. Every change and its head commit
 * atomically. History is append-only and bounded per read, including earlier trips.
 * Call only on scheduler/control/arrival events, never per animation frame. Current
 * card ownership, condition and locomotion remain caller gates before movement. */
export function createWildsCrewExpeditions(database:WildzContinuityDatabase=createWildzContinuityDatabase()){
  const key=(owner:string,asset:string,kind:string,value="")=>JSON.stringify(["wildz.crew.expedition.v1",owner,asset,kind,value]);
  const verify=async(row:WildsCrewExpedition,owner:string,asset:string)=>{
    const {head,...body}=row;
    if(row.schema!=="wildz.crew.expedition.v1"||row.authority!=="local-observation"||row.ownerReceizId!==owner||row.assetId!==asset
      ||await digestReceizCanonicalV122(body)!==head)return fail("corrupt");return row;
  };
  const read=async(owner:string,asset:string)=>{
    if(!id(owner)||!id(asset))return fail("identity_invalid");
    const row=await database.read<WildsCrewExpedition>("meta",key(owner,asset,"head"));return row?verify(row,owner,asset):null;
  };
  const seal=async(body:Omit<WildsCrewExpedition,"head">):Promise<WildsCrewExpedition>=>({...body,head:await digestReceizCanonicalV122(body)});
  const commit=async(row:WildsCrewExpedition,previous:WildsCrewExpedition|null,requestDigest:string,startRequestId?:string)=>database.transaction(["meta"],"readwrite",async tx=>{
    const replay=await tx.get<WildsCrewExpedition>("meta",key(row.ownerReceizId,row.assetId,"request",requestDigest));if(replay)return replay;
    if(startRequestId){
      const priorStart=await tx.get<string>("meta",key(row.ownerReceizId,row.assetId,"start-id",startRequestId));
      if(priorStart&&priorStart!==requestDigest)return fail("start_replay_conflict");
    }
    const current=await tx.get<WildsCrewExpedition>("meta",key(row.ownerReceizId,row.assetId,"head"));
    if(!equal(current,previous))return fail("head_conflict");
    await tx.put("meta",row,key(row.ownerReceizId,row.assetId,"event",row.head));
    await tx.put("meta",row,key(row.ownerReceizId,row.assetId,"head"));
    await tx.put("meta",row,key(row.ownerReceizId,row.assetId,"request",requestDigest));
    if(startRequestId)await tx.put("meta",requestDigest,key(row.ownerReceizId,row.assetId,"start-id",startRequestId));return row;
  });
  type Action={type:"retry"}|{type:"extend";stops:readonly WildsCrewExpeditionCandidate[]}|{type:"supersede";replacementProofDigest:string}|{type:"continue"}|{type:"recall";returnPosition?:WildsCrewExpeditionPoint;spaceId?:string}|{type:"retarget-return";returnPosition:WildsCrewExpeditionPoint;spaceId:string}
    |{type:"block";reason:string}|{type:"arrive";actualPosition:WildsCrewExpeditionPoint;spaceId:string}|{type:"transport";actualPosition:WildsCrewExpeditionPoint;spaceId:string};
  const change=async(input:WildsCrewExpeditionChange,action:Action)=>{
    const request=structuredClone({input,action});input=request.input;action=request.action;
    if(!id(input.ownerReceizId)||!id(input.assetId)||!id(input.expectedHead)||!pulse(input.kaiUPulse))return fail("input_invalid");
    const requestDigest=await digestReceizCanonicalV122(request);
    const replay=await database.read<WildsCrewExpedition>("meta",key(input.ownerReceizId,input.assetId,"request",requestDigest));
    if(replay)return verify(replay,input.ownerReceizId,input.assetId);
    const previous=await read(input.ownerReceizId,input.assetId);
    if(!previous||previous.head!==input.expectedHead)return fail("head_conflict");
    if(previous.phase==="completed")return fail("phase_completed");
    const {head,...body}=previous;
    const next={...body,previousHead:head,revision:previous.revision+1,actualPosition:previous.actualPosition,actualSpaceId:previous.actualSpaceId,
      observedKaiUPulse:input.kaiUPulse,causalKaiUPulse:Math.max(input.kaiUPulse,previous.causalKaiUPulse)};
    if(!Number.isSafeInteger(next.revision))return fail("revision_overflow");
    if(action.type==="supersede"){
      if(!id(action.replacementProofDigest)||action.replacementProofDigest===previous.proofDigest)return fail("replacement_proof_invalid");
      next.actualPosition=null;next.actualSpaceId=null;
      next.phase="completed";next.kind="superseded";next.replacementProofDigest=action.replacementProofDigest;
      next.goal=null;next.currentStop=null;next.blocker=null;next.observingSinceKaiUPulse=null;
    }else if(action.type==="arrive"){
      if(previous.phase!=="outbound"&&previous.phase!=="returning")return fail("phase_not_travelling");
      if(!point(action.actualPosition)||action.spaceId!==previous.spaceId||!previous.goal)return fail("position_invalid");
      if(distance(action.actualPosition,previous.goal)>WILDS_CREW_EXPEDITION_ARRIVAL_RADIUS)return fail("not_arrived");
      next.actualPosition={...action.actualPosition};next.actualSpaceId=action.spaceId;
      if(previous.phase==="outbound"){
        if(!previous.currentStop||previous.visitedPointIds.includes(previous.currentStop.pointId))return fail("stop_invalid");
        next.totalObserved=(previous.totalObserved??previous.visitedPointIds.length)+1;
        if(!Number.isSafeInteger(next.totalObserved))return fail("observation_overflow");
        next.visitedPointIds=[...previous.visitedPointIds,previous.currentStop.pointId];next.phase="observing";next.kind="visited";
        next.observingSinceKaiUPulse=input.kaiUPulse;
      }else{next.phase="completed";next.kind="returned";next.goal=null;next.currentStop=null;next.observingSinceKaiUPulse=null;}
    }else if(action.type==="transport"){
      if(!point(action.actualPosition)||!id(action.spaceId))return fail("position_invalid");
      next.phase="completed";next.kind="transported";next.actualPosition={...action.actualPosition};next.actualSpaceId=action.spaceId;
      next.goal=null;next.currentStop=null;next.blocker=null;next.observingSinceKaiUPulse=null;
    }else if(action.type==="retry"){
      if(previous.phase!=="blocked"||!previous.goal)return fail("phase_not_retryable");
      next.phase=previous.recallRequested?"returning":previous.currentStop&&previous.visitedPointIds.includes(previous.currentStop.pointId)?"observing":"outbound";
      next.kind="route-retried";next.blocker=null;
      next.actualPosition=previous.actualPosition;next.actualSpaceId=previous.actualSpaceId;
    }else if(action.type==="extend"){
      if(previous.phase!=="observing"||previous.recallRequested||previous.stopIndex!==previous.stops.length-1||!previous.actualPosition||previous.observingSinceKaiUPulse===null)return fail("phase_not_batch_end");
      if(input.kaiUPulse-previous.observingSinceKaiUPulse<WILDS_CREW_EXPEDITION_OBSERVE_UPULSES)return fail("observation_incomplete");
      if(!action.stops.length||action.stops.length>3||action.stops.some(stop=>!id(stop.pointId)||!point(stop.position)||stop.spaceId!==previous.spaceId||stop.reachable!==true||distance(stop.position,previous.actualPosition!)>24||distance(stop.position,previous.actualPosition!)<8))return fail("stops_invalid");
      if(new Set(action.stops.map(stop=>stop.pointId)).size!==action.stops.length)return fail("duplicate_point");
      next.stops=action.stops;next.visitedPointIds=[];next.stopIndex=0;next.currentStop=action.stops[0];next.goal=action.stops[0].position;
      next.phase="outbound";next.kind="itinerary-continued";next.observingSinceKaiUPulse=null;
      // Carry the last actual observation into the next bounded batch for reload.
      next.actualPosition=previous.actualPosition;next.actualSpaceId=previous.actualSpaceId;
    }else if(action.type==="continue"){
      if(previous.phase!=="observing"||previous.observingSinceKaiUPulse===null)return fail("phase_not_observing");
      if(input.kaiUPulse-previous.observingSinceKaiUPulse<WILDS_CREW_EXPEDITION_OBSERVE_UPULSES)return fail("observation_incomplete");
      next.stopIndex=previous.stopIndex+1;next.currentStop=previous.stops[next.stopIndex]??null;
      next.phase=next.currentStop?"outbound":"returning";next.goal=next.currentStop?.position??previous.home;
      next.observingSinceKaiUPulse=null;next.kind="continued";
    }else if(action.type==="retarget-return"){
      if(previous.phase!=="returning")return fail("phase_not_returning");
      if(!point(action.returnPosition)||action.spaceId!==previous.spaceId)return fail("position_invalid");
      next.home={...action.returnPosition};next.goal=next.home;next.kind="return-retargeted";
    }else if(action.type==="recall"){
      if(action.spaceId!==undefined&&action.spaceId!==previous.spaceId)return fail("position_invalid");
      if(action.returnPosition!==undefined){if(!point(action.returnPosition))return fail("position_invalid");next.home={...action.returnPosition};}
      next.phase="returning";next.kind="recalled";next.recallRequested=true;next.goal=next.home;
      next.currentStop=null;next.blocker=null;next.observingSinceKaiUPulse=null;
    }else{
      if(!id(action.reason))return fail("blocker_invalid");
      next.phase="blocked";next.kind="blocked";next.blocker=action.reason;
      next.actualPosition=previous.actualPosition;next.actualSpaceId=previous.actualSpaceId;
    }
    return commit(await seal(next),previous,requestDigest);
  };
  return Object.freeze({read,
    async start(input:WildsCrewExpeditionStart){
      const request=structuredClone(input);
      if(!id(request.ownerReceizId)||!id(request.assetId)||!id(request.requestId)||!pulse(request.kaiUPulse))return fail("input_invalid");
      const stops=chooseWildsCrewExpeditionStops(request);
      const requestDigest=await digestReceizCanonicalV122(request);
      const replay=await database.read<WildsCrewExpedition>("meta",key(request.ownerReceizId,request.assetId,"request",requestDigest));
      if(replay)return verify(replay,request.ownerReceizId,request.assetId);
      const previous=await read(request.ownerReceizId,request.assetId);
      if(previous&&previous.phase!=="completed")return fail("already_active");
      const revision=(previous?.revision??0)+1;if(!Number.isSafeInteger(revision))return fail("revision_overflow");
      const row=await seal({schema:"wildz.crew.expedition.v1",authority:"local-observation",previousHead:previous?.head??null,
        revision,expeditionId:request.requestId,ownerReceizId:request.ownerReceizId,assetId:request.assetId,
        proofDigest:request.proofDigest,identityAnchor:request.disposition.identityAnchor,spaceId:request.spaceId,
        origin:request.origin,home:request.origin,stops,stopIndex:0,currentStop:stops[0]??null,goal:stops[0]?.position??null,
        phase:stops.length?"outbound":"blocked",kind:"started",visitedPointIds:[],recallRequested:false,
        blocker:stops.length?null:"No safe known destination between 8 and 32 metres is available.",
        observedKaiUPulse:request.kaiUPulse,causalKaiUPulse:Math.max(request.kaiUPulse,previous?.causalKaiUPulse??0),observingSinceKaiUPulse:null,actualPosition:null,actualSpaceId:null});
      return commit(row,previous,requestDigest,request.requestId);
    },
    /** Explicit same-owner control ends stale local intent, preserving the old proof and
     * observations. It is not arrival, transport, proof migration or world admission. */
    supersede:(input:WildsCrewExpeditionChange&{replacementProofDigest:string})=>change(input,{type:"supersede",replacementProofDigest:input.replacementProofDigest}),
    arrive:(input:WildsCrewExpeditionArrival)=>change(input,{type:"arrive",actualPosition:input.actualPosition,spaceId:input.spaceId}),
    retry:(input:WildsCrewExpeditionChange)=>change(input,{type:"retry"}),
    extend:(input:WildsCrewExpeditionChange & {stops:readonly WildsCrewExpeditionCandidate[]})=>change(input,{type:"extend",stops:input.stops}),
    continue:(input:WildsCrewExpeditionChange)=>change(input,{type:"continue"}),
    recall:(input:WildsCrewExpeditionRecall)=>change(input,{type:"recall",...(input.returnPosition?{returnPosition:input.returnPosition}:{}),...(input.spaceId?{spaceId:input.spaceId}:{})}),
    retargetReturn:(input:WildsCrewExpeditionReturnTarget)=>change(input,{type:"retarget-return",returnPosition:input.returnPosition,spaceId:input.spaceId}),
    /** Only for an explicit party transport already performed by the game. It records
     * that observation, never counts it as walking, visiting a stop or returning. */
    transport:(input:WildsCrewExpeditionArrival)=>change(input,{type:"transport",actualPosition:input.actualPosition,spaceId:input.spaceId}),
    block:(input:WildsCrewExpeditionChange&{reason:string})=>change(input,{type:"block",reason:input.reason}),
    async history(owner:string,asset:string,beforeHead?:string,limit=32){
      if(!id(owner)||!id(asset)||!Number.isInteger(limit)||limit<1||limit>128)return fail("window_invalid");
      const latest=beforeHead?null:await read(owner,asset);
      let cursor=beforeHead??latest?.head??null;const observations:WildsCrewExpedition[]=[];
      const visited=new Set<string>();
      while(cursor&&observations.length<limit){
        if(visited.has(cursor))return fail("history_cycle");visited.add(cursor);
        const row=await database.read<WildsCrewExpedition>("meta",key(owner,asset,"event",cursor)) ?? (latest?.head===cursor?latest:null);
        if(!row)return {observations,nextCursor:null,incomplete:true};
        if(row.head!==cursor)return fail("history_incomplete");observations.push(await verify(row,owner,asset));cursor=row.previousHead;
      }
      return {observations,nextCursor:cursor};
    }
  });
}
