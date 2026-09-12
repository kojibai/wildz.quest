"use client";
import { useEffect, useRef, useState } from "react";
import { createWildsCrewExpeditions, WILDS_CREW_EXPEDITION_OBSERVE_UPULSES, type WildsCrewExpedition } from "./wilds-crew-expedition";
import { prepareWildsCrewDisposition, readWildsCrewCondition } from "./wilds-crew-policy";
import { prepareWildsCrewExpeditionStops } from "./wilds-crew-expedition-stops";
import { canWildsCrewTravel } from "./wilds-crew-physical-navigation";
import { observeWildsKaiUPulse } from "./wilds-kai-runtime";
import type { WildsCrewTravelRuntime } from "./wilds-crew-travel-runtime";
import type { PlayState } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import type { WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";

export function useWildsCrewExpeditions(input:{owner:string;state:PlayState;cards:readonly PortableCardAsset[];
  siteRuntime:WildsSiteRuntimeProjection;obstacles:readonly WildsTerrainObstacle[];
  feedback:(message:string)=>void;onFinished:(assetId:string)=>void}) {
  const latest=useRef(input);latest.current=input;
  const store=useRef<ReturnType<typeof createWildsCrewExpeditions>|null>(null);
  const runtime=useRef<WildsCrewTravelRuntime>(new Map());
  const rows=useRef(new Map<string,WildsCrewExpedition>());
  const requests=useRef(new Map<string,number>());
  const requestSequence=useRef(0);
  const blockedSince=useRef(new Map<string,number>());
  const [reports,setReports]=useState<Readonly<Record<string,string>>>({});
  const getStore=()=>store.current??(store.current=createWildsCrewExpeditions());
  const origin=()=>({x:latest.current.state.player.x,y:latest.current.state.siteSpace.position.y,z:latest.current.state.player.z});
  const publish=(row:WildsCrewExpedition)=>{
    if(row.ownerReceizId!==latest.current.owner)return;
    rows.current.set(row.assetId,row);
    const message=row.phase==="completed"?`Returned · ${row.visitedPointIds.length} trail locations observed`
      :row.phase==="outbound"?`Exploring · destination ${row.stopIndex+1} of ${row.stops.length}`
      :row.phase==="observing"?"Inspecting this part of the trail"
      :row.phase==="returning"?"Returning to you":row.blocker??"Waiting for a clear route";
    setReports(old=>({...old,[row.assetId]:message}));
    if(row.phase==="completed") {runtime.current.delete(row.assetId);latest.current.onFinished(row.assetId);return;}
    if(!row.goal)return;
    const existing=runtime.current.get(row.assetId);
    runtime.current.set(row.assetId,{spaceId:row.spaceId,target:{...row.goal},position:existing?.position??null,blocked:false,paused:row.phase==="blocked"});
  };
  const rosterKey=input.cards.map(c=>`${c.id}:${c.proof.digest}`).join("|");
  useEffect(()=>{
    let cancelled=false;
    const pendingRequests=requests.current;
    rows.current.clear();runtime.current.clear();
    const current=latest.current;
    void Promise.all(current.cards.map(async card=>{
      const row=await getStore().read(current.owner,card.id);
      if(!cancelled&&row&&row.proofDigest===card.proof.digest)publish(row);
    })).catch(()=>current.feedback("Creature travel history could not be restored."));
    return()=>{cancelled=true;pendingRequests.clear();};
    // Restore only on owner/roster changes, never on player movement.
  },[input.owner,rosterKey]);
  const travelRevision=useRef(input.state.partyTravelRevision??0);
  useEffect(()=>{
    if(travelRevision.current===(input.state.partyTravelRevision??0))return;
    travelRevision.current=input.state.partyTravelRevision??0;
    requests.current.clear();runtime.current.clear();
    for(const row of rows.current.values())if(row.phase!=="completed"){
      void getStore().transport({ownerReceizId:row.ownerReceizId,assetId:row.assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse(),actualPosition:origin(),spaceId:latest.current.state.siteSpace.spaceId})
        .then(publish).catch(()=>latest.current.feedback("Travel history is waiting to reconcile; your companion travelled with you."));
    }
    // Explicit transport only. Ordinary movement never restarts excursions.
  },[input.state.partyTravelRevision]);
  useEffect(()=>{
    let busy=false,cancelled=false;
    const tick=async()=>{
      if(busy||cancelled||!rows.current.size)return;busy=true;
      try {
        for(const row of [...rows.current.values()].slice(0,3)) {
          const current=latest.current,entry=runtime.current.get(row.assetId);
          if(!entry?.position||entry.paused||row.phase==="completed"||row.phase==="blocked")continue;
          const change={ownerReceizId:row.ownerReceizId,assetId:row.assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse()};
          if(entry.blocked){
            const began=blockedSince.current.get(row.assetId)??performance.now();blockedSince.current.set(row.assetId,began);
            if(performance.now()-began>8000){publish(await getStore().block({...change,reason:"The route is blocked. Recall this creature before choosing another trip."}));continue;}
          }else blockedSince.current.delete(row.assetId);
          if(row.phase==="returning"&&Math.hypot(row.home.x-current.state.player.x,row.home.z-current.state.player.z)>2&&row.spaceId===current.state.siteSpace.spaceId)
            publish(await getStore().retargetReturn({...change,returnPosition:origin(),spaceId:row.spaceId}));
          else if(row.phase==="observing"&&row.observingSinceKaiUPulse!==null&&change.kaiUPulse-row.observingSinceKaiUPulse>=WILDS_CREW_EXPEDITION_OBSERVE_UPULSES)
            publish(await getStore().continue(change));
          else if(row.goal&&["outbound","returning"].includes(row.phase)&&Math.hypot(entry.position.x-row.goal.x,entry.position.y-row.goal.y,entry.position.z-row.goal.z)<=.8)
            publish(await getStore().arrive({...change,actualPosition:{...entry.position},spaceId:entry.spaceId}));
        }
      } catch { /* CAS loss reloads the exact retained observation; never repeat world work. */
        for(const [assetId,row]of rows.current){const current=await getStore().read(row.ownerReceizId,assetId).catch(()=>null);if(current&&current.head!==row.head)publish(current);}
      } finally {busy=false;}
    };
    const timer=window.setInterval(()=>void tick(),500);
    return()=>{cancelled=true;window.clearInterval(timer);};
    // Mutable pose bridge and latest input avoid subscriptions on movement renders.
  },[]);
  return {runtime,reports,
    async roam(card:PortableCardAsset) {
      const current=latest.current,disposition=prepareWildsCrewDisposition(card),condition=readWildsCrewCondition(card,current.state.adventureConditions);
      if(!disposition||!canWildsCrewTravel(condition))throw new Error("This creature needs rest or care before exploring.");
      const previous=await getStore().read(current.owner,card.id);
      if(previous&&previous.phase!=="completed"){if(previous.phase==="blocked")throw new Error("Recall this creature before choosing another exploration route.");publish(previous);return true;}
      const token=++requestSequence.current;requests.current.set(card.id,token);
      current.feedback(`${card.manifest.name} is choosing an exploration route.`);
      const start=origin(),spaceId=current.state.siteSpace.spaceId;
      const candidates=await prepareWildsCrewExpeditionStops({origin:start,spaceId,runtime:current.siteRuntime,obstacles:current.obstacles,
        seed:(disposition.preferenceSeed ^ Math.floor(observeWildsKaiUPulse()/1_000_000)) >>> 0,cancelled:()=>requests.current.get(card.id)!==token||latest.current.owner!==current.owner});
      if(requests.current.get(card.id)!==token)return false;
      if(!candidates.length)throw new Error("No clear exploration route is available here. Try an open part of the trail.");
      publish(await getStore().start({ownerReceizId:current.owner,assetId:card.id,proofDigest:card.proof.digest,disposition,origin:start,spaceId,candidates,kaiUPulse:observeWildsKaiUPulse(),requestId:crypto.randomUUID()}));
      return true;
    },
    async recall(assetId:string) {
      requests.current.delete(assetId);
      const row=rows.current.get(assetId);
      if(row&&row.phase!=="completed"){publish(await getStore().recall({ownerReceizId:row.ownerReceizId,assetId,expectedHead:row.head,kaiUPulse:observeWildsKaiUPulse(),returnPosition:origin(),spaceId:latest.current.state.siteSpace.spaceId}));return true;}
      return false;
    }
  };
}
