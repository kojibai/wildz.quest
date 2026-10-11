import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {deriveWildsBuildingClearanceEventPayload,isWildsBuildingClearanceCandidate,projectWildsBuildingClearancePiles,WILDS_BUILDING_CLEARANCE_RULE_HEAD,type WildsBuildingClearanceEventPayload,type WildsBuildingClearanceV1,type WildsClearanceHistoricalContext,type WildsBuildingClearanceSourceCheckpoints} from '../../features/play/wilds-building-clearance';
import {compileWorldCreationSource,projectWildsCreationPersistence,CREATION_WORLD_RULE} from '../../features/play/creation/world-source';
import {projectCreationPhysical} from '../../features/play/creation/projection';
import {overlapsCreationSolids,type CreationSolid} from '../../features/play/creation/geometry';
import {constructionGeometryForCollections} from '../../features/play/wilds-construction-neighborhood';
import {projectWildsConstructionTerrain} from '../../features/play/wilds-construction-terrain';
import {projectWildsRenderedLivingObstacles,wildsTerrainObstaclesForTile} from '../../features/play/wilds-terrain-obstacles';
import {projectWildsResourceSourceForObstacle} from '../../features/play/wilds-resource-authority';
import {WILDS_TERRAIN_TILE_SIZE} from '../../features/play/wilds-terrain-authority';
import {projectWildsStructureSupports,WILDS_TRAIL_BRIDGE_HALF_WIDTH,WILDS_TRAIL_BRIDGE_HALF_LENGTH} from '../../features/play/wilds-structure-support';
import {WILDS_BUILD_FLAT_APRON} from '../../features/play/wilds-build-ground';
import {createWildsClearanceFoodItem,createWildsNourishmentState,wildsNourishmentPlantsForTile,wildsNourishmentSourceAt,WILDS_NOURISHMENT_GATHER_REACH,WILDS_NOURISHMENT_VERTICAL_REACH} from '../../features/play/wilds-nourishment';
import {verifyWildsMaterialLot,type WildsMaterialLotV1} from '../../features/play/wilds-steward-construction';
import type {WildsResourcePackageMember} from '../../features/play/wilds-resource-package';
import type {WildsWorldProjection} from '../../features/play/wilds-world-state';
import {replayWildsResourceJournalOwnerV128,type WildsResourceJournalV128} from './wilds-resource-journal-v128';
import type {WildsResourceGameplayCommandV128} from './wilds-resource-gameplay-v128';
import type {WildsNourishmentState} from '../../features/play/wilds-nourishment';
import type {WildsResourceSourceProofV128} from './wilds-resource-exchange-v128';

type Point=Readonly<{x:number;y:number;z:number}>;
export type WildsClearanceDeriveCommandV128=Readonly<{type:'construction.clearance.derive';commandId:string;expectedHead:string;payload:WildsBuildingClearanceEventPayload}>;
export type WildsClearancePickupCommandV128=Readonly<{type:'construction.clearance.pickup';commandId:string;expectedHead:string;ruleHead:string;clearance:WildsBuildingClearanceV1;pileId:string;priorTaken:number;player:Point;spaceId:string}>;
export type WildsClearanceCommandV128=WildsClearanceDeriveCommandV128|WildsClearancePickupCommandV128;
export type WildsClearancePickupV128=Readonly<{clearanceId:string;pileId:string;taken:number;member:WildsResourcePackageMember}>;
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value));
function fail(reason:string):never{throw Error(`wilds_clearance_${reason}`);}
export const wildsClearancePileHeadV128=(clearanceId:string,pileId:string,taken:number)=>digest({ruleHead:WILDS_BUILDING_CLEARANCE_RULE_HEAD,clearanceId,pileId,taken});

/** Deterministic world consequence only. Native admission separately checks the
 * exact manifest, prior taken count, source head and actor against shared replay. */
