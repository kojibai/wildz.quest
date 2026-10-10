import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildsVerticalTraversalState, requestWildsJump, resetWildsVerticalTraversalState, writeWildsVerticalTraversalStep} from '../src/features/play/wilds-vertical-traversal';
import {createWildsHandActionState, beginWildsHandAction, sampleWildsHandPose, selectWildsHandTarget} from '../src/features/play/wilds-player-actions';
import {WILDS_PLAYER_BODY_HEIGHT} from '../src/features/play/wilds-player-body';

const step = {layer: 'ground' as const, intent: 0 as const, terrainElevation: 2, stamina: 100, deltaSeconds: 1/60};
test('jump rises, rejects double jump, and lands on the accepted floor', () => {
 const state=createWildsVerticalTraversalState();writeWildsVerticalTraversalStep(state,step);
 assert.equal(requestWildsJump(state,100).ok,true);
 assert.equal(requestWildsJump(state,100).ok,false);
 let apex=state.worldY;
 for(let i=0;i<90;i++){writeWildsVerticalTraversalStep(state,step);apex=Math.max(apex,state.worldY);}
 assert.ok(apex>3&&apex<3.5);assert.equal(state.worldY,2);assert.equal(state.offset,0);assert.equal(state.jumpVelocity,undefined);
});
test('jump bounds frame spikes, stops at ceilings and clears on water or reset', () => {
 const state=createWildsVerticalTraversalState();writeWildsVerticalTraversalStep(state,step);requestWildsJump(state,100);
 writeWildsVerticalTraversalStep(state,{...step,deltaSeconds:10,ceilingY:3.9});
 assert.ok(state.worldY+WILDS_PLAYER_BODY_HEIGHT<=3.9);assert.ok((state.jumpVelocity??0)<=0);
 resetWildsVerticalTraversalState(state);assert.equal(state.jumpVelocity,undefined);
 assert.equal(requestWildsJump(state,0).ok,false);
 writeWildsVerticalTraversalStep(state,step);requestWildsJump(state,100);
 writeWildsVerticalTraversalStep(state,{...step,layer:'water',waterSurfaceY:6});assert.equal(state.jumpVelocity,undefined);
});
test('hands animate independently, reject repeat windups and return to idle',()=>{
 const state=createWildsHandActionState();assert.equal(beginWildsHandAction(state,'left','strike',100),true);
 assert.equal(beginWildsHandAction(state,'left','strike',100),false);
 assert.equal(beginWildsHandAction(state,'left','strike',120),false);
 assert.equal(beginWildsHandAction(state,'right','grab',120),true);
 const left=sampleWildsHandPose(state.left,250),right=sampleWildsHandPose(state.right,250);
 assert.notEqual(left.shoulderX,right.shoulderX);assert.ok(left.weight>0&&right.weight>0);
 assert.equal(sampleWildsHandPose(state.left,900).weight,0);
});
test('hand targets respect actual qualification, space, height and forward reach',()=>{
 const actor={x:0,y:0,z:0,spaceId:'outside',heading:0};
 const candidates=[{id:'behind',x:0,y:0,z:1,spaceId:'outside',qualified:true},{id:'locked',x:0,y:0,z:-.2,spaceId:'outside',qualified:false},{id:'above',x:0,y:4,z:-1,spaceId:'outside',qualified:true},{id:'inside',x:0,y:0,z:-1,spaceId:'inside',qualified:true},{id:'food',x:0,y:0,z:-2,spaceId:'outside',qualified:true}];
 assert.equal(selectWildsHandTarget(actor,candidates,3)?.id,'food');
 assert.equal(selectWildsHandTarget(actor,candidates,1),null);
});
