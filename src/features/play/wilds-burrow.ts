import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { sealConstructionProof, constructionProofDigest, validConstructionHead, validConstructionId, validConstructionKai } from "./wilds-construction-project";
import { verifyAnyWildsCard, rememberAdmittedWildsCardVerification, type PortableCardAsset } from "./portable-card";
import { canCreatureUseBurrow, projectCreatureCapabilityIdentity, projectCreatureRuntimeCapabilities } from "./creature-capability-identity";
import { currentCreatureHistoryProjection } from "./living-card-proof";
import { emptyAdventureCondition } from "./adventure/card-condition";
import { isLivingCardAsset } from "./living-card-types";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { wildsSiteRuntimeGroundY, prepareWildsSiteRuntime } from "./wilds-site-runtime";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition, type WildsDiscoveryPhysicalNeighborhood, type WildsDiscoverySiteProjection, type WildsSiteSpaceState } from "./wilds-discovery-sites";

type Point = Readonly<{x:number;y:number;z:number}>;
export type WildsBurrowRequest = Readonly<{kind:"entrance"|"tunnel"|"room";pointer:{x:number;z:number};heading:number;depth:number;parentId?:string}>;
export type WildsBurrowPreview = Readonly<{from:Point;to:Point;radius:number;parentId:string|null;rootId:string|null;blocker:string|null}>;
export type WildsBurrowV1 = Readonly<{
  schema:"wildz.burrow.v1"; id:string; head:string; ownerReceizId:string; commandId:string; kaiUPulse:number;
  request:WildsBurrowRequest; from:Point; to:Point; radius:number; rootId:string; parentId:string|null; parentHead:string|null;
  creature:PortableCardAsset; authority:"source-proof-object";
}>;
export type WildsBurrows = Readonly<Record<string,WildsBurrowV1>>;
const snap=(v:number)=>Math.round(v*2)/2;
const spaceId=(root:string)=>`wildz.burrow.space.v1:${root}`;
export const wildsBurrowSiteKey=(root:string)=>`wildz.burrow.site.v1:${root}`;
const EMPTY:WildsBurrows=Object.freeze({});
// Only exact deeply frozen sources constructed after full authority checks enter this cache.
const admittedSources=new WeakSet<WildsBurrowV1>();
export function wildsCreatureCanDig(card:PortableCardAsset) {
  const identity=projectCreatureCapabilityIdentity(card);
  const condition=isLivingCardAsset(card)?currentCreatureHistoryProjection(card).condition:emptyAdventureCondition(card.id);
  const runtime=projectCreatureRuntimeCapabilities(identity,condition);
  return canCreatureUseBurrow(runtime, condition);
}
export function previewWildsBurrow(burrows:WildsBurrows, physical:WildsDiscoveryPhysicalNeighborhood, request:WildsBurrowRequest, owner:string):WildsBurrowPreview {
  const zero={x:0,y:0,z:0};
  const invalid=(blocker:string):WildsBurrowPreview=>({from:zero,to:zero,radius:1.5,parentId:null,rootId:null,blocker});
  if (!request || !request.pointer || ![request.pointer.x,request.pointer.z,request.heading,request.depth].every(Number.isFinite)
    || Math.abs(request.pointer.x)>499_999_000 || Math.abs(request.pointer.z)>499_999_000
    || !Number.isInteger(request.heading) || request.heading<0 || request.heading>3
    || !Number.isInteger(request.depth*2) || Math.abs(request.depth)>2
    || !["entrance","tunnel","room"].includes(request.kind)) return invalid("Choose a valid dig position.");
  const parent=request.parentId?burrows[request.parentId]:undefined;
  if (request.kind!=="entrance" && (!parent || parent.ownerReceizId!==owner)) return invalid("Choose an existing tunnel of yours to extend.");
  if (request.kind==="entrance" && request.parentId) return invalid("An entrance starts a new underground space.");
  const x=snap(request.pointer.x),z=snap(request.pointer.z);
  const terrain=sampleWildsTerrain(x,z);
  const from=parent?{...parent.to}:{x,y:wildsSiteRuntimeGroundY(prepareWildsSiteRuntime(physical),"wildz.space.outer.v1",x,z,terrain.elevation),z};
  const directions=[[0,1],[1,0],[0,-1],[-1,0]];
  const [dx,dz]=directions[request.heading];
  const room=request.kind==="room";
  const to={x:from.x+dx*4,y:from.y-(request.kind==="entrance"?2:request.depth),z:from.z+dz*4};
  const radius=room?5:1.5;
  let blocker:string|null=null;
  if (terrain.waterDepth>0 && !parent) blocker="Choose dry ground for the entrance.";
  const rootId=parent?.rootId ?? null;
  const points=Array.from({length:9},(_,i)=>({x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,z:from.z+(to.z-from.z)*i/8}));
  if (points.some(point=>{const t=sampleWildsTerrain(point.x,point.z);return t.waterDepth>0 && point.y<t.elevation+t.waterDepth;})) blocker="This dig would open into water. Choose a dry route.";
  const root=rootId?burrows[rootId]:null;
  if (root && to.y<root.from.y-48) blocker="Keep this network within 48 metres of its entrance depth.";
  if (Object.values(burrows).some(piece=>piece.rootId===rootId && Math.hypot(piece.to.x-to.x,piece.to.y-to.y,piece.to.z-to.z)<.5)) blocker="This space is already dug. Extend a different edge.";
  // Natural interior routes remain intact; mountains themselves are diggable terrain.
  if (physical.surfaces.some(surface=>surface.kind==="interior-floor" && !surface.siteKey.startsWith("wildz.burrow.site.v1:") && points.some(point=>Math.abs(point.x-surface.center.x)<surface.halfExtents.x+radius && Math.abs(point.z-surface.center.z)<surface.halfExtents.z+radius && Math.abs(point.y-surface.center.y)<4))) blocker="An existing cave occupies this space. Move the dig beside it.";
  return {from,to,radius,parentId:parent?.id??null,rootId,blocker};
}
export function createWildsBurrow(input:{burrows:WildsBurrows;request:WildsBurrowRequest;ownerReceizId:string;creature:PortableCardAsset;commandId:string;kaiUPulse:number;actorPosition:Point}):WildsBurrowV1 {
  if (!validConstructionId(input.commandId)||!validConstructionId(input.ownerReceizId)||!validConstructionKai(input.kaiUPulse)
    || !(input.creature.manifest.ownerReceizId===input.ownerReceizId || sameWildzPlayerCoordinate(input.creature.manifest.ownerReceizId,input.ownerReceizId)) || !verifyAnyWildsCard(input.creature).ok || !wildsCreatureCanDig(input.creature)) throw new Error("wilds_burrow_digging_creature_required");
  const parent=input.request.parentId?input.burrows[input.request.parentId]:null;
  const region=wildsDiscoverySiteRegionForPosition(parent?.to??input.request.pointer);
  const preview=previewWildsBurrow(input.burrows,admitWildsDiscoveryPhysicalNeighborhood(region.x,region.z),input.request,input.ownerReceizId);
  if (preview.blocker) throw new Error(preview.blocker);
  if (![input.actorPosition.x,input.actorPosition.y,input.actorPosition.z].every(Number.isFinite)
    || Math.hypot(input.actorPosition.x-preview.from.x,input.actorPosition.y-preview.from.y,input.actorPosition.z-preview.from.z)>6) throw new Error("Move within 6 metres of the dig.");
  if(parent && input.kaiUPulse<parent.kaiUPulse) throw new Error("wilds_burrow_time_invalid");
  const id=`wildz:burrow:${constructionProofDigest({owner:input.ownerReceizId,commandId:input.commandId}).slice(7)}`;
  const source=sealConstructionProof({schema:"wildz.burrow.v1" as const,id,ownerReceizId:input.ownerReceizId,commandId:input.commandId,kaiUPulse:input.kaiUPulse,request:input.request,
    from:preview.from,to:preview.to,radius:preview.radius,rootId:preview.rootId??id,parentId:preview.parentId,parentHead:parent?.head??null,creature:input.creature,authority:"source-proof-object" as const});
  rememberAdmittedWildsCardVerification(source.creature);
  admittedSources.add(source);
  return source;
}
export function verifyWildsBurrow(value:unknown):value is WildsBurrowV1 {
  try {
    const p=value as WildsBurrowV1;
    if(admittedSources.has(p))return true;
    const {head,...basis}=p;
    return p.schema==="wildz.burrow.v1" && validConstructionHead(head) && constructionProofDigest(basis)===head
      && validConstructionId(p.id)&&validConstructionId(p.ownerReceizId)&&validConstructionId(p.commandId)&&validConstructionKai(p.kaiUPulse)
      && p.authority==="source-proof-object" && verifyAnyWildsCard(p.creature).ok && wildsCreatureCanDig(p.creature)
      && [p.from.x,p.from.y,p.from.z,p.to.x,p.to.y,p.to.z,p.radius].every(Number.isFinite)
      && p.radius===(p.request.kind==="room"?5:1.5) && (p.parentId===null?p.parentHead===null&&p.rootId===p.id:validConstructionHead(p.parentHead));
  }catch{return false;}
}
/** Re-derive every source at admission/restore. Rendering and movement only use the admitted map. */
export function admitWildsBurrows(input:unknown):Record<string,WildsBurrowV1> {
  const accepted:Record<string,WildsBurrowV1>={};
  if(!input||typeof input!=="object"||Array.isArray(input))return accepted;
  const pending=Object.entries(input).filter(([id,p])=>verifyWildsBurrow(p)&&id===p.id).map(([,p])=>p as WildsBurrowV1).sort((a,b)=>a.kaiUPulse-b.kaiUPulse||a.id.localeCompare(b.id));
  for(let pass=0;pending.length&&pass<=Object.keys(input).length;pass++) {
    let changed=false;
    for(let i=pending.length-1;i>=0;i--){
      const p=pending[i];
      if(p.parentId&&!accepted[p.parentId])continue;
      try{
        if(p.parentId&&accepted[p.parentId].head!==p.parentHead)throw new Error("parent");
        const next=admittedSources.has(p)?p:createWildsBurrow({burrows:accepted,request:p.request,ownerReceizId:p.ownerReceizId,creature:p.creature,commandId:p.commandId,kaiUPulse:p.kaiUPulse,actorPosition:p.from});
        if(next.head===p.head)accepted[p.id]=next;
      }catch{/* A source with invalid geometry or missing ancestors cannot create space. */}
      pending.splice(i,1);changed=true;
    }
    if(!changed)break;
  }
  return accepted;
}
const projectionCache=new WeakMap<WildsDiscoveryPhysicalNeighborhood,WeakMap<WildsBurrows,WildsDiscoveryPhysicalNeighborhood>>();
export function composeWildsBurrowPhysical(natural:WildsDiscoveryPhysicalNeighborhood,burrows:WildsBurrows=EMPTY):WildsDiscoveryPhysicalNeighborhood{
  const cached=projectionCache.get(natural)?.get(burrows);if(cached)return cached;
  const roots=Object.values(burrows).filter(p=>p.id===p.rootId && Object.values(burrows).some(piece=>piece.rootId===p.id && Math.abs(Math.floor(piece.to.x/128)-natural.regionX)<=1 && Math.abs(Math.floor(piece.to.z/128)-natural.regionZ)<=1));
  if(!roots.length)return natural;
  const solids=[...natural.solids];
  const sites=[...natural.sites],surfaces=[...natural.surfaces],ceilings=[...natural.ceilings],portals=[...natural.portals],encounterVolumes=[...natural.encounterVolumes];
  for(const root of roots){
    const key=wildsBurrowSiteKey(root.id),space=spaceId(root.id),pieces=Object.values(burrows).filter(p=>p.rootId===root.id && Math.abs(Math.floor(p.to.x/128)-natural.regionX)<=1 && Math.abs(Math.floor(p.to.z/128)-natural.regionZ)<=1);
    const chambers=pieces.map(p=>({id:p.id,center:p.to,radius:p.radius}));
    const site:WildsDiscoverySiteProjection={version:"wildz.discovery-site.v1",key,regionX:Math.floor(root.from.x/128),regionZ:Math.floor(root.from.z/128),slot:0,family:"cave",
      entrance:{...root.from,radius:1.5,layer:"ground"},collisionEnvelope:{center:root.from,halfExtents:{x:3,y:3,z:3}},
      routes:[{id:`${key}:route`,safe:true,requirements:[],rewardTier:0,points:[root.from,root.to]}],habitat:{layer:"ground",biome:"burrow"},mountain:null,waterfall:null,
      interior:{kind:"cave",scaleClass:"underground-world",chambers,exits:[root.from],streamRadius:0}};
    sites.push(site);
    portals.push({id:`${root.id}:entrance`,siteKey:key,position:root.from,fromSpaceId:"wildz.space.outer.v1",toSpaceId:space});
    for(const p of pieces) {
      // Half-metre treads share exact floor/ceiling geometry with physics and camera.
      for(let i=0;i<=8;i++){
        const t=i/8,center={x:p.from.x+(p.to.x-p.from.x)*t,y:p.from.y+(p.to.y-p.from.y)*t,z:p.from.z+(p.to.z-p.from.z)*t};
        const radius=p.request.kind==="room"&&i===8?p.radius:1.5,halfExtents=p.request.kind==="room"&&i===8?{x:radius,y:.15,z:radius}:Math.abs(p.to.x-p.from.x)>.1?{x:.26,y:.15,z:radius}:{x:radius,y:.15,z:.26},id=`${p.id}:cell:${i}`;
        surfaces.push({id,siteKey:key,spaceId:space,kind:"interior-floor",center,halfExtents,flooded:false});
        ceilings.push({id:`${id}:ceiling`,siteKey:key,spaceId:space,center:{...center,y:center.y+3.5},halfExtents});
        encounterVolumes.push({id:`${id}:volume`,siteKey:key,spaceId:space,layer:"ground",center,halfExtents:{x:radius,y:3,z:radius}});
      }
    }
    const cells=new Map<string,Point[]>();
    for(const floor of surfaces.filter(s=>s.spaceId===space)){
      for(let x=Math.ceil((floor.center.x-floor.halfExtents.x)*2);x<=Math.floor((floor.center.x+floor.halfExtents.x)*2);x++)
        for(let z=Math.ceil((floor.center.z-floor.halfExtents.z)*2);z<=Math.floor((floor.center.z+floor.halfExtents.z)*2);z++){
          const key=`${x}:${z}`,point={x:x/2,y:floor.center.y,z:z/2},bucket=cells.get(key)??[];
          if(!bucket.some(p=>Math.abs(p.y-point.y)<.1))bucket.push(point);
          cells.set(key,bucket);
        }
    }
    let wall=0;
    for(const bucket of cells.values())for(const cell of bucket)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(cells.get(`${cell.x*2+dx}:${cell.z*2+dz}`)?.some(p=>Math.abs(p.y-cell.y)<=.75))continue;
      solids.push({id:`burrow-wall:${root.id}:${wall++}`,siteKey:key,spaceId:space,center:{x:cell.x+dx*.25,y:cell.y+1.75,z:cell.z+dz*.25},halfExtents:{x:dx?.08:.25,y:1.75,z:dz?.08:.25}});
    }
  }
  const next=Object.freeze({...natural,solids:Object.freeze(solids),sites:Object.freeze(sites),surfaces:Object.freeze(surfaces),ceilings:Object.freeze(ceilings),portals:Object.freeze(portals),encounterVolumes:Object.freeze(encounterVolumes)});
  let map=projectionCache.get(natural);if(!map){map=new WeakMap();projectionCache.set(natural,map);}map.set(burrows,next);
  return next;
}
export function restoreWildsBurrowSpace(value:unknown,burrows:WildsBurrows,composeInterior?:(physical:WildsDiscoveryPhysicalNeighborhood)=>WildsDiscoveryPhysicalNeighborhood):WildsSiteSpaceState|null {
  if(!value||typeof value!=="object")return null;
  const s=value as WildsSiteSpaceState,p=s.position;
  if(s.version!=="wildz.site-space-state.v1"||!p||![p.x,p.y,p.z].every(Number.isFinite))return null;
  const root=Object.values(burrows).find(root=>root.id===root.rootId&&spaceId(root.id)===s.spaceId&&wildsBurrowSiteKey(root.id)===s.siteKey);
  if(!root)return null;
  const region=wildsDiscoverySiteRegionForPosition(p),dug=composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(region.x,region.z),burrows),physical=composeInterior?composeInterior(dug):dug;
  const floor=physical.surfaces.find(f=>f.id===s.surfaceId&&f.spaceId===s.spaceId&&Math.abs(p.x-f.center.x)<=f.halfExtents.x&&Math.abs(p.z-f.center.z)<=f.halfExtents.z&&Math.abs(p.y-f.center.y)<.75);
  return floor?Object.freeze({...s,position:{...p,y:floor.center.y},flooded:false}):null;
}
