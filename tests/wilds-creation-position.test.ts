import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPanelPosition } from '../src/features/play/creation/panel-position';
import { creationPreviewTransform, creationSceneOffset, createCreationPreview } from '../src/features/play/creation/preview';
import { compileCreation } from '../src/features/play/creation/compiler';
import { initialCreationConversation, reduceCreationConversation } from '../src/features/play/creation/conversation';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';
test('dragging cannot strand the panel outside the screen',()=>{assert.deepEqual(clampPanelPosition({x:900,y:-100},{width:380,height:320},{width:390,height:844}),{x:8,y:8});assert.deepEqual(clampPanelPosition({x:80,y:1200},{width:280,height:320},{width:390,height:844}),{x:80,y:516});});
test('moving and rotating the ghost anchors its original origin at the new position',()=>{const result=compileCreation(creationDefinitionFixture(),creationContextFixture());assert.equal(result.status,'ready');if(result.status!=='ready')return;const plan={...result.plan,pose:{position:{x:8,y:2,z:-3},yaw:0}};const ghost=createCreationPreview(plan,{position:{x:10,y:5,z:4},yaw:Math.PI/2});const t=creationPreviewTransform(ghost),c=Math.cos(t.yaw),s=Math.sin(t.yaw),p=plan.pose.position;assert.ok(Math.abs(c*p.x+s*p.z+t.position[0]-10)<1e-8);assert.equal(p.y+t.position[1],5);assert.ok(Math.abs(-s*p.x+c*p.z+t.position[2]-4)<1e-8);assert.equal(ghost.physical,false);assert.equal(ghost.writes,0);});
test('a new preview collapses the chat while placement changes retain the ghost and invalidate admission',()=>{const definition=creationDefinitionFixture(),result=compileCreation(definition,creationContextFixture());assert.equal(result.status,'ready');if(result.status!=='ready')return;let state=initialCreationConversation('owner','surface',result.plan.pose);state=reduceCreationConversation(state,{type:'request',requestId:'preview'});state=reduceCreationConversation(state,{type:'proposal',requestId:'preview',definition,reply:'Ready'});state=reduceCreationConversation(state,{type:'compiled',requestId:'preview',plan:result.plan,minimize:true});assert.equal(state.minimized,true);const moved=reduceCreationConversation(state,{type:'placement',pose:{position:{x:4,y:0,z:2},yaw:0}});assert.equal(moved.plan,state.plan);assert.equal(moved.status,'idle');const pending=reduceCreationConversation(moved,{type:'compile-request',requestId:'moved'});assert.equal(pending.plan,state.plan);assert.equal(pending.status,'planning');});

test('changing the selected object fences late replies and preserves the explicit graph target',()=>{const first=creationDefinitionFixture(),second=creationDefinitionFixture({seed:'other'});let state=reduceCreationConversation(initialCreationConversation('owner','surface',creationContextFixture().pose),{type:'request',requestId:'old'});state=reduceCreationConversation(state,{type:'selection',definition:second});const late=reduceCreationConversation(state,{type:'proposal',requestId:'old',definition:first,reply:'Old'});assert.equal(late.definition?.digest,second.digest);assert.equal(late.requestId,null);assert.equal(reduceCreationConversation(late,{type:'selection',definition:creationDefinitionFixture({creatorId:'someoneElse'})}),late);});


test('world geometry and relocated previews use the same player and elevation origin',()=>{
 const result=compileCreation(creationDefinitionFixture(),creationContextFixture());
 assert.equal(result.status,'ready');if(result.status!=='ready')return;
 const origin={x:8,y:2,z:-3},viewer={x:14,y:7,z:-5};
 const plan={...result.plan,pose:{position:origin,yaw:0}};
 const ghost=createCreationPreview(plan,{position:{x:10,y:9,z:4},yaw:Math.PI/2});
 const world=creationPreviewTransform(ghost),scene=creationPreviewTransform(ghost,viewer),offset=creationSceneOffset(viewer);
 const c=Math.cos(world.yaw),s=Math.sin(world.yaw);
 for(const point of [origin,{x:9,y:3,z:-1},{x:-2,y:10,z:0}]){
  const physical={x:c*point.x+s*point.z+world.position[0],y:point.y+world.position[1],z:-s*point.x+c*point.z+world.position[2]};
  const displayed=[c*point.x+s*point.z+scene.position[0],point.y+scene.position[1],-s*point.x+c*point.z+scene.position[2]];
  [physical.x,physical.y,physical.z].forEach((value,i)=>assert.ok(Math.abs(displayed[i]-(value+offset[i]))<1e-8));
 }
 assert.deepEqual(offset,[-14,-7,5]);
});
