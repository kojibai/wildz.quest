import { digestReceizCanonicalV122 } from "@receiz/sdk";
import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";
import { observeWildsKaiUPulse } from "./wilds-kai-runtime";

/** An observed local control change, explicitly not a world admission, reward or mandate. */
export type WildsCrewModeObservation = Readonly<{
  schema:"wildz.crew.mode-observation.v1";
  eventId:string; requestId:string; ownerReceizId:string; assetId:string;
  mode:"follow"|"roam"; genomeProofDigest:string;
  observedKaiUPulse:number; causalKaiUPulse:number; sequence:number;
  previousEventId:string|null;
  authority:"local-observation";
}>;
type Request = Pick<WildsCrewModeObservation,"ownerReceizId"|"assetId"|"mode"|"genomeProofDigest">;
const id=(s:string)=>typeof s === "string" && s.length>0 && s.length<=512;
const pulse=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const key=(owner:string,asset:string,kind:string,id:string)=>JSON.stringify(["wildz.crew.observations.v1",owner,asset,kind,id]);

async function verified(event:WildsCrewModeObservation,owner:string,asset:string) {
  const {eventId,...body}=event;
  if(body.schema!=="wildz.crew.mode-observation.v1" || body.authority!=="local-observation"
    || body.ownerReceizId!==owner || body.assetId!==asset || !pulse(body.observedKaiUPulse)
    || !pulse(body.causalKaiUPulse) || body.causalKaiUPulse<body.observedKaiUPulse
    || !Number.isSafeInteger(body.sequence) || body.sequence<1 || !id(body.requestId)
    || !["follow","roam"].includes(body.mode) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(body.genomeProofDigest)
    || (body.previousEventId!==null && !/^[a-f0-9]{64}$/.test(body.previousEventId))
    || await digestReceizCanonicalV122(body)!==eventId) throw new Error("crew_observation_corrupt");
  return event;
}

export function createWildsCrewObservations(database:WildzContinuityDatabase=createWildzContinuityDatabase(),clock=observeWildsKaiUPulse) {
  // Serialize explicit controls within a tab; IndexedDB CAS handles competing tabs.
  const tails=new Map<string,Promise<unknown>>();
  const read=async(owner:string,asset:string,eventId:string)=>{
    const row=await database.read<WildsCrewModeObservation>("meta",key(owner,asset,"event",eventId));
    if(!row || row.eventId!==eventId) throw new Error("crew_observation_missing");
    return verified(row,owner,asset);
  };
  return Object.freeze({
    record(input:Request):Promise<WildsCrewModeObservation> {
      const request={ownerReceizId:input.ownerReceizId,assetId:input.assetId,mode:input.mode,genomeProofDigest:input.genomeProofDigest};
      if(!id(request.ownerReceizId)||!id(request.assetId)||!["follow","roam"].includes(request.mode)
        ||!/^(?:sha256:)?[a-f0-9]{64}$/.test(request.genomeProofDigest)) return Promise.reject(new Error("crew_observation_input_invalid"));
      const observedKaiUPulse=clock();
      if(!pulse(observedKaiUPulse)) return Promise.reject(new Error("crew_observation_clock_invalid"));
      const requestId=crypto.randomUUID();
      const headKey=key(request.ownerReceizId,request.assetId,"head","");
      const pending=(tails.get(headKey)??Promise.resolve()).catch(()=>undefined).then(async()=>{
        for(let attempt=0;attempt<8;attempt++) {
          const previousId=await database.read<string>("meta",headKey);
          const previous=previousId ? await read(request.ownerReceizId,request.assetId,previousId):null;
          const sequence=(previous?.sequence??0)+1;
          if(!Number.isSafeInteger(sequence)) throw new Error("crew_observation_sequence_overflow");
          const body={schema:"wildz.crew.mode-observation.v1" as const,...request,requestId,observedKaiUPulse,
            causalKaiUPulse:Math.max(observedKaiUPulse,previous?.causalKaiUPulse??0),sequence,
            previousEventId:previousId,authority:"local-observation" as const};
          const event=Object.freeze({...body,eventId:await digestReceizCanonicalV122(body)});
          const accepted=await database.transaction(["meta"],"readwrite",async tx=>{
            if(await tx.get<string>("meta",headKey)!==previousId) return false;
            await tx.put("meta",event,key(request.ownerReceizId,request.assetId,"event",event.eventId));
            await tx.put("meta",event.eventId,headKey);
            return true;
          });
          if(accepted) return event;
        }
        throw new Error("crew_observation_head_contested");
      });
      tails.set(headKey,pending);
      void pending.finally(()=>{if(tails.get(headKey)===pending)tails.delete(headKey);}).catch(()=>undefined);
      return pending;
    },
    async history(owner:string,asset:string,beforeEventId?:string,limit=32) {
      if(!id(owner)||!id(asset)||!Number.isInteger(limit)||limit<1||limit>128) throw new Error("crew_observation_window_invalid");
      let cursor=beforeEventId??await database.read<string>("meta",key(owner,asset,"head",""));
      const events:WildsCrewModeObservation[]=[];
      const visited=new Set<string>();
      while(cursor&&events.length<limit) {
        if(visited.has(cursor))throw new Error("crew_observation_cycle");
        visited.add(cursor);
        const event=await read(owner,asset,cursor);events.push(event);cursor=event.previousEventId;
      }
      return {events,nextCursor:cursor};
    }
  });
}
let local:ReturnType<typeof createWildsCrewObservations>|undefined;
export function recordWildsCrewModeObservation(input:Request) {
  local??=createWildsCrewObservations();
  return local.record(input);
}
