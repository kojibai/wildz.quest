import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WildsWorldService} from '../src/features/play/wilds-world-service';
import {initialWildsWorldProjection,checkpointWildsWorld,replayWildsWorld} from '../src/features/play/wilds-world-state';
import {createCreationDefinition} from '../src/features/play/creation/definition';
import {compileCreation} from '../src/features/play/creation/compiler';
import {creationWorldSourceHead,creationWorldAvailability,compileWorldCreationSource,projectWildsCreationPersistence} from '../src/features/play/creation/world-source';
import {creationWorldActorHead,type WildsCreationActionCommand} from '../src/features/play/creation/world-action';
import {selectCreationResources} from '../src/features/play/creation/resources';
import {combineCreationTechniques,projectCreationWorkers} from '../src/features/play/creation/capabilities';
import {sealCollectedCard} from '../src/features/play/portable-card';
import {creatureFamilies} from '../src/features/play/creature-catalog';
import {emptyAdventureCondition} from '../src/features/play/adventure/card-condition';
import {projectWildsResourceRegion} from '../src/features/play/wilds-resource-authority';
import {createWildsMaterialHarvest,initialWildsHarvestedSourceState} from '../src/features/play/wilds-steward-construction';
import {prepareCreationHandAction} from '../src/features/play/creation/hand-action';
import {createWorldCreationController} from '../src/features/play/creation/world-controller';
import {projectCreationPhysical} from '../src/features/play/creation/projection';
import {verifyWorldCreationActionRecord} from '../src/features/play/creation/world-action';
import {createWildsWorldEvent} from '../src/features/play/wilds-world-event';
import {sealCreationInstance,type CreationInstance} from '../src/features/play/creation/instance';
import {assertWildsWorldCommandCardAuthority} from '../src/features/play/use-wilds-world';
import {createWildsWorldEdgeAdmissionQueue} from '../src/features/play/wilds-world-outbox';
import {withWildsWorldCommandKai} from '../src/features/play/wilds-world-authority';
import {createKaiTemporalRoot} from '../src/features/play/kai-temporal-root';
import {deriveKaiKlokMomentFromUPulse} from '../src/features/play/kai-klok-moment';

