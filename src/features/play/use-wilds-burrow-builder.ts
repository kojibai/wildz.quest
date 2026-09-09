"use client";
import {useMemo,useRef,useState} from "react";
import type {useWildsWorld} from "./use-wilds-world";
import {previewWildsBurrow,wildsCreatureCanDig,wildsBurrowSiteKey,type WildsBurrowRequest} from "./wilds-burrow";
import type {WildsDiscoveryPhysicalNeighborhood,WildsSiteSpaceState} from "./wilds-discovery-sites";
import type {PortableCardAsset} from "./portable-card";
export function useWildsBurrowBuilder({world,physical,space,player,owner,card,feedback,onDig,onEnter}:{world:ReturnType<typeof useWildsWorld>;physical:WildsDiscoveryPhysicalNeighborhood;space:WildsSiteSpaceState;player:{x:number;z:number};owner:string;card:PortableCardAsset|null|undefined;feedback:(s:string)=>void;onDig:()=>void;onEnter?:(siteKey:string)=>void}){
  const [open,setOpen]=useState(false),[heading,setHeading]=useState(0),[depth,setDepth]=useState(0);
  const [kind,setKind]=useState<WildsBurrowRequest["kind"]>("entrance"),[parentId,setParentId]=useState<string>(),[pointer,setPointer]=useState<{x:number;z:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const lock=useRef(false),burrows=world.snapshot?.burrows;
  const nearby=useMemo(()=>Object.values(burrows??{}).filter(p=>p.ownerReceizId===owner && Math.hypot(p.to.x-player.x,p.to.z-player.z)<=12 && (space.spaceId==="wildz.space.outer.v1"?p.id===p.rootId:wildsBurrowSiteKey(p.rootId)===space.siteKey)),[burrows,owner,player.x,player.z,space.spaceId,space.siteKey]);
  const request=useMemo<WildsBurrowRequest>(()=>({kind,pointer:pointer??{x:player.x,z:player.z},heading,depth,...(kind!=="entrance"?{parentId}: {})}),[kind,pointer,player.x,player.z,heading,depth,parentId]);
  const preview=useMemo(()=>open?previewWildsBurrow(burrows??{},physical,request,owner):null,[open,burrows,physical,request,owner]);
  const blocker=!card||!wildsCreatureCanDig(card)?"Lead with a creature that can dig.":!world.snapshot?"Your saved world is loading.":preview?.blocker??(preview&&Math.hypot(preview.from.x-player.x,preview.from.z-player.z,preview.from.y-space.position.y)>6?"Move closer to this dig (within 6 m).":null);
  const entrance=space.spaceId==="wildz.space.outer.v1"?nearby.find(p=>p.id===p.rootId&&Math.hypot(p.from.x-player.x,p.from.z-player.z)<=3.2&&Math.abs(p.from.y-space.position.y)<=3):null;
  return {open,kind,heading,depth,preview,nearby,parentId,busy,error,blocker,canEnter:Boolean(entrance&&onEnter),
    enter:()=>{if(!lock.current&&entrance&&onEnter){onEnter(wildsBurrowSiteKey(entrance.id));setOpen(false);}},
    begin:(angle:number)=>{if(lock.current)return;setOpen(true);setError(null);setHeading(((Math.round(angle/(Math.PI/2))%4)+4)%4);setPointer(player);setDepth(0);const parent=[...nearby].sort((a,b)=>Math.hypot(a.to.x-player.x,a.to.z-player.z)-Math.hypot(b.to.x-player.x,b.to.z-player.z))[0];setParentId(parent?.id);setKind(space.spaceId==="wildz.space.outer.v1"?"entrance":"tunnel");},
    close:()=>{if(!lock.current)setOpen(false);},
    setKind:(next:WildsBurrowRequest["kind"])=>{if(!lock.current){setKind(next);setError(null);}},
    setParentId:(id:string)=>{if(!lock.current){setParentId(id);setError(null);}},
    rotate:()=>{if(!lock.current)setHeading(v=>(v+1)%4);},
    changeDepth:(delta:number)=>{if(!lock.current)setDepth(v=>Math.max(-2,Math.min(2,v+delta)));},
    point:(p:{x:number;z:number})=>{if(lock.current)return;if(kind==="entrance")setPointer(p);else{const next=[...nearby].sort((a,b)=>Math.hypot(a.to.x-p.x,a.to.z-p.z)-Math.hypot(b.to.x-p.x,b.to.z-p.z))[0];if(next)setParentId(next.id);}},
    dig:async()=>{if(lock.current||blocker||!preview)return;lock.current=true;setBusy(true);setError(null);feedback("Digging…");
      try{const before=new Set(Object.keys(burrows??{}));const next=await world.digBurrow(request,{...player,y:space.position.y});const added=Object.values(next.burrows??{}).find(p=>!before.has(p.id));
        if(added){setParentId(added.id);setKind("tunnel");setDepth(0);}onDig();feedback(kind==="entrance"?"Entrance dug. Enter your burrow to extend it.":kind==="room"?"Room dug. Continue from any tunnel end.":"Tunnel extended. Your underground world is saved.");}
      catch(cause){const text=cause instanceof Error?cause.message:"This dig could not finish. Try again.";setError(text);feedback(text);}
      finally{lock.current=false;setBusy(false);}
    }
  };
}
