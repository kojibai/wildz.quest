"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { observeWildsCrewTravelPause } from "./wilds-crew-travel-pause";
import { createWildsCrewExpeditions, WILDS_CREW_EXPEDITION_OBSERVE_UPULSES, type WildsCrewExpedition } from "./wilds-crew-expedition";
import { prepareWildsCrewDisposition, readWildsCrewCondition } from "./wilds-crew-policy";
import { prepareWildsCrewExpeditionStops } from "./wilds-crew-expedition-stops";
import { canWildsCrewTravel } from "./wilds-crew-physical-navigation";
import { observeWildsKaiUPulse } from "./wilds-kai-runtime";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { WildsCrewTravelRuntime } from "./wilds-crew-travel-runtime";
import type { PlayState } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import type { WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";

type Scope = { owner:string; cards:readonly PortableCardAsset[] };
type CrewReports = Readonly<Record<string,string>>;
const scopeKey=(scope:Scope)=>JSON.stringify([scope.owner,...scope.cards.map(c=>[c.id,c.proof.digest,c.manifest.ownerReceizId])]);
const EMPTY_REPORTS: CrewReports=Object.freeze({});
export type WildsCrewExpeditionTicket = { owner:string; assetId:string; proofDigest:string; sequence:number };
/** Lifecycle guard and per-asset control serialization. Clearing a view cancels tickets,
 * not journal history or already admitted observations. Reads never invalidate controls. */
export function createWildsCrewExpeditionGuard(readScope:()=>Scope) {
  let sequence=0;
  const tickets=new Map<string,WildsCrewExpeditionTicket>();
  const queues=new Map<string,Promise<unknown>>();
  let cachedCards:readonly PortableCardAsset[]|undefined;
  let cardsById=new Map<string,PortableCardAsset>();
  const context=(assetId:string)=>{
    const scope=readScope();
    if(scope.cards!==cachedCards){cachedCards=scope.cards;cardsById=new Map(scope.cards.map(card=>[card.id,card]));}
    const card=cardsById.get(assetId);
    return card&&sameWildzPlayerCoordinate(card.manifest.ownerReceizId,scope.owner)
      ? {owner:scope.owner,assetId,proofDigest:card.proof.digest,sequence:0}:null;
  };
  const contextValid=(ticket:WildsCrewExpeditionTicket)=>{
    const current=context(ticket.assetId);
    return current!==null&&current.owner===ticket.owner&&current.proofDigest===ticket.proofDigest;
  };
  return {
    context,contextValid,
    begin(assetId:string){const ticket=context(assetId);if(!ticket)return null;ticket.sequence=++sequence;tickets.set(assetId,ticket);return ticket;},
    current:(assetId:string)=>tickets.get(assetId)??null,
    invalidate(assetId:string){tickets.delete(assetId);},
    valid:(ticket:WildsCrewExpeditionTicket)=>contextValid(ticket)&&tickets.get(ticket.assetId)?.sequence===ticket.sequence,
    clear(){tickets.clear();},
    run<T>(assetId:string,operation:()=>Promise<T>):Promise<T>{
      const next=(queues.get(assetId)??Promise.resolve()).catch(()=>undefined).then(operation);
      queues.set(assetId,next);
      void next.finally(()=>{if(queues.get(assetId)===next)queues.delete(assetId);}).catch(()=>undefined);
      return next;
    }
  };
}

export function useWildsCrewExpeditions(input:{owner:string;state:PlayState;cards:readonly PortableCardAsset[];
  accompanyingAssetIds?:readonly string[];
  siteRuntime:WildsSiteRuntimeProjection;obstacles:readonly WildsTerrainObstacle[];
  feedback:(message:string)=>void;onFinished:(assetId:string)=>void;onResumed?:(assetId:string)=>void}) {
  const latest=useRef(input);latest.current=input;
  const store=useRef<ReturnType<typeof createWildsCrewExpeditions>|null>(null);
  const runtime=useRef<WildsCrewTravelRuntime>(new Map());
  const activeTrips=useRef(new Map<string,WildsCrewExpeditionTicket>());
  const [activeTripRevision,setActiveTripRevision]=useState(0);
  const protect=(ticket:WildsCrewExpeditionTicket)=>{activeTrips.current.set(ticket.assetId,ticket);setActiveTripRevision(v=>v+1);};
  const release=(ticket:WildsCrewExpeditionTicket)=>{if(activeTrips.current.get(ticket.assetId)===ticket){activeTrips.current.delete(ticket.assetId);setActiveTripRevision(v=>v+1);}};
  const rows=useRef(new Map<string,WildsCrewExpedition>());
  const guard=useRef<ReturnType<typeof createWildsCrewExpeditionGuard>|null>(null);
  if(!guard.current)guard.current=createWildsCrewExpeditionGuard(()=>latest.current);
  const blockedSince=useRef(new Map<string,number>());
  const pausedSince=useRef(new Map<string,number>());
  const restoredScope=useRef<{owner:string;proofs:Map<string,string>}>({owner:"",proofs:new Map()});
  const [reportState,setReportState]=useState<{scope:string;values:CrewReports}>({scope:"",values:EMPTY_REPORTS});
  const setReports=(update:CrewReports|((previous:CrewReports)=>CrewReports))=>{
    const scope=latest.current.owner;
    setReportState(previous=>{
      const values=typeof update==="function"?update(previous.scope===scope?previous.values:EMPTY_REPORTS):update;
      return previous.scope===scope&&previous.values===values?previous:{scope,values};
    });
  };
  const reports=reportState.scope===input.owner?reportState.values:EMPTY_REPORTS;
  const getStore=()=>store.current??(store.current=createWildsCrewExpeditions());
  const origin=(current=latest.current)=>({x:current.state.player.x,y:current.state.siteSpace.position.y,z:current.state.player.z});
  const matches=(row:WildsCrewExpedition,ticket:WildsCrewExpeditionTicket)=>guard.current!.valid(ticket)
    &&row.ownerReceizId===ticket.owner&&row.assetId===ticket.assetId&&row.proofDigest===ticket.proofDigest;
  const publish=(row:WildsCrewExpedition,ticket:WildsCrewExpeditionTicket,restored=false)=>{
    if(!matches(row,ticket))return false;
    const prior=rows.current.get(row.assetId);
    if(prior&&(prior.revision>row.revision||(prior.revision===row.revision&&prior.head!==row.head)))return false;
    rows.current.set(row.assetId,row);blockedSince.current.delete(row.assetId);pausedSince.current.delete(row.assetId);
    const message=row.phase==="completed"?(row.kind==="superseded"?"Earlier trip ended after card proof changed. Its history is preserved.":`Returned · ${row.visitedPointIds.length} trail locations observed`)
      :row.phase==="outbound"?`Exploring · destination ${row.stopIndex+1} of ${row.stops.length}`
      :row.phase==="observing"?"Inspecting this part of the trail"
      :row.phase==="returning"?"Returning to you":row.blocker??"Waiting for a clear route";
    setReports(old=>old[row.assetId]===message?old:({...old,[row.assetId]:message}));
    if(row.phase==="completed"||row.phase==="blocked")release(ticket);
    if(row.phase==="completed") {
      runtime.current.delete(row.assetId);
      if(prior?.head!==row.head||latest.current.state.crewPreferences?.byAssetId[row.assetId]!=="follow")latest.current.onFinished(row.assetId);
      return true;
    }
    if(!row.goal){release(ticket);return false;}
    const existing=runtime.current.get(row.assetId);
    runtime.current.set(row.assetId,{proofDigest:row.proofDigest,spaceId:row.spaceId,target:{...row.goal},position:existing?.spaceId===row.spaceId?existing.position??{...(row.actualPosition??row.origin)}:{...(row.actualPosition??row.origin)},
      ...(existing?.spaceId===row.spaceId&&existing.proofDigest===row.proofDigest?{visualStep:existing.visualStep}:{}),blocked:false,paused:row.phase==="blocked",halted:row.phase==="blocked"});
    if(row.spaceId!==latest.current.state.siteSpace.spaceId){
      runtime.current.get(row.assetId)!.paused=true;release(ticket);
      setReports(old=>({...old,[row.assetId]:"Exploration is paused in another space. Return there to resume."}));
      return false;
    }
    if(restored||row.phase==="returning")latest.current.onResumed?.(row.assetId);
    return true;
  };
  const rosterKey=useMemo(()=>scopeKey({owner:input.owner,cards:input.cards}),[input.owner,input.cards]);
  useEffect(()=>{
    const current=latest.current,g=guard.current!;
    const before=restoredScope.current,proofs=new Map(current.cards.map(card=>[card.id,card.proof.digest]));
    if(before.owner!==current.owner){
      g.clear();activeTrips.current.clear();rows.current.clear();runtime.current.clear();blockedSince.current.clear();pausedSince.current.clear();setReports({});
    }else{
      for(const [assetId,proof] of before.proofs){
        if(proofs.get(assetId)===proof)continue;
        g.invalidate(assetId);activeTrips.current.delete(assetId);rows.current.delete(assetId);runtime.current.delete(assetId);blockedSince.current.delete(assetId);pausedSince.current.delete(assetId);
        setReports(old=>{if(!(assetId in old))return old;const next={...old};delete next[assetId];return next;});
      }
    }
    restoredScope.current={owner:current.owner,proofs};setActiveTripRevision(v=>v+1);
    const tickets=current.cards.flatMap(card=>{
      if(before.owner===current.owner&&before.proofs.get(card.id)===card.proof.digest)return [];
      const ticket=g.begin(card.id);if(!ticket)return [];protect(ticket);return [ticket];
    });
    // Restore the roster in bounded batches; stored trips survive active/support selection.
    void (async()=>{for(let offset=0;offset<tickets.length;offset+=3){
      await Promise.all(tickets.slice(offset,offset+3).map(ticket=>getStore().read(ticket.owner,ticket.assetId).then(row=>{
        if(!g.valid(ticket)||!row){release(ticket);return;}
        if(row.proofDigest!==ticket.proofDigest){
          release(ticket);
          setReports(old=>({...old,[ticket.assetId]:row.phase==="completed"?"Earlier trip has ended. Its history is preserved.":"Earlier trip belongs to another card proof. Choose Roam to start a new trip, or Recall to end it."}));
          if(row.phase==="completed")latest.current.onFinished(ticket.assetId);
          return;
        }
        publish(row,ticket,true);
      }).catch(()=>{release(ticket);if(g.valid(ticket))latest.current.feedback("Creature travel history could not be restored.");})));
      if(offset+3<tickets.length)await new Promise<void>(resolve=>setTimeout(resolve,0));
      if(latest.current.owner!==current.owner)return;
    }})();
    // Only changed creatures are invalidated; another card's care or selection cannot restart a trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input.owner,rosterKey]);
  useEffect(()=>{
    const g=guard.current!,trips=activeTrips.current;
    return()=>{g.clear();trips.clear();restoredScope.current={owner:"",proofs:new Map()};};
  },[]);
  useEffect(()=>{
    // A visit to another space pauses independent trips; returning does not relocate them.
    for(const [assetId,row] of rows.current){
      const ticket=guard.current!.current(assetId);
      if(!ticket||!matches(row,ticket)||row.phase==="completed")continue;
      if(row.spaceId===input.state.siteSpace.spaceId){
        if(row.phase!=="blocked")protect(ticket);
        publish(row,ticket,true);
      }else{
        const entry=runtime.current.get(assetId);if(entry)entry.paused=true;
        release(ticket);
      }
    }
    // Space transitions are infrequent and do not append fabricated travel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input.state.siteSpace.spaceId]);
  const travelRevision=useRef(input.state.partyTravelRevision??0);
  useEffect(()=>{
    if(travelRevision.current===(input.state.partyTravelRevision??0))return;
    travelRevision.current=input.state.partyTravelRevision??0;
    const current=latest.current,g=guard.current!,destination=origin(current),spaceId=current.state.siteSpace.spaceId;
    // Read every accompanying member, including a restore/start still in flight.
    const accompanying=new Set(current.accompanyingAssetIds??current.cards.slice(0,3).map(card=>card.id));
    for(const card of current.cards.filter(card=>accompanying.has(card.id))){
      runtime.current.delete(card.id);blockedSince.current.delete(card.id);pausedSince.current.delete(card.id);
      const ticket=g.begin(card.id);if(!ticket)continue;protect(ticket);
      void g.run(card.id,async()=>{
        if(!g.valid(ticket))return;
        const row=await getStore().read(ticket.owner,card.id);
        if(!row||!matches(row,ticket)||row.phase==="completed")return;
        publish(await getStore().transport({ownerReceizId:ticket.owner,assetId:card.id,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse(),actualPosition:destination,spaceId}),ticket);
      }).catch(()=>{if(g.valid(ticket))latest.current.feedback("Travel history is waiting to reconcile; your companion travelled with you.");}).finally(()=>releaseUnlessActive(ticket));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input.state.partyTravelRevision]);
  useEffect(()=>{
    let busy=false,cancelled=false,iterator=runtime.current.keys();
    const tick=async()=>{
      if(busy||cancelled||!rows.current.size)return;busy=true;
      try {
        // Fixed work budget with fair rotation: a large crew cannot monopolize a tick.
        const count=Math.min(3,runtime.current.size);
        for(let index=0;index<count;index++){
          let next=iterator.next();if(next.done){iterator=runtime.current.keys();next=iterator.next();}if(next.done)break;
          const assetId=next.value;
          const g=guard.current!,ticket=g.current(assetId);if(!ticket)continue;
          await g.run(assetId,async()=>{
            const current=latest.current,row=rows.current.get(assetId),entry=runtime.current.get(assetId);
            if(cancelled||!row||!matches(row,ticket)||!entry?.position||row.spaceId!==current.state.siteSpace.spaceId||row.phase==="completed"||row.phase==="blocked")return;
            const change={ownerReceizId:ticket.owner,assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse()};
            try {
              const pause=observeWildsCrewTravelPause(pausedSince.current.get(assetId),entry.paused,true,performance.now());
              if(pause.since===undefined)pausedSince.current.delete(assetId);else pausedSince.current.set(assetId,pause.since);
              if(entry.paused){
                if(pause.blocked){
                  const card=current.cards.find(card=>card.id===assetId);
                  const ready=card&&canWildsCrewTravel(readWildsCrewCondition(card,current.state.adventureConditions));
                  publish(await getStore().block({...change,reason:ready
                    ? "Exploration paused because ground travel stopped. Return to the ground and Recall before choosing another trip."
                    : "Exploration paused because this creature needs rest or care. Recall after it is ready to travel."}),ticket);
                }
                return;
              }
              if(entry.blocked){
                const began=blockedSince.current.get(assetId)??performance.now();blockedSince.current.set(assetId,began);
                if(performance.now()-began>8000){publish(await getStore().block({...change,reason:"The route is blocked. Recall this creature before choosing another trip."}),ticket);return;}
              }else blockedSince.current.delete(assetId);
              if(row.phase==="returning"&&Math.hypot(row.home.x-current.state.player.x,row.home.z-current.state.player.z)>2&&row.spaceId===current.state.siteSpace.spaceId)
                publish(await getStore().retargetReturn({...change,returnPosition:origin(current),spaceId:row.spaceId}),ticket);
              else if(row.phase==="observing"&&row.observingSinceKaiUPulse!==null&&change.kaiUPulse-row.observingSinceKaiUPulse>=WILDS_CREW_EXPEDITION_OBSERVE_UPULSES)
                publish(await getStore().continue(change),ticket);
              else if(row.goal&&["outbound","returning"].includes(row.phase)&&Math.hypot(entry.position.x-row.goal.x,entry.position.y-row.goal.y,entry.position.z-row.goal.z)<=.8)
                publish(await getStore().arrive({...change,actualPosition:{...entry.position},spaceId:entry.spaceId}),ticket);
            }catch{
              // A different tab may have committed first. Reload only this exact scope.
              const retained=await getStore().read(ticket.owner,assetId).catch(()=>null);
              if(retained&&retained.head!==row.head)publish(retained,ticket);
            }
          });
        }
      }finally{busy=false;}
    };
    const timer=window.setInterval(()=>void tick(),500);
    return()=>{cancelled=true;window.clearInterval(timer);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const releaseUnlessActive=(ticket:WildsCrewExpeditionTicket)=>{
    const row=rows.current.get(ticket.assetId);
    if(!row||!matches(row,ticket)||row.phase==="completed"||row.phase==="blocked"||row.spaceId!==latest.current.state.siteSpace.spaceId)release(ticket);
  };
  return {runtime,reports,activeTrips,activeTripRevision,
    async history(assetId:string,beforeHead?:string,limit=24){
      const current=latest.current,card=current.state.inventory.find(c=>c.id===assetId&&sameWildzPlayerCoordinate(c.manifest.ownerReceizId,current.owner));
      if(!card)throw new Error("This creature is no longer in your owned inventory.");
      const owner=current.owner,proofDigest=card.proof.digest;
      const result=await getStore().history(owner,assetId,beforeHead,limit);
      const now=latest.current;
      if(now.owner!==owner||!now.state.inventory.some(c=>c.id===assetId&&c.proof.digest===proofDigest&&sameWildzPlayerCoordinate(c.manifest.ownerReceizId,owner)))
        throw new Error("Creature ownership or proof changed while loading history.");
      return result;
    },
    async roam(card:PortableCardAsset) {
      const g=guard.current!,context=g.context(card.id);
      if(!context||context.proofDigest!==card.proof.digest||!sameWildzPlayerCoordinate(card.manifest.ownerReceizId,context.owner))return false;
      const ticket=g.begin(card.id)!;protect(ticket);
      blockedSince.current.delete(card.id);pausedSince.current.delete(card.id);
      return g.run(card.id,async()=>{
        if(!g.valid(ticket))return false;
        const current=latest.current,disposition=prepareWildsCrewDisposition(card),condition=readWildsCrewCondition(card,current.state.adventureConditions);
        if(!disposition||!canWildsCrewTravel(condition))throw new Error("This creature needs rest or care before exploring.");
        const previous=await getStore().read(ticket.owner,card.id);
        if(!g.valid(ticket))return false;
        if(previous&&previous.phase!=="completed"){
          if(previous.proofDigest!==ticket.proofDigest){
            runtime.current.delete(card.id);rows.current.delete(card.id);blockedSince.current.delete(card.id);pausedSince.current.delete(card.id);
            await getStore().supersede({ownerReceizId:ticket.owner,assetId:card.id,expectedHead:previous.head,kaiUPulse:observeWildsKaiUPulse(),replacementProofDigest:ticket.proofDigest});
            if(!g.valid(ticket))return false;
          }else{
            if(previous.phase==="blocked")throw new Error("Recall this creature before choosing another exploration route.");
            return publish(previous,ticket,true);
          }
        }
        current.feedback(`${card.manifest.name} is choosing an exploration route.`);
        const start=origin(current),spaceId=current.state.siteSpace.spaceId;
        const candidates=await prepareWildsCrewExpeditionStops({origin:start,spaceId,runtime:current.siteRuntime,obstacles:current.obstacles,
          seed:(disposition.preferenceSeed ^ Math.floor(observeWildsKaiUPulse()/1_000_000)) >>> 0,cancelled:()=>!g.valid(ticket)});
        if(!g.valid(ticket))return false;
        if(!candidates.length)throw new Error("No clear exploration route is available here. Try an open part of the trail.");
        if(!canWildsCrewTravel(readWildsCrewCondition(card,latest.current.state.adventureConditions)))throw new Error("This creature needs rest or care before exploring.");
        const row=await getStore().start({ownerReceizId:ticket.owner,assetId:card.id,proofDigest:ticket.proofDigest,disposition,origin:start,spaceId,candidates,kaiUPulse:observeWildsKaiUPulse(),requestId:crypto.randomUUID()});
        return publish(row,ticket);
      }).finally(()=>releaseUnlessActive(ticket));
    },
    async recall(assetId:string) {
      const g=guard.current!,ticket=g.begin(assetId);if(!ticket)return false;protect(ticket);
      blockedSince.current.delete(assetId);pausedSince.current.delete(assetId);
      // Queued behind an already committing start, so recall cannot lose that trip.
      return g.run(assetId,async()=>{
        if(!g.valid(ticket))return false;
        const row=await getStore().read(ticket.owner,assetId);
        if(!row||!g.valid(ticket)||row.ownerReceizId!==ticket.owner||row.assetId!==assetId||row.phase==="completed")return false;
        if(row.proofDigest!==ticket.proofDigest){
          runtime.current.delete(assetId);rows.current.delete(assetId);blockedSince.current.delete(assetId);pausedSince.current.delete(assetId);
          await getStore().supersede({ownerReceizId:ticket.owner,assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse(),replacementProofDigest:ticket.proofDigest});
          if(!g.valid(ticket))return false;
          setReports(old=>({...old,[assetId]:"Earlier trip ended after this creature’s card proof changed. Its history is preserved."}));
          latest.current.onFinished(assetId);return true;
        }
        const current=latest.current;
        return publish(await getStore().recall({ownerReceizId:ticket.owner,assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse(),returnPosition:origin(current),spaceId:current.state.siteSpace.spaceId}),ticket);
      }).finally(()=>releaseUnlessActive(ticket));
    }
  };
}
