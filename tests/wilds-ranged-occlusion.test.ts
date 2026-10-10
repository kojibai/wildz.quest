import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WildsWorldService} from '../src/features/play/wilds-world-service';
import {initialWildsWorldProjection,replayWildsWorld} from '../src/features/play/wilds-world-state';
import {createCreationDefinition} from '../src/features/play/creation/definition';
import {compileCreation} from '../src/features/play/creation/compiler';
import {creationWorldSourceHead,creationWorldAvailability,compileWorldCreationSource,type WildsCreationSourceRecord} from '../src/features/play/creation/world-source';
import {creationWorldActorHead,CREATION_WORLD_ACTION_RULE_HEAD,verifyWorldCreationActionRecord,type WildsCreationActionCommand,type WildsCreationActionRecord} from '../src/features/play/creation/world-action';
import {creationAimNodeDistance,creationEquipmentAimOrigin} from '../src/features/play/creation/equipment-aim';
import {selectCreationResources} from '../src/features/play/creation/resources';
import {combineCreationTechniques,projectCreationWorkers} from '../src/features/play/creation/capabilities';
import {sealCollectedCard} from '../src/features/play/portable-card';
import {creatureFamilies} from '../src/features/play/creature-catalog';
import {emptyAdventureCondition} from '../src/features/play/adventure/card-condition';
import {projectWildsResourceRegion} from '../src/features/play/wilds-resource-authority';
import {createWildsMaterialHarvest,initialWildsHarvestedSourceState} from '../src/features/play/wilds-steward-construction';
import {prepareCreationHandAction} from '../src/features/play/creation/hand-action';
import {wildsTerrainElevation} from '../src/features/play/wilds-terrain-authority';
import {admitWildsDiscoveryPhysicalNeighborhood,wildsMountainFieldValue} from '../src/features/play/wilds-discovery-sites';
import {assertCreationRangedHitUnoccluded} from '../src/features/play/creation/ranged-occlusion';
import {createWildsWorldEvent} from '../src/features/play/wilds-world-event';
import {constructionProofDigest} from '../src/features/play/wilds-construction-project';
import type {CreationPoint} from '../src/features/play/creation/types';

