import assert from 'node:assert/strict';
import type {ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import {sealCollectedCard,sha256PortableBasis,type PortableCardAsset} from '../../src/features/play/portable-card';
import {emptyAdventureCondition} from '../../src/features/play/adventure/card-condition';
import {createWildsCreatureMandate,evaluateWildsCreatureConsent} from '../../src/features/play/wilds-creature-mandate';
import {createWildsSourceAuthorityProjection,planWildsMaterialHarvest} from '../../src/features/play/wilds-source-work-authority';
import {projectWildsResourceRegion} from '../../src/features/play/wilds-resource-authority';
import {wildsTerrainObstaclesForTile} from '../../src/features/play/wilds-terrain-obstacles';
import {replayWildsResourceGameplayV128,type WildsResourceGameplayCommandV128} from '../../src/lib/receiz/wilds-resource-gameplay-v128';
import {createCreationDefinition} from '../../src/features/play/creation/definition';
import {compileCreation} from '../../src/features/play/creation/compiler';
import {combineCreationTechniques,projectCreationWorkers} from '../../src/features/play/creation/capabilities';
import {groundCreationCompileContext} from '../../src/features/play/creation/ground-placement';
import {creationWorldSourceHead,creationWorldAvailability} from '../../src/features/play/creation/world-source';
import {selectCreationResources} from '../../src/features/play/creation/resources';
import {sampleWildsBuildGround} from '../../src/features/play/wilds-build-ground';
import {creationContextFixture} from './creation-fixtures';
import {previewWildsContinuousBuild} from '../../src/features/play/wilds-continuous-builder';
import {regionForPosition} from '../../src/features/play/multiplayer-core';

export const clearanceFixtureTree=Array.from({length:30},(_,x)=>wildsTerrainObstaclesForTile(x,1)).flat().find(item=>item.kind==='tree')!;
export const clearanceFixtureOriginal:ReceizPortableSealedArtifactV124={schema:'receiz.sealed-artifact-bytes.v124',exactBytesB64u:'eA',artifactSha256:'a'.repeat(64),payloadSha256:'b'.repeat(64),filename:'semantic-fixture-not-a-seal.receizbundle',mimeType:'application/vnd.receiz.bundle+json'};
/** Real application commands and paid replay. Default card port is a semantic
 * fixture only; native qualification supplies genuine sealed Original and verifier. */
export async function paidClearanceTrace(input:{owner?:string;sourceOffset?:number;harvests?:number;stoneHarvests?:number;stoneSourceOffset?:number;compound?:boolean;width?:number;foundation?:boolean;point?:{x:number;y:number;z:number};original?:(card:PortableCardAsset)=>Promise<ReceizPortableSealedArtifactV124>;verifyCard?:(card:PortableCardAsset,original:ReceizPortableSealedArtifactV124)=>Promise<void>}={}){
 const owner=input.owner??'explorer',kai=100_000_000,commands:WildsResourceGameplayCommandV128[]=[],verifyCard=input.verifyCard??(async()=>{});
 const card=sealCollectedCard({capturedAt:'2026-10-10T00:00:00.000Z',encounterId:`clearance-worker-${owner}`,formId:'mintcub-1',ownerReceizId:owner}),condition=emptyAdventureCondition(card.id);
 const original=await input.original?.(card)??clearanceFixtureOriginal;
 let world=createWildsSourceAuthorityProjection();
 const allSources=Array.from({length:60},(_,x)=>projectWildsResourceRegion(x-30,0)).flat();
 const sources=allSources.filter(source=>source.kind==='timber').slice(input.sourceOffset??0,(input.sourceOffset??0)+(input.harvests??12));
 if(input.foundation)sources.push(...allSources.filter(source=>source.kind==='stone').slice(input.stoneSourceOffset??0,(input.stoneSourceOffset??0)+(input.stoneHarvests??3)));
 for(const [index,source] of sources.entries()){
  const worker=source.kind==='stone'?sealCollectedCard({capturedAt:'2026-10-10T00:00:00.000Z',encounterId:`clearance-stone-${owner}`,formId:'titanseal-1',ownerReceizId:owner}):card;
  const tick=kai+index,creatureSubjectId=`creature:${sha256PortableBasis(worker.id).slice(0,32)}`,creatureHead=sha256PortableBasis(worker.proof.digest),profession=source.requirements.creature;
  const consent=evaluateWildsCreatureConsent({creatureSubjectId,creatureHead,condition:{energy:100,fatigue:0,injury:0,stress:0},bond:100,preferences:{professions:[profession],avoidHazards:[]},capabilities:{professions:[profession]},safety:{risk:0,hazards:[],supportAvailable:true},requested:{professions:[profession],maxActions:8},kaiUPulse:tick});
  const mandate=createWildsCreatureMandate({consent,creatureSubjectId,creatureHead,region:{x:Math.floor(source.position.x/128),z:Math.floor(source.position.z/128)},professions:[profession],allowedResourceIds:[source.sourceId],maxActions:8,issuedAtKaiUPulse:tick,expiresAtKaiUPulse:tick+100});
  const command=planWildsMaterialHarvest({projection:world,source,actorId:owner,actorPosition:source.position,kaiUPulse:tick,commandId:`harvest:${owner}:${index}`,card:worker,mandate});
  commands.push({kind:'world',command,kaiUPulse:tick,card:worker,cardOriginal:source.kind==='stone'?(await input.original?.(worker)??clearanceFixtureOriginal):original});
  world=(await replayWildsResourceGameplayV128({gameplayOwnerId:owner,commands,verifyCard})).world;
 }
 const point=input.point??clearanceFixtureTree.position;
 if(input.foundation){
  let tick=kai+20;
  const append=async(command:Extract<WildsResourceGameplayCommandV128,{kind:'world'}>['command'])=>{commands.push({kind:'world',command,kaiUPulse:tick++});world=(await replayWildsResourceGameplayV128({gameplayOwnerId:owner,commands,verifyCard})).world;};
  await append({type:'construction.project.create',name:'Paid clearance foundation',region:regionForPosition(point),commandId:`project:${owner}`});
  const request={pointer:{...point,y:sampleWildsBuildGround(point.x,point.z).elevation},rotationQuarterTurns:0,heightStep:0,surfaceSnap:true,snapVersion:2 as const,landscapeRule:'wildz.build-ground.v2' as const};
  const preview=previewWildsContinuousBuild(world,owner,'foundation',request);assert.equal(preview.placement.valid,true);
  await append({type:'construction.component.place',projectId:preview.project!.projectId,placement:preview.placement,request,actorPosition:request.pointer,commandId:`place:${owner}`});
  const component=Object.values(world.constructionComponents)[0],required=component.recipe.stages[0].materials;
  for(const kind of ['timber','stone'] as const)for(const [index,lot] of Object.values(world.materialLots).filter(row=>row.kind===kind).slice(0,required[kind]).entries())await append({type:'construction.component.deposit',componentId:component.componentId,componentHead:component.head,lotIds:[lot.lotId],actorPosition:request.pointer,commandId:`deposit:${owner}:${kind}:${index}`});
  await append({type:'construction.component.work',componentId:component.componentId,componentHead:component.head,actorPosition:request.pointer,commandId:`work:${owner}`});
  const replay=await replayWildsResourceGameplayV128({gameplayOwnerId:owner,commands,verifyCard});
  return {commands,replay,buildingId:component.componentId,buildingHead:component.head,kaiUPulse:tick+1};
 }
 const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,creatorId:owner,seed:'clearance-house',assets:[],nodes:(input.compound?[{id:'room',x:0,z:0},{id:'east',x:3,z:0},{id:'north',x:0,z:3}]:[{id:'room',x:0,z:0}]).map(node=>({id:node.id,parentId:null,pose:{position:{x:node.x,y:0,z:node.z},yaw:0},shape:{kind:'shell' as const,width:input.width??2,height:2.2,depth:input.width??2,thickness:.03,doorway:{width:.9,height:1.9}},material:'timber' as const,attachments:[],supports:[],behaviors:[]}))});
 const context=groundCreationCompileContext(definition,creationContextFixture({worldId:world.worldId,spaceId:'wildz.space.outer.v1',sourceHead:creationWorldSourceHead(world),pose:{position:{...point,y:sampleWildsBuildGround(point.x,point.z).elevation},yaw:0},budget:{timber:12},techniques:combineCreationTechniques(projectCreationWorkers([card],{[card.id]:condition})),physical:[{chunkId:'wildz.creation.terrain-support.v2',head:`sha256:${'a'.repeat(64)}`,terrain:[],portals:[],solids:[],walkable:[]}]}));
 const compiled=compileCreation(definition,context);if(compiled.status!=='ready')throw Error('fixture_not_ready');
 const selected=selectCreationResources(Object.values(world.materialLots),context.budget,compiled.plan.requiredResources,creationWorldAvailability(world,owner));assert.deepEqual(selected.deficits,{});
 const command={type:'creation.construct' as const,commandId:`creation:${owner}`,instanceId:`building:${owner}`,definition,context,planDigest:compiled.plan.digest,workerSources:[{card,condition}],resources:selected.lots,actorPosition:context.pose.position};
 const buildKai=kai+Math.max(20,sources.length+1);
 commands.push({kind:'world',command,kaiUPulse:buildKai,workerOriginals:{[card.id]:original}});
 const replay=await replayWildsResourceGameplayV128({gameplayOwnerId:owner,commands,verifyCard});
 return {commands,replay,buildingId:command.instanceId,buildingHead:replay.world.creations![command.instanceId].instance.head,kaiUPulse:buildKai+10};
}