const actor='owner:hand',pulse='2026-10-09T12:00:00.000Z',position={x:5000,y:100,z:5000};
function fixture(attached=false,targetEquipment=false){
 const sources=Array.from({length:25},(_,i)=>projectWildsResourceRegion(i-12,0)).flat().filter(source=>source.kind==='timber').slice(0,2);
 const lots=sources.map(source=>createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:actor,actorPosition:source.position,kaiUPulse:1}).lot);
 const service=WildsWorldService.fromLocalProjection({...initialWildsWorldProjection(),materialLots:Object.fromEntries(lots.map(lot=>[lot.lotId,lot]))});
 const card=sealCollectedCard({capturedAt:pulse,encounterId:'hands:worker',formId:creatureFamilies.find(f=>f.element==='Ember')!.formIds[0],ownerReceizId:actor}),condition=emptyAdventureCondition(card.id);
 for(const [index,id]of ['weapon','target'].entries()){
  const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:id,creatorId:actor,assets:[],nodes:[{id:'part',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'box',width:.2,height:.1,depth:1},material:'timber',attachments:[],supports:[],behaviors:id==='weapon'||targetEquipment?[{id:'weapon',version:1,parameters:{}}]:[]},...(attached&&id==='weapon'?[{id:'linked',parentId:'part',pose:{position:{x:1,y:0,z:0},yaw:0},shape:{kind:'box' as const,width:.1,height:.1,depth:.1},material:'timber' as const,attachments:[],supports:[],behaviors:[]}]:[])]});
  const world=service.snapshot(),context={worldId:world.worldId,spaceId:'wildz.space.outer.v1',pose:{position:{...position,z:position.z-index*2},yaw:0},sourceHead:creationWorldSourceHead(world),budget:{timber:2},techniques:combineCreationTechniques(projectCreationWorkers([card],{[card.id]:condition})),physical:[],quality:'low' as const};
  const compiled=compileCreation(definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture');
  const resources=selectCreationResources(Object.values(world.materialLots),context.budget,compiled.plan.requiredResources,creationWorldAvailability(world,actor));
  service.execute({type:'creation.construct',commandId:`construct:${id}`,instanceId:id,definition,context,planDigest:compiled.plan.digest,workerSources:[{card,condition}],resources:resources.lots,actorPosition:position},{actorId:actor,canonical:true,pulse,occurredAt:pulse,uPulse:10+index});
 }
 return service;
}
function equip(service:WildsWorldService):WildsCreationActionCommand{const world=service.snapshot();return {type:'creation.action',commandId:'hand:equip',spaceId:'wildz.space.outer.v1',actorPosition:position,actionRequest:{operationId:'hand:equip',actorId:actor,instanceId:'weapon',nodeId:'part',slot:'hand',action:'equip',kaiUPulse:20,expectedHeads:{weapon:world.creations!.weapon.instance.head,[`actor:${actor}`]:creationWorldActorHead(world,actor)}}};}
function damage(service:WildsWorldService):WildsCreationActionCommand{const world=service.snapshot(),weapon=world.creations!.weapon.instance,target=world.creations!.target.instance;return {type:'creation.action',commandId:'hand:strike',spaceId:'wildz.space.outer.v1',actorPosition:position,actionRequest:{operationId:'hand:strike',actorId:actor,instanceId:'target',nodeId:'part',action:'damage',kaiUPulse:30,expectedHeads:{target:target.head,weapon:weapon.head,[`actor:${actor}`]:creationWorldActorHead(world,actor)},equipmentId:'weapon',equipment:{actionId:'hand:strike',actorId:actor,expectedHead:weapon.head,targetId:'target',targetHead:target.head,spaceId:'wildz.space.outer.v1',position,targetPosition:target.pose.position,kaiUPulse:30}}};}
const execute=(service:WildsWorldService,command:WildsCreationActionCommand,who=actor)=>service.execute(command,{actorId:who,canonical:true,pulse,occurredAt:pulse,uPulse:command.actionRequest.kaiUPulse});
test('admitted equip and strike change target and weapon once, survive source replay and restore',()=>{
 const service=fixture();execute(service,equip(service));const strike=damage(service),before=service.snapshot();const result=execute(service,strike),after=result.projection;
 assert.equal(after.creations!.target.instance.nodeStates.part.condition,96);
 const weapon=after.creations!.weapon.instance.nodeStates.part,old=before.creations!.weapon.instance.nodeStates.part;assert.equal(weapon.kind,'equipment');if(weapon.kind==='equipment'&&old.kind==='equipment')assert.equal(weapon.durability,old.durability-1);
 assert.equal(execute(service,strike).events.length,0);
 const restored=replayWildsWorld([],checkpointWildsWorld(after));assert.equal(restored.creations!.target.instance.head,after.creations!.target.instance.head);
 assert.ok(compileWorldCreationSource(restored.creations!.target));assert.equal(Object.keys(projectWildsCreationPersistence(restored).creations).length,2);
});
test('the post owner-action guard admits no-card equip and strike only after the final gameplay fence',async()=>{
 const service=fixture(),order:string[]=[],events:string[]=[];
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:service.snapshot(),persist:async()=>{order.push('persist');},onAdmitted:(_world,_entry,admitted)=>{events.push(...admitted.map(event=>event.kind));}});
 for(const command of [equip(service),null]){
  const current=WildsWorldService.fromLocalProjection(queue.current()),request=command??damage(current);
  const rooted=withWildsWorldCommandKai(request,createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:request.actionRequest.kaiUPulse,authority:'local'})));
  assert.doesNotThrow(()=>assertWildsWorldCommandCardAuthority(rooted,null,true));
  await queue.admit({schema:'receiz.wilds_world_outbox_entry.v1',actorId:actor,guestId:'guest-hands',command:rooted,queuedAt:pulse},{beforeAdmit:async entry=>{
   assert.equal(entry.card,undefined);assert.equal(entry.command.commandId,rooted.commandId);order.push('fence');
  }});
 }
 assert.deepEqual(order,['fence','persist','fence','persist']);
 assert.deepEqual(events,['creation.acted','creation.acted']);
 assert.equal(queue.current().creations!.target.instance.nodeStates.part.condition,96);
 const blocked=fixture(),before=checkpointWildsWorld(blocked.snapshot()).projectionDigest;
 const rejectQueue=createWildsWorldEdgeAdmissionQueue({initialProjection:blocked.snapshot(),persist:async()=>assert.fail('a rejected final fence cannot persist')});
 const rejected=withWildsWorldCommandKai(equip(blocked),createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:20,authority:'local'})));
 assert.doesNotThrow(()=>assertWildsWorldCommandCardAuthority(rejected,null,true));
 await assert.rejects(rejectQueue.admit({schema:'receiz.wilds_world_outbox_entry.v1',actorId:actor,guestId:'guest-hands',command:rejected,queuedAt:pulse},{beforeAdmit:async()=>{throw Error('player_moved_before_persistence');}}),/player_moved_before_persistence/);
 assert.equal(checkpointWildsWorld(rejectQueue.current()).projectionDigest,before);
 assert.throws(()=>assertWildsWorldCommandCardAuthority({type:'resource.material.harvest'},null,true),/wilds_crew_worker_card_required/);
 assert.throws(()=>assertWildsWorldCommandCardAuthority({type:'construction.site.work'},null,true),/wilds_crew_worker_card_required/);
});
test('unauthorized, stale, unarmed and out-of-reach strikes have zero admitted effects',()=>{
 const service=fixture();execute(service,equip(service));const command=damage(service),before=checkpointWildsWorld(service.snapshot()).projectionDigest;
 assert.throws(()=>execute(service,command,'other'));
 assert.throws(()=>execute(service,{...command,actorPosition:{...position,x:6000}}));
 assert.throws(()=>execute(service,{...command,actionRequest:{...command.actionRequest,expectedHeads:{}}}));
 assert.throws(()=>execute(service,{...command,actionRequest:{...command.actionRequest,equipmentId:undefined} as typeof command.actionRequest}));
 assert.equal(checkpointWildsWorld(service.snapshot()).projectionDigest,before);
});
test('grabbing attached equipment never removes another creation support from the world',()=>{
 const service=fixture(true),before=checkpointWildsWorld(service.snapshot()).projectionDigest;
 assert.throws(()=>execute(service,equip(service)),/creation_attached_equipment_pickup_unavailable/);
 assert.equal(checkpointWildsWorld(service.snapshot()).projectionDigest,before);
});
test('an incomplete actor coordinate cannot bypass the pickup reach admission',()=>{
 const service=fixture(),command=equip(service),before=checkpointWildsWorld(service.snapshot()).projectionDigest;
 assert.throws(()=>execute(service,{...command,actorPosition:{} as typeof position}),/creation_action_out_of_reach/);
 assert.throws(()=>execute(service,{...command,actorPosition:{...position,x:NaN}}));
 assert.equal(checkpointWildsWorld(service.snapshot()).projectionDigest,before);
});
test('hand targeting equips only owned reachable equipment and strikes only permitted front targets after recovery',()=>{
 const service=fixture();const prepare=(intent:'grab'|'strike',extras={})=>prepareCreationHandAction({world:service.snapshot(),actorId:actor,position,spaceId:'wildz.space.outer.v1',heading:0,kaiUPulse:20,operationId:`prepared:${intent}`,intent,...extras});
 assert.equal(prepare('strike'),null);assert.equal(prepare('grab',{actorId:'other'}),null);
 assert.equal(prepare('grab',{spaceId:'interior'}),null);assert.equal(prepare('grab',{position:{...position,x:position.x+4}}),null);
 const grab=prepare('grab');assert.equal(grab?.actionRequest.instanceId,'weapon');execute(service,grab!);
 assert.equal(prepare('grab'),null);assert.equal(prepare('strike',{heading:Math.PI}),null);
 const strike=prepare('strike',{kaiUPulse:30});assert.equal(strike?.actionRequest.instanceId,'target');execute(service,strike!);
 assert.equal(prepare('strike',{kaiUPulse:31}),null);
 assert.ok(prepare('strike',{kaiUPulse:1_000_031,operationId:'prepared:next-strike'}));
});
test('baseline hand targeting excludes source-owned equipment without changing the actor head or spatial gates',()=>{
 const service=fixture(false,true),world=service.snapshot(),excludedInstanceIds=new Set(['target']);
 const base={world,actorId:actor,position:{...position,z:4997},spaceId:'wildz.space.outer.v1',heading:Math.PI,kaiUPulse:20,operationId:'prepared:baseline',intent:'grab' as const};
 assert.equal(prepareCreationHandAction(base)?.actionRequest.instanceId,'target','the nearer source weapon is actionable before exclusion');
 const baseline=prepareCreationHandAction({...base,excludedInstanceIds});
 assert.equal(baseline?.actionRequest.instanceId,'weapon');
 assert.equal(baseline?.actionRequest.expectedHeads[`actor:${actor}`],creationWorldActorHead(world,actor));
 assert.equal(prepareCreationHandAction({...base,excludedInstanceIds,position:{...position,z:4999},heading:0}),null,'excluding the front source weapon cannot grab the baseline weapon behind the player');
 assert.equal(prepareCreationHandAction({...base,excludedInstanceIds,spaceId:'interior'}),null,'excluded source IDs never bypass the space boundary');
 const nonEquipment=fixture();
 assert.equal(prepareCreationHandAction({...base,world:nonEquipment.snapshot(),position,heading:0,excludedInstanceIds})?.actionRequest.instanceId,'weapon','a nearby excluded non-equipment creation does not hide baseline equipment');
 execute(service,baseline!);
 assert.equal(prepareCreationHandAction({...base,world:service.snapshot(),position,heading:0,intent:'strike',kaiUPulse:30,excludedInstanceIds:new Set(['weapon'])}),null,'excluded held equipment cannot authorize a baseline strike');
});
test('authenticated physical restoration removes equipped geometry from the ground and retains exact damage source',async()=>{
 const service=fixture(),controller=createWorldCreationController({environment:()=>({ownerId:actor,worldId:service.snapshot().worldId,spaceId:'wildz.space.outer.v1'}),world:()=>service.snapshot(),crew:()=>({cards:[],conditions:{}}),position:()=>position,compileContext:()=>null,admit:async()=>{throw Error('no new build');},project:async(instance,definition,plan)=>projectCreationPhysical(instance,definition,plan)});
 assert.equal(await controller.restore(),2);assert.equal(controller.snapshot().projections.find(p=>p.instanceId==='weapon')!.chunks.length,1);
 execute(service,equip(service));assert.equal(await controller.restore(),2);assert.equal(controller.snapshot().projections.find(p=>p.instanceId==='weapon')!.chunks.length,0);
 execute(service,damage(service));assert.equal(await controller.restore(),2);assert.equal(controller.snapshot().instances.target.nodeStates.part.condition,96);
 const source=structuredClone(service.snapshot().creations!.target),record=source.actions![0].record;
 assert.throws(()=>verifyWorldCreationActionRecord({...record,successors:{}}));
 assert.throws(()=>compileWorldCreationSource({...source,actions:[{...source.actions![0],record:{...record,actorId:'other'}}]}));
 controller.close();
});
test('recomputed event and instance digests cannot substitute a stronger weapon effect',()=>{
 const service=fixture();execute(service,equip(service));const before=checkpointWildsWorld(service.snapshot()),result=execute(service,damage(service)),event=result.events[0],payload=structuredClone(event.payload) as {record:{successors:Record<string,CreationInstance>}};
 const {head,...basis}=payload.record.successors.target;
 payload.record.successors.target=sealCreationInstance({...basis,nodeStates:{...basis.nodeStates,part:{...basis.nodeStates.part,condition:0}}});
 const forged=createWildsWorldEvent({kind:event.kind,actorId:event.actorId,causeId:event.causeId,pulse:event.pulse,kaiKlok:event.kaiKlok,uPulse:event.uPulse,occurredAt:event.occurredAt,previousEventId:event.previousEventId,payload});
 assert.throws(()=>replayWildsWorld([forged],before),/creation_action_event_successor_invalid/);
 assert.equal(before.projection.creations!.target.instance.nodeStates.part.condition,100);
});