const actor='owner:occlusion',other='owner:private-wall',pulse='2026-10-09T12:00:00.000Z',outer='wildz.space.outer.v1';
type Part={id:string;position:CreationPoint;owner?:string;gear?:'bow'|'trail-rifle'|'legacy';depth?:number;assembly?:boolean};
function fixture(parts:readonly Part[]){
 const sources=Array.from({length:25},(_,i)=>projectWildsResourceRegion(i-12,0)).flat().filter(source=>source.kind==='timber').slice(0,12);
 const lots=sources.map((source,index)=>createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:index<6?actor:other,actorPosition:source.position,kaiUPulse:1}).lot);
 const service=WildsWorldService.fromLocalProjection({...initialWildsWorldProjection(),materialLots:Object.fromEntries(lots.map(lot=>[lot.lotId,lot]))});
 for(const [index,part]of parts.entries()){
  const owner=part.owner??actor,card=sealCollectedCard({capturedAt:pulse,encounterId:`occlusion:worker:${owner}`,formId:creatureFamilies.find(f=>f.element==='Ember')!.formIds[0],ownerReceizId:owner}),condition=emptyAdventureCondition(card.id);
  const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:part.id,creatorId:owner,assets:[],nodes:[{id:'part',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'box',width:.2,height:part.gear?.1:3,depth:part.depth??1},material:'timber',attachments:[],supports:[],behaviors:part.gear?[{id:'weapon',version:1,parameters:part.gear==='legacy'?{}:{equipment:part.gear}}]:[]},...(part.assembly?[{id:'carried-decoration',parentId:null,pose:{position:{x:0,y:1.2,z:0},yaw:0},shape:{kind:'box' as const,width:.1,height:.1,depth:1},material:'timber',attachments:[],supports:[],behaviors:[]}]:[])]});
  const world=service.snapshot(),context={worldId:world.worldId,spaceId:outer,pose:{position:part.position,yaw:0},sourceHead:creationWorldSourceHead(world),budget:{timber:6},techniques:combineCreationTechniques(projectCreationWorkers([card],{[card.id]:condition})),physical:[],quality:'low' as const};
  const compiled=compileCreation(definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture_build_blocked');
  const resources=selectCreationResources(Object.values(world.materialLots),context.budget,compiled.plan.requiredResources,creationWorldAvailability(world,owner));
  service.execute({type:'creation.construct',commandId:`construct:${part.id}`,instanceId:part.id,definition,context,planDigest:compiled.plan.digest,workerSources:[{card,condition}],resources:resources.lots,actorPosition:part.position},{actorId:owner,canonical:true,pulse,occurredAt:pulse,uPulse:10+index});
 }
 const position=parts.find(part=>part.id==='gear')!.position,world=service.snapshot();
 execute(service,{type:'creation.action',commandId:'occlusion:equip',spaceId:outer,actorPosition:position,actionRequest:{operationId:'occlusion:equip',actorId:actor,instanceId:'gear',nodeId:'part',slot:'hand',action:'equip',kaiUPulse:20,expectedHeads:{gear:world.creations!.gear.instance.head,[`actor:${actor}`]:creationWorldActorHead(world,actor)}}});
 return {service,position};
}
function execute(service:WildsWorldService,command:WildsCreationActionCommand){return service.execute(command,{actorId:actor,canonical:true,pulse,occurredAt:pulse,uPulse:command.actionRequest.kaiUPulse});}
function shot(service:WildsWorldService,position:CreationPoint,legacy=false):WildsCreationActionCommand{
 const world=service.snapshot(),gear=world.creations!.gear.instance,target=world.creations!.target,origin=creationEquipmentAimOrigin(position),targetPosition=target.instance.pose.position;
 const delta={x:targetPosition.x-origin.x,y:targetPosition.y+1.25-origin.y,z:targetPosition.z-origin.z},length=Math.hypot(delta.x,delta.y,delta.z),aim={direction:{x:delta.x/length,y:delta.y/length,z:delta.z/length}};
 const distance=creationAimNodeDistance(target.command.definition,target.instance.pose,'part',origin,aim,56);assert.notEqual(distance,null);
 return {type:'creation.action',commandId:'occlusion:shot',spaceId:outer,actorPosition:position,actionRequest:{operationId:'occlusion:shot',actorId:actor,instanceId:'target',nodeId:'part',action:'damage',kaiUPulse:30,expectedHeads:{target:target.instance.head,gear:gear.head,[`actor:${actor}`]:creationWorldActorHead(world,actor)},equipmentId:'gear',equipment:{actionId:'occlusion:shot',actorId:actor,expectedHead:gear.head,targetId:'target',targetHead:target.instance.head,spaceId:outer,position,targetPosition,kaiUPulse:30,...(legacy?{}:{aim,hitPosition:{x:origin.x+aim.direction.x*distance!,y:origin.y+aim.direction.y*distance!,z:origin.z+aim.direction.z*distance!}})}}};
}
const position={x:5000,y:100,z:5000};
test('actual service rejects an exact aimed farther target through an admitted nearer creation without writes',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'wall',position:{...position,z:4990}},{id:'target',position:{...position,z:4980}}]),before=service.checkpoint();
 assert.throws(()=>execute(service,shot(service,position)),/creation_action_ray_occluded/);
 assert.deepEqual(service.checkpoint(),before);
});
test('a nearer private creation blocks damage to an authorized farther target',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'wall',owner:other,position:{...position,z:4990}},{id:'target',position:{...position,z:4980}}]);
 assert.equal(service.snapshot().creations!.wall.instance.ownerId,other);
 assert.throws(()=>execute(service,shot(service,position)),/creation_action_ray_occluded/);
});
test('terrain between the muzzle and target rejects the actual service damage command',()=>{
 const start={x:10000,y:wildsTerrainElevation(10000,10000),z:10000},end={x:10000,y:wildsTerrainElevation(10000,9980)-6,z:9980};
 const {service}=fixture([{id:'gear',position:start,gear:'bow'},{id:'target',position:end}]),before=service.checkpoint();
 assert.throws(()=>execute(service,shot(service,start)),/creation_action_ray_occluded/);
 assert.deepEqual(service.checkpoint(),before);
});
test('an unobstructed actual hit changes only authorized target and gear and replays the full world',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'target',position:{...position,z:4980}}]),before=service.checkpoint(),result=execute(service,shot(service,position));
 assert.equal(result.projection.creations!.target.instance.nodeStates.part.condition,88);
 const node=result.projection.creations!.gear.instance.nodeStates.part;assert.equal(node.kind,'equipment');if(node.kind==='equipment')assert.equal(node.durability,118);
 const restored=replayWildsWorld(result.events,before);assert.deepEqual(restored,result.projection);
 assert.ok(compileWorldCreationSource(restored.creations!.target));
});
test('a blocked aim becomes a wear-only miss with no unauthorized hit and still replays',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'wall',owner:other,position:{...position,z:4990}},{id:'target',position:{...position,z:4980}}]),before=service.checkpoint(),command=prepareCreationHandAction({world:service.snapshot(),actorId:actor,position,spaceId:outer,heading:0,kaiUPulse:30,operationId:'occlusion:miss',intent:'shoot',aim:{direction:{x:0,y:0,z:-1}}});
 assert.equal(command?.actionRequest.action,'discharge');assert.ok(command);
 const result=execute(service,command);assert.equal(result.projection.creations!.wall.instance.nodeStates.part.condition,100);assert.equal(result.projection.creations!.target.instance.nodeStates.part.condition,100);
 const node=result.projection.creations!.gear.instance.nodeStates.part;if(node.kind==='equipment')assert.equal(node.durability,118);else assert.fail('missing equipment');
 assert.deepEqual(replayWildsWorld(result.events,before),result.projection);
});
test('legacy melee keeps its exact v1 action rule and replay semantics',()=>{
 const {service}=fixture([{id:'gear',position,gear:'legacy'},{id:'wall',owner:other,position:{...position,z:4999.1},depth:.1},{id:'target',position:{...position,z:4998}}]),before=service.checkpoint(),result=execute(service,shot(service,position,true));
 const source=result.projection.creations!.target;assert.equal(source.actions!.at(-1)!.record.ruleHead,CREATION_WORLD_ACTION_RULE_HEAD);assert.equal(source.instance.nodeStates.part.condition,96);
 assert.deepEqual(replayWildsWorld(result.events,before),result.projection);
});
test('ranged distance is the intersected face even when the target anchor lies beyond bow range',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'target',position:{...position,z:4967},depth:4}]),command=shot(service,position);
 assert.equal(assertCreationRangedHitUnoccluded(service.snapshot(),command),31);
 assert.equal(execute(service,command).projection.creations!.target.instance.nodeStates.part.condition,88);
});
test('canonical discovery exterior geometry blocks a ray before target damage',()=>{
 const box=admitWildsDiscoveryPhysicalNeighborhood(39,39).solids.find(solid=>solid.spaceId===outer&&solid.kind!=='mountain-envelope')!;
 const start={x:box.center.x,y:box.center.y-1.25,z:box.center.z+10},end={...start,z:box.center.z-10};
 const {service}=fixture([{id:'gear',position:start,gear:'bow'},{id:'target',position:end}]);
 assert.throws(()=>execute(service,shot(service,start)),/creation_action_ray_occluded/);
});
test('the actual canonical mountain surface blocks shots across its ridge',()=>{
 const field=admitWildsDiscoveryPhysicalNeighborhood(39,39).mountainFields.find(field=>field.halfExtents.x<15)!;
 const x=field.center.x-field.halfExtents.x-2,z=field.center.z,endX=field.center.x+field.halfExtents.x+2,y=Math.max(wildsTerrainElevation(x,z),wildsTerrainElevation(endX,z));
 assert.ok(wildsMountainFieldValue(field,field.center.x,z,'topY')>y+1.25);
 const start={x,y,z},{service}=fixture([{id:'gear',position:start,gear:'bow'},{id:'target',position:{x:endX,y,z}}]);
 assert.throws(()=>execute(service,shot(service,start)),/creation_action_ray_occluded/);
});
test('an exact locally replayable hit record still cannot bypass a blocker during full-world replay',()=>{
 const clear=fixture([{id:'gear',position,gear:'bow'},{id:'target',position:{...position,z:4980}}]),template=execute(clear.service,shot(clear.service,position));
 const blocked=fixture([{id:'gear',position,gear:'bow'},{id:'target',position:{...position,z:4980}},{id:'wall',owner:other,position:{...position,z:4990}}]),world=blocked.service.snapshot(),before=blocked.service.checkpoint(),command=shot(blocked.service,position);
 const payload=template.events[0].payload as {record:WildsCreationActionRecord};
 const predecessors={gear:world.creations!.gear.instance,target:world.creations!.target.instance};
 for(const [id,instance]of Object.entries(predecessors))assert.equal(instance.head,payload.record.predecessors[id].head,'the proof probe must retain exact participant source heads');
 const record:WildsCreationActionRecord={...payload.record,command,actorHead:creationWorldActorHead(world,actor),predecessors};
 assert.doesNotThrow(()=>verifyWorldCreationActionRecord(record),'exact participant replay alone proves the effect, not blocker absence');
 const records:Record<string,WildsCreationSourceRecord>={};
 for(const [id,instance]of Object.entries(record.successors)){
  const prior=world.creations![id];records[id]={...prior,constructionInstance:prior.constructionInstance??prior.instance,instance,actions:[...(prior.actions??[]),{record,priorEventId:world.creationEvents![id].eventId}]};
  assert.doesNotThrow(()=>compileWorldCreationSource(records[id]));
 }
 const event=createWildsWorldEvent({kind:'creation.acted',actorId:actor,causeId:command.commandId,pulse,occurredAt:pulse,uPulse:30,kaiKlok:1,previousEventId:before.lastEventId,payload:JSON.parse(JSON.stringify({record,records,commandDigest:constructionProofDigest(command)}))});
 assert.throws(()=>replayWildsWorld([event],before),/creation_action_ray_occluded/);
 assert.deepEqual(blocked.service.checkpoint(),before);
});
test('another owner carrying a multi-node gear assembly leaves no obsolete ground blocker',()=>{
 const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'carried',owner:other,position:{...position,z:4990},gear:'bow',assembly:true},{id:'target',position:{...position,z:4980}}]);
 assert.throws(()=>assertCreationRangedHitUnoccluded(service.snapshot(),shot(service,position)),/creation_action_ray_occluded/,'the loose assembly really intersects the ray before pickup');
 const world=service.snapshot(),carry:WildsCreationActionCommand={type:'creation.action',commandId:'occlusion:other-carry',spaceId:outer,actorPosition:{...position,z:4990},actionRequest:{operationId:'occlusion:other-carry',actorId:other,instanceId:'carried',nodeId:'part',slot:'hand',action:'equip',kaiUPulse:21,expectedHeads:{carried:world.creations!.carried.instance.head,[`actor:${other}`]:creationWorldActorHead(world,other)}}};
 service.execute(carry,{actorId:other,canonical:true,pulse,occurredAt:pulse,uPulse:21});
 const command=shot(service,position);assert.equal(assertCreationRangedHitUnoccluded(service.snapshot(),command),19.5);
 const result=execute(service,command);assert.equal(result.projection.creations!.target.instance.nodeStates.part.condition,88);assert.equal(result.projection.creations!.carried.instance.nodeStates['carried-decoration'].condition,100);
});
test('malformed claimed hit coordinates cannot bypass the exact point binding or cause writes',()=>{
 for(const malformed of [()=>({}as CreationPoint),(point:CreationPoint)=>({x:point.x,y:point.y}as CreationPoint),(point:CreationPoint)=>({...point,extra:1})]){
  const {service}=fixture([{id:'gear',position,gear:'bow'},{id:'target',position:{...position,z:4980}}]),command=shot(service,position),request=command.actionRequest;
  assert.equal(request.action,'damage');if(request.action!=='damage'||!request.equipment?.hitPosition)throw Error('fixture_hit_missing');
  const invalid={...command,actionRequest:{...request,equipment:{...request.equipment,hitPosition:malformed(request.equipment.hitPosition)}}},before=service.checkpoint();
  assert.throws(()=>execute(service,invalid));assert.deepEqual(service.checkpoint(),before);
 }
});