export function resolveWildsClearancePickupV128(command:WildsClearancePickupCommandV128,owner:string,kaiUPulse:number):WildsClearancePickupV128 {
 if(Object.keys(command).some(key=>!['type','commandId','expectedHead','ruleHead','clearance','pileId','priorTaken','player','spaceId','kai'].includes(key))
  ||command.ruleHead!==WILDS_BUILDING_CLEARANCE_RULE_HEAD||!isWildsBuildingClearanceCandidate(command.clearance)
  ||!Number.isSafeInteger(kaiUPulse)||kaiUPulse<command.clearance.kaiUPulse||!/^[a-f0-9]{64}$/.test(command.expectedHead)
  ||!Number.isSafeInteger(command.priorTaken)||command.priorTaken<0)fail('pickup_invalid');
 const pile=projectWildsBuildingClearancePiles([command.clearance],{[command.pileId]:command.priorTaken}).find(item=>item.pileId===command.pileId);
 if(!pile)fail('pile_empty');
 if(command.spaceId!=='wildz.space.outer.v1'||![command.player.x,command.player.y,command.player.z].every(Number.isFinite)
  ||Math.hypot(command.player.x-pile.position.x,command.player.z-pile.position.z)>WILDS_NOURISHMENT_GATHER_REACH
  ||Math.abs(command.player.y-pile.position.y)>WILDS_NOURISHMENT_VERTICAL_REACH)fail('pickup_unreachable');
 const taken=command.priorTaken+1,pickupHead=wildsClearancePileHeadV128(pile.clearanceId,pile.pileId,taken);
 let member:WildsResourcePackageMember;
 if(pile.kind==='food'){
  const harvested=Number(pile.sourceHead.split('|').at(-1));
  const foodItem=createWildsClearanceFoodItem({ownerReceizId:owner,clearanceId:pile.clearanceId,pileId:pile.pileId,sourceId:pile.sourceId,sourceHead:pile.sourceHead,cropDay:pile.cropDay!,slot:harvested+taken,clearanceKaiUPulse:command.clearance.kaiUPulse,kaiUPulse,pickupHead});
  const nourishment={...createWildsNourishmentState(owner),lastKaiUPulse:kaiUPulse,items:{[foodItem.itemId]:structuredClone(foodItem)}};
  member={kind:'food',id:foodItem.itemId,foodItem,nourishment};
 }else{
  const match=/^wildz\.resource\.v1:terrain:(-?\d+):(-?\d+):(tree|rock):(\d+)$/.exec(pile.sourceId);
  const obstacle=match&&wildsTerrainObstaclesForTile(Number(match[1]),Number(match[2])).find(item=>item.id===`wildz.terrain.v1:${match[1]}:${match[2]}:${match[3]}:${match[4]}`);
  if(!obstacle)fail('material_source_invalid');const original=projectWildsResourceSourceForObstacle(obstacle);
  const basis={schema:'wildz.material-lot.v1' as const,lotId:`wildz:material:${pile.kind}:${digest({clearanceId:pile.clearanceId,pileId:pile.pileId,taken,owner}).slice(7)}`,kind:pile.kind,quantity:1 as const,quality:original.quality as WildsMaterialLotV1['quality'],ownerReceizId:owner,
   source:{sourceId:pile.sourceId,sourceHead:wildsClearancePileHeadV128(pile.clearanceId,pile.pileId,command.priorTaken),admittedSourceHead:pickupHead,kaiUPulse},contributors:{explorerReceizId:owner},authority:'source-proof-object' as const};
  const materialLot={...basis,head:digest(basis)};if(!verifyWildsMaterialLot(materialLot))fail('material_lot_invalid');member={kind:'material',id:materialLot.lotId,materialLot};
 }
 return {clearanceId:pile.clearanceId,pileId:pile.pileId,taken,member};
}

