import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creationDefinitionFixture} from './support/creation-fixtures';
import {initializeCreationComponents} from '../src/features/play/creation/components';
import {createCreationInstance, sealCreationInstance} from '../src/features/play/creation/instance';
import {compileCreation} from '../src/features/play/creation/compiler';
import {createGearDefinition,CREATION_GEAR_PRESETS} from '../src/features/play/creation/equipment-presets';
import {creationContextFixture} from './support/creation-fixtures';
import {resolveCreationEquipmentAction} from '../src/features/play/creation/equipment';

function equipped(kind:string, material='timber') {
 const base=creationDefinitionFixture().nodes[0];
 const definition=creationDefinitionFixture({nodes:[{...base,material,shape:{kind:'box',width:.2,height:.1,depth:1},behaviors:[{id:'weapon',version:1,parameters:{equipment:kind}}]}]});
 const initial=createCreationInstance({instanceId:'gear',definition,ownerId:'owner',worldId:'wildz',spaceId:'surface',pose:{position:{x:0,y:0,z:0},yaw:0},kaiUPulse:1});
 const {head,...basis}=initial;void head;
 const nodes=initializeCreationComponents(definition,1),node=nodes.room;
 assert.equal(node.kind,'equipment');
 return sealCreationInstance({...basis,stage:'functional',nodeStates:{room:{...node,equippedBy:'owner'}}});
}
test('a built bow has fixed ranged behavior, consumes wear, and rejects stale, exhausted and rapid actions',()=>{
 const instance=equipped('bow');
 const request={actionId:'arrow:1',actorId:'owner',expectedHead:instance.head,targetId:'target',targetHead:instance.head,spaceId:'surface',position:{x:0,y:0,z:0},targetPosition:{x:0,y:0,z:-20},kaiUPulse:2};
 const result=resolveCreationEquipmentAction(instance,request);
 assert.equal(result.status,'proposed');if(result.status!=='proposed')return;
 assert.equal(result.damage,12);
 const node=result.instance.nodeStates.room;assert.equal(node.kind,'equipment');if(node.kind!=='equipment')return;
 assert.equal(node.durability,118);
 assert.equal(resolveCreationEquipmentAction(result.instance,{...request,actionId:'arrow:2',expectedHead:result.instance.head,kaiUPulse:3}).status,'rejected');
 assert.equal(resolveCreationEquipmentAction(instance,{...request,targetPosition:{x:0,y:0,z:-200}}).status,'rejected');
 assert.equal(resolveCreationEquipmentAction(instance,{...request,actorId:'intruder'}).status,'rejected');
 assert.equal(resolveCreationEquipmentAction(instance,{...request,expectedHead:result.instance.head}).status,'rejected');
});
test('a built trail rifle works beyond melee reach with bounded damage and wear',()=>{
 const instance=equipped('trail-rifle');
 const result=resolveCreationEquipmentAction(instance,{actionId:'shot:1',actorId:'owner',expectedHead:instance.head,targetId:'target',targetHead:instance.head,spaceId:'surface',position:{x:0,y:0,z:0},targetPosition:{x:0,y:0,z:-45},kaiUPulse:2});
 assert.equal(result.status,'proposed');if(result.status!=='proposed')return;
 assert.equal(result.damage,16);
 const node=result.instance.nodeStates.room;assert.equal(node.kind,'equipment');if(node.kind==='equipment')assert.equal(node.durability,117);
});
test('unknown gear or caller supplied damage cannot become a functional profile',()=>{
 assert.throws(()=>equipped('invented-gun'));
 const base=creationDefinitionFixture().nodes[0];
 const definition=creationDefinitionFixture({nodes:[{...base,behaviors:[{id:'weapon',version:1,parameters:{equipment:'bow',damage:999999}}]}]});
 assert.throws(()=>initializeCreationComponents(definition,1));
});

test('all five equipment presets quote real geometry, finite materials and fixed portable profiles',()=>{
 for(const gear of CREATION_GEAR_PRESETS){const definition=createGearDefinition({creatorId:'owner',seed:`preset:${gear.id}`,kind:gear.id}),context=creationContextFixture({techniques:['assembly','masonry','forging']});
  const result=compileCreation(definition,context);assert.equal(result.status,'ready',gear.id);if(result.status!=='ready')continue;
  assert.ok(Object.values(result.plan.requiredResources).some(quantity=>quantity>0));assert.ok(result.plan.chunks.some(chunk=>chunk.positions.length>0));
  const states=initializeCreationComponents(definition,1),equipment=Object.values(states).filter(state=>state.kind==='equipment');assert.equal(equipment.length,1);if(equipment[0].kind==='equipment')assert.ok(equipment[0].mass>0&&equipment[0].mass<=25);
 }
});
