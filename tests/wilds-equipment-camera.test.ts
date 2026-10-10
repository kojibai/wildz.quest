import assert from 'node:assert/strict';
import {test} from 'node:test';
import {writeWildsEquipmentCameraOffset} from '../src/features/play/wilds-equipment-camera';
import {creationAimFromView,creationAimNodeDistance,creationEquipmentAimOrigin} from '../src/features/play/creation/equipment-aim';
import {createCreationInstance} from '../src/features/play/creation/instance';
import {creationDefinitionFixture} from './support/creation-fixtures';

test('third person aiming moves the sight beside the body while preserving orbit direction',()=>{
 const camera={x:0,y:1.5,z:4},target={x:0,y:1.25,z:0},look={x:0,y:0,z:0};
 writeWildsEquipmentCameraOffset(camera,target,look,true,false);
 assert.equal(camera.x,.72);assert.equal(look.x,.72);assert.equal(camera.z-look.z,4);assert.equal(camera.y-look.y,.25);
 assert.deepEqual(target,{x:0,y:1.25,z:0});
});
test('embodied and ordinary views keep their exact eye and orbit position',()=>{
 for(const [aiming,embodied]of [[false,false],[true,true]]){
  const camera={x:2,y:1.4,z:3},target={x:1,y:1.3,z:1},look={x:0,y:0,z:0};
  writeWildsEquipmentCameraOffset(camera,target,look,aiming,embodied);
  assert.deepEqual(camera,{x:2,y:1.4,z:3});assert.deepEqual(look,target);
 }
});
test('an offset camera sight converges the admitted muzzle ray on the exact visible target',()=>{
 const node=creationDefinitionFixture().nodes[0],definition=creationDefinitionFixture({nodes:[{...node,shape:{kind:'box',width:.2,height:2,depth:.2}}]});
 const instance=createCreationInstance({instanceId:'target',definition,ownerId:'owner',worldId:'world',spaceId:'surface',pose:{position:{x:.72,y:0,z:-8},yaw:0},kaiUPulse:1});
 const position={x:0,y:0,z:0},origin={x:.72,y:1.25,z:4},view={direction:{x:0,y:0,z:-1}};
 const aim=creationAimFromView([{definition,instance}],position,'surface',origin,view,32);
 assert.ok(aim.direction.x>0);
 const hit=creationAimNodeDistance(definition,instance.pose,node.id,creationEquipmentAimOrigin(position),aim,32);
 assert.ok(hit!==null);assert.ok(Math.abs(creationEquipmentAimOrigin(position).x+aim.direction.x*hit-.72)<.00001);
});
test('the camera sight chooses the nearest solid before a farther target and remains finite on a miss',()=>{
 const definition=creationDefinitionFixture(),make=(id:string,z:number)=>({definition,instance:createCreationInstance({instanceId:id,definition,ownerId:'owner',worldId:'world',spaceId:'surface',pose:{position:{x:.72,y:0,z},yaw:0},kaiUPulse:1})});
 const position={x:0,y:0,z:0},origin={x:.72,y:1.25,z:4},view={direction:{x:0,y:0,z:-1}};
 const near=make('near',-5),far=make('far',-20),aim=creationAimFromView([far,near],position,'surface',origin,view,32);
 assert.ok(creationAimNodeDistance(near.definition,near.instance.pose,near.definition.nodes[0].id,creationEquipmentAimOrigin(position),aim,32)!<8);
 const miss=creationAimFromView([],position,'surface',origin,view,32);
 assert.ok(Object.values(miss.direction).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...Object.values(miss.direction))-1)<.000001);
});