function buildingSolids(world:WildsWorldProjection,id:string):readonly CreationSolid[]{
 const source=projectWildsCreationPersistence(world).creations[id];
 if(source)return projectCreationPhysical(source.instance,source.command.definition,compileWorldCreationSource(source)).solids;
 const component=world.constructionComponents[id];
 if(!component)fail('building_unadmitted');
 return constructionGeometryForCollections(world.constructionMaterialContributions,world.constructionWorkContributions)(component).solids.map(solid=>({...solid,yaw:0}));
}
const horizontal=(solid:CreationSolid,extra=0)=>({...solid,center:{...solid.center,y:0},halfExtents:{x:solid.halfExtents.x+extra,y:1,z:solid.halfExtents.z+extra}});
function neighborhood(world:WildsWorldProjection,id:string){
 const solids=buildingSolids(world,id),bottom=Math.min(...solids.map(s=>s.center.y-s.halfExtents.y));
 const feet=solids.filter(s=>s.center.y-s.halfExtents.y<=bottom+.025);
 const regions=feet.map(s=>{const c=Math.abs(Math.cos(s.yaw)),v=Math.abs(Math.sin(s.yaw));return {minX:s.center.x-c*s.halfExtents.x-v*s.halfExtents.z-24,maxX:s.center.x+c*s.halfExtents.x+v*s.halfExtents.z+24,minZ:s.center.z-v*s.halfExtents.x-c*s.halfExtents.z-24,maxZ:s.center.z+v*s.halfExtents.x+c*s.halfExtents.z+24};});
 const intersects=(s:CreationSolid)=>regions.some(r=>{const c=Math.abs(Math.cos(s.yaw)),v=Math.abs(Math.sin(s.yaw)),x=c*s.halfExtents.x+v*s.halfExtents.z,z=v*s.halfExtents.x+c*s.halfExtents.z;return s.center.x+x>=r.minX&&s.center.x-x<=r.maxX&&s.center.z+z>=r.minZ&&s.center.z-z<=r.maxZ;});
 return {feet,regions,intersects};
}
/** Only called on an explicit source action; never on movement/render frames. */
export async function deriveWildsClearanceCommandV128(input:Readonly<{state:WildsResourceJournalV128;ownerReceizId:string;gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[];buildingId:string;buildingHead:string;expectedHead:string;kaiUPulse:number;commandId:string}>):Promise<WildsClearanceDeriveCommandV128>{
 const local=await replayWildsResourceJournalOwnerV128(input.state,input.ownerReceizId,input.gameplayOwnerId,input.commands);
 const neighborhoodOfBuilding=neighborhood(local.world,input.buildingId),others=[];
 for(const [owner,trace] of Object.entries(input.state.traces))if(owner!==input.ownerReceizId)others.push(await replayWildsResourceJournalOwnerV128(input.state,owner,trace.gameplayOwnerId,trace.commands));
 const all=[local,...others],tiles=new Set<string>();
 for(const s of neighborhoodOfBuilding.feet){const c=Math.abs(Math.cos(s.yaw)),v=Math.abs(Math.sin(s.yaw)),x=c*(s.halfExtents.x+WILDS_BUILD_FLAT_APRON+8)+v*(s.halfExtents.z+WILDS_BUILD_FLAT_APRON+8),z=v*(s.halfExtents.x+WILDS_BUILD_FLAT_APRON+8)+c*(s.halfExtents.z+WILDS_BUILD_FLAT_APRON+8);
  for(let tx=Math.floor((s.center.x-x)/WILDS_TERRAIN_TILE_SIZE);tx<=Math.floor((s.center.x+x)/WILDS_TERRAIN_TILE_SIZE);tx++)for(let tz=Math.floor((s.center.z-z)/WILDS_TERRAIN_TILE_SIZE);tz<=Math.floor((s.center.z+z)/WILDS_TERRAIN_TILE_SIZE);tz++){tiles.add(`${tx}:${tz}`);if(tiles.size>CREATION_WORLD_RULE.maximumTerrainTiles)fail('footprint_budget');}}
 const materials:Record<string,WildsBuildingClearanceSourceCheckpoints['materials'][string]>={},food:Record<string,WildsBuildingClearanceSourceCheckpoints['food'][string]>={};
 for(const tile of [...tiles].sort()){const [x,z]=tile.split(':').map(Number);
  for(const obstacle of wildsTerrainObstaclesForTile(x,z)){const source=projectWildsResourceSourceForObstacle(obstacle),head=input.state.frontiers[`material:${source.sourceId}`];
   const checkpoint=head?(all.map(row=>row.world.harvestedSources[source.sourceId]).find(row=>row?.head===head)??fail('material_frontier_missing')):null;
   if(checkpoint&&Number(checkpoint.lastHarvestKaiPulse)>input.kaiUPulse)fail('source_time_stale');
   materials[source.sourceId]=checkpoint;}
  for(const plant of wildsNourishmentPlantsForTile(x,z)){const crop=wildsNourishmentSourceAt(plant,undefined,input.kaiUPulse),head=input.state.frontiers[`food:${plant.sourceId}:${crop.cropDay}`];
   if(all.some(row=>(row.nourishment.sources[plant.sourceId]?.lastKaiUPulse??0)>input.kaiUPulse))fail('source_time_stale');
   food[plant.sourceId]=head?(all.map(row=>row.nourishment.sources[plant.sourceId]).find(row=>row&&wildsNourishmentSourceAt(plant,row,input.kaiUPulse).head===head)??fail('food_frontier_missing')):null;}
 }
 const solids:CreationSolid[]=[],terrain:WildsClearanceHistoricalContext['terrain'][number][]=[],piles:Point[]=[];
 for(const row of others){
  for(const source of Object.values(projectWildsCreationPersistence(row.world).creations))if(source.instance.spaceId==='wildz.space.outer.v1')solids.push(...projectCreationPhysical(source.instance,source.command.definition,compileWorldCreationSource(source)).solids.filter(neighborhoodOfBuilding.intersects));
  for(const obstacle of projectWildsRenderedLivingObstacles(row.world)){const solid={id:obstacle.id,center:obstacle.shape.kind==='box'?obstacle.position:{...obstacle.position,y:obstacle.position.y+obstacle.shape.height/2},halfExtents:obstacle.shape.kind==='box'?{x:obstacle.shape.halfX,y:obstacle.shape.halfY,z:obstacle.shape.halfZ}:{x:obstacle.radius,y:obstacle.shape.height/2,z:obstacle.radius},yaw:0};if(neighborhoodOfBuilding.intersects(solid))solids.push(solid);}
  terrain.push(...projectWildsConstructionTerrain(row.world).filter(pad=>neighborhoodOfBuilding.intersects({...pad,halfExtents:{...pad.halfExtents,y:1}})));
 }
 for(const clearance of Object.values(input.state.clearances??{}))for(const source of clearance.sources)if(source.remaining>0&&neighborhoodOfBuilding.regions.some(r=>source.position.x>=r.minX&&source.position.x<=r.maxX&&source.position.z>=r.minZ&&source.position.z<=r.maxZ))piles.push(source.position);
 if(solids.length+terrain.length+piles.length>4096)fail('context_budget');
 const ordered=<T>(values:T[])=>values.sort((a,b)=>canonicalPortableCardJson(a).localeCompare(canonicalPortableCardJson(b)));
 const historicalContext={solids:ordered(solids),terrain:ordered(terrain),piles:ordered(piles)};
 const blocked=[...solids,...terrain.map(pad=>({...pad,halfExtents:{...pad.halfExtents,y:1}}))];
 if(neighborhoodOfBuilding.feet.some(s=>blocked.some(other=>overlapsCreationSolids(horizontal(s,WILDS_BUILD_FLAT_APRON),horizontal(other)))))fail('established_structure_overlap');
 const payload=deriveWildsBuildingClearanceEventPayload({world:local.world,buildingId:input.buildingId,buildingHead:input.buildingHead,kaiUPulse:input.kaiUPulse,
  sourceCheckpoints:{materials,food,retiredSourceIds:Object.keys(input.state.retiredSourceIds??{}).filter(id=>Object.hasOwn(materials,id)||Object.hasOwn(food,id)).sort()},historicalContext});
 return {type:'construction.clearance.derive',commandId:input.commandId,expectedHead:input.expectedHead,payload};
}

export type WildsClearancePickupProposalV128=Readonly<{ownerReceizId:string;gameplayOwnerId:string;kaiUPulse:number;command:WildsClearancePickupCommandV128}>;
/** Zero writes. This candidate is not inventory or native source authority. */
export function planWildsClearancePickupV128(input:Readonly<{source:{state:Pick<WildsResourceJournalV128,'clearances'|'clearanceTaken'>;predecessor:{head:{head:string}}};clearanceId:string;pileId:string;expectedHead:string;ownerReceizId:string;gameplayOwnerId:string;player:Point;spaceId:string;kaiUPulse:number;commandId:string}>):WildsClearancePickupProposalV128{
 if(input.expectedHead!==input.source.predecessor.head.head)fail('source_stale');
 const clearance=input.source.state.clearances?.[input.clearanceId];if(!clearance)fail('clearance_not_reserved');
 const command:WildsClearancePickupCommandV128={type:'construction.clearance.pickup',commandId:input.commandId,expectedHead:input.expectedHead,ruleHead:WILDS_BUILDING_CLEARANCE_RULE_HEAD,clearance,pileId:input.pileId,priorTaken:input.source.state.clearanceTaken?.[input.pileId]??0,player:{...input.player},spaceId:input.spaceId};
 resolveWildsClearancePickupV128(command,input.gameplayOwnerId,input.kaiUPulse);
 return {ownerReceizId:input.ownerReceizId,gameplayOwnerId:input.gameplayOwnerId,kaiUPulse:input.kaiUPulse,command};
}
export type WildsClearanceAdmissionFailureV128=Readonly<{status:'pending'|'rejected';attemptId:string;members:readonly [];reason:string}>;
export type WildsClearanceAdmissionV128=Readonly<{status:'admitted';members:readonly WildsResourcePackageMember[];projection:WildsWorldProjection;nourishment:WildsNourishmentState;state:WildsResourceJournalV128;proof:WildsResourceSourceProofV128}>;
export type WildsClearanceAdmittedGameplayV128=Omit<WildsClearanceAdmissionV128,'state'|'proof'>;
/** Uncertainty never credits inventory or substitutes a fresh attempt. The
 * caller must recover this exact durable identity before offering another. */
export async function captureWildsClearanceAdmissionV128<T>(attemptId:string,run:()=>Promise<T>):Promise<T|WildsClearanceAdmissionFailureV128>{
 try{return await run();}catch(error){
  const reason=error instanceof Error?error.message:'wilds_clearance_admission_unknown';
  return {status:'pending',attemptId,members:[],reason};
 }
}
export async function admitWildsClearancePickupV128(proposal:WildsClearancePickupProposalV128,nativePort:{admitClearancePickup(proposal:WildsClearancePickupProposalV128):Promise<WildsClearanceAdmissionV128|WildsClearanceAdmissionFailureV128>}){
 try{resolveWildsClearancePickupV128(proposal.command,proposal.gameplayOwnerId,proposal.kaiUPulse);}catch(error){
  return {status:'rejected' as const,attemptId:proposal.command.commandId,members:[] as const,reason:error instanceof Error?error.message:'wilds_clearance_pickup_invalid'};
 }
 return captureWildsClearanceAdmissionV128(proposal.command.commandId,()=>nativePort.admitClearancePickup(proposal));
}
export function assertWildsClearancePickupCurrentV128(state:WildsResourceJournalV128,command:WildsClearancePickupCommandV128){
 if(!same(state.clearances?.[command.clearance.clearanceId],command.clearance))fail('clearance_not_reserved');
 if((state.clearanceTaken?.[command.pileId]??0)!==command.priorTaken)fail('pile_stale');
}

/** Decision over already independently opened, current native ancestry. This
 * pure comparison is not a verifier and must never receive a public locator as
 * authority. Unknown currentness and divergent histories remain pending. */
export function classifyWildsClearanceRecoveryV128(input:{event:import('./wilds-resource-journal-v128').WildsResourceJournalEventV128;previous:readonly string[];current:{events:readonly {event:import('./wilds-resource-journal-v128').WildsResourceJournalEventV128}[];sourceArtifactShas:readonly string[]}|null}):'admitted'|'rejected'|'pending'{
 const {current,previous,event}=input;if(!current)return 'pending';
 const accepted=current.events.find(row=>row.event.ownerReceizId===event.ownerReceizId&&row.event.attemptId===event.attemptId);
 if(accepted)return same(accepted.event,event)?'admitted':'pending';
 if(current.sourceArtifactShas.length>previous.length&&previous.every((sha,index)=>current.sourceArtifactShas[index]===sha))return 'rejected';
 return 'pending';
}

/** Application publication preflight, never a historical-law rewrite. Both
 * states are derived from the exact independently admitted predecessor and the
 * candidate reducer. The publisher CAS must bind that same predecessor. */
export async function assertWildsPaidPlacementFrontierV128(before:WildsResourceJournalV128,event:import('./wilds-resource-journal-v128').WildsResourceJournalEventV128,after:WildsResourceJournalV128){
 if(event.kind!=='replay'&&event.kind!=='use'&&event.kind!=='reserve')return;
 const unseen=event.commands.slice(before.traces[event.ownerReceizId]?.commands.length??0);
 const changed=unseen.filter(entry=>entry.kind==='world'&&(entry.command.type==='creation.construct'||entry.command.type==='creation.evolve'
  ||entry.command.type.startsWith('construction.component.')||entry.command.type.startsWith('construction.site.')||entry.command.type.startsWith('structure.')));
 if(!changed.length)return;
 const next=await replayWildsResourceJournalOwnerV128(after,event.ownerReceizId,event.gameplayOwnerId,event.commands);
 const old=await replayWildsResourceJournalOwnerV128(before,event.ownerReceizId,event.gameplayOwnerId,before.traces[event.ownerReceizId]?.commands??[]);
 const candidateIds=new Set<string>(),siteIds=new Set<string>();
 for(const entry of changed){if(entry.kind!=='world')continue;const cmd=entry.command;
  if(cmd.type==='creation.construct'||cmd.type==='creation.evolve')candidateIds.add(cmd.instanceId);
  if('siteId'in cmd&&typeof cmd.siteId==='string')siteIds.add(cmd.siteId);
  if('componentId'in cmd&&typeof cmd.componentId==='string')candidateIds.add(cmd.componentId);
 }
 for(const id of Object.keys(next.world.constructionComponents))if(!old.world.constructionComponents[id])candidateIds.add(id);
 for(const id of Object.keys(next.world.constructionSites))if(!old.world.constructionSites[id])siteIds.add(id);
 // Canonical legacy blueprint footprints reserve the same floor/deck area as
 // their completed supports, including the empty space between rendered posts.
 const siteFootprint=(site:WildsWorldProjection['constructionSites'][string]):CreationSolid=>({id:site.siteId,center:{...site.position,y:site.position.y+.2},halfExtents:{x:site.blueprint==='trail-bridge'?WILDS_TRAIL_BRIDGE_HALF_WIDTH:2.8,y:.2,z:site.blueprint==='trail-bridge'?WILDS_TRAIL_BRIDGE_HALF_LENGTH:2.4},yaw:site.rotationQuarterTurns*Math.PI/2});
 const legacyFootprints=(world:WildsWorldProjection):CreationSolid[]=>[...Object.values(world.constructionSites).filter(site=>site.stage!=='complete').map(siteFootprint),...projectWildsStructureSupports({...world,constructionComponents:{}}).map(support=>({id:support.id,center:{...support.center,y:support.deckY-.2},halfExtents:{x:support.halfWidth,y:.2,z:support.halfLength},yaw:support.rotationQuarterTurns*Math.PI/2}))];
 const siteCandidates=[...siteIds].map(id=>next.world.constructionSites[id]).filter(Boolean).map(siteFootprint);
 const obstacleSolid=(obstacle:ReturnType<typeof projectWildsRenderedLivingObstacles>[number]):CreationSolid=>({id:obstacle.id,center:obstacle.shape.kind==='box'?obstacle.position:{...obstacle.position,y:obstacle.position.y+obstacle.shape.height/2},halfExtents:obstacle.shape.kind==='box'?{x:obstacle.shape.halfX,y:obstacle.shape.halfY,z:obstacle.shape.halfZ}:{x:obstacle.radius,y:obstacle.shape.height/2,z:obstacle.radius},yaw:0});
 const outer='wildz.space.outer.v1';
 type ScopedSolid=CreationSolid&{worldId:string;spaceId:string;component?:WildsWorldProjection['constructionComponents'][string]};
 const scoped=(solid:CreationSolid,worldId:string,spaceId=outer,component?:ScopedSolid['component']):ScopedSolid=>({...solid,worldId,spaceId,...(component?{component}:{})});
 const sameScope=(a:ScopedSolid,b:ScopedSolid)=>a.worldId===b.worldId&&a.spaceId===b.spaceId;
 // Match the existing placement predicate's thin snapped wall-end allowance.
 // The source reducer has admitted this component/evidence; only owned contact
 // gets this allowance. Foreign sovereign bodies and grading stay strict.
 const ownedCorner=(candidate:ScopedSolid,solid:ScopedSolid)=>{
  const component=candidate.component;
  if(!component?.evidence.surfaceSnap||!['wall','partition','solid-wall','window-wall'].includes(component.kind))return false;
  const c=Math.abs(Math.cos(solid.yaw)),v=Math.abs(Math.sin(solid.yaw));
  const hx=c*solid.halfExtents.x+v*solid.halfExtents.z,hz=v*solid.halfExtents.x+c*solid.halfExtents.z;
  return Math.min(hx,hz)<=.15&&candidate.halfExtents.x+hx-Math.abs(candidate.center.x-solid.center.x)<=.301
   &&candidate.halfExtents.z+hz-Math.abs(candidate.center.z-solid.center.z)<=.301;
 };
 const candidates:ScopedSolid[]=[];
 for(const id of candidateIds){
  const creation=next.world.creations?.[id],component=next.world.constructionComponents[id];
  if(creation)candidates.push(...buildingSolids(next.world,id).map(s=>scoped(s,creation.instance.worldId,creation.instance.spaceId)));
  else if(component)candidates.push(...component.placement.collisionSolids.map(s=>scoped({...s,yaw:0},next.world.worldId,component.evidence.spaceId??outer,component)));
 }
 const newStructures=Object.keys(next.world.structures).filter(id=>!old.world.structures[id]);
 const legacyCandidates=[...siteCandidates,...legacyFootprints({...next.world,constructionSites:{},structures:Object.fromEntries(newStructures.map(id=>[id,next.world.structures[id]]))})];
 candidates.push(...legacyCandidates.map(s=>scoped(s,next.world.worldId)));
 if(newStructures.length)candidates.push(...projectWildsRenderedLivingObstacles({...next.world,sites:{},bosses:{},constructionComponents:{},structures:Object.fromEntries(newStructures.map(id=>[id,next.world.structures[id]]))}).map(obstacleSolid).map(s=>scoped(s,next.world.worldId)));
 if(!candidates.length)return;
 const rows=[{owner:event.ownerReceizId,world:old.world}];
 for(const [owner,trace] of Object.entries(before.traces))if(owner!==event.ownerReceizId)rows.push({owner,world:(await replayWildsResourceJournalOwnerV128(before,owner,trace.gameplayOwnerId,trace.commands)).world});
 const terrain=projectWildsConstructionTerrain(next.world).filter(pad=>[...candidateIds].some(id=>pad.id.startsWith(id+':')));
 for(const row of rows){
  // Evolution/adjustment may replace only its own target, never another body.
  const world=row.owner===event.ownerReceizId?{...row.world,constructionSites:Object.fromEntries(Object.entries(row.world.constructionSites).filter(([id])=>!siteIds.has(id))),creations:Object.fromEntries(Object.entries(row.world.creations??{}).filter(([id])=>!candidateIds.has(id))),constructionComponents:Object.fromEntries(Object.entries(row.world.constructionComponents).filter(([id])=>!candidateIds.has(id)))}:row.world;
  const solids:ScopedSolid[]=projectWildsRenderedLivingObstacles({...world,constructionComponents:{}}).map(obstacleSolid).map(s=>scoped(s,world.worldId));
  const projectComponent=constructionGeometryForCollections(world.constructionMaterialContributions,world.constructionWorkContributions);
  for(const component of Object.values(world.constructionComponents))solids.push(...projectComponent(component).solids.map(s=>scoped({...s,yaw:0},world.worldId,component.evidence.spaceId??outer)));
  for(const source of Object.values(projectWildsCreationPersistence(world).creations))solids.push(...projectCreationPhysical(source.instance,source.command.definition,compileWorldCreationSource(source)).solids.map(s=>scoped(s,source.instance.worldId,source.instance.spaceId)));
  solids.push(...legacyFootprints(world).map(s=>scoped(s,world.worldId)));
  const protectedTerrain=projectWildsConstructionTerrain(world);
  const protectedFootprints=[...solids,...protectedTerrain.map(p=>scoped({...p,halfExtents:{...p.halfExtents,y:1}},world.worldId))].filter(s=>s.worldId===next.world.worldId&&s.spaceId===outer);
  if(candidates.some(candidate=>solids.some(solid=>sameScope(candidate,solid)&&overlapsCreationSolids(candidate,solid)
    &&!(row.owner===event.ownerReceizId&&ownedCorner(candidate,solid))))
   ||legacyCandidates.some(candidate=>protectedFootprints.some(solid=>overlapsCreationSolids(horizontal(candidate),horizontal(solid))))
   ||terrain.some(pad=>protectedFootprints.some(solid=>overlapsCreationSolids(horizontal({...pad,halfExtents:{...pad.halfExtents,y:1}},WILDS_BUILD_FLAT_APRON),horizontal(solid)))))fail('established_structure_overlap');
 }
}
