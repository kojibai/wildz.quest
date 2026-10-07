import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPlayState, applyWildsInput, serializePlayState, restorePlayState, type PlayState } from '../src/features/play/game-state';
import { createPlayerBreaths, advancePlayerBreaths } from '../src/features/play/player-breath-energy';
import { reconcileWildsBedRest } from '../src/features/play/wilds-bed-rest-runtime';

function savedBed(created=true):PlayState{
  const state:PlayState={...structuredClone(initialPlayState),inventory:[],playerBreaths:advancePlayerBreaths(createPlayerBreaths(100,35),100,'bed',true),
    playerBedRest:{componentId:'bed:fixture',componentHead:`sha256:${'a'.repeat(64)}`,spaceId:'wildz.space.outer.v1',...(created?{instanceId:'creation:fixture',nodeId:'bed'}:{})}};
  return restorePlayState(serializePlayState(state),'bed_fixture');
}

test('saved creation bed rest stays intact until its physical source finishes restoring',()=>{
  const state=savedBed();
  assert.equal(state.playerBreaths?.mode,'bed');
  assert.equal(reconcileWildsBedRest(state,{worldReady:true,creationReady:false,bedAvailable:false,readKai:()=>101}),state);
});

test('startup reconciliation cannot issue a wake older than the latest energy settlement',()=>{
  const state=applyWildsInput(savedBed(),{type:'energy-tick',kaiUPulse:101});
  assert.throws(()=>applyWildsInput(state,{type:'wake',kaiUPulse:100}),/creature_history_kai_regression/);
  assert.equal(reconcileWildsBedRest(state,{worldReady:true,creationReady:true,bedAvailable:false,readKai:()=>100}),state);
  const caughtUp=reconcileWildsBedRest(state,{worldReady:true,creationReady:true,bedAvailable:false,readKai:()=>101});
  assert.equal(caughtUp.playerBreaths?.mode,'active');assert.equal(caughtUp.playerBedRest,undefined);
});

test('a loaded available bed keeps rest and a definitively missing bed wakes at the current pulse',()=>{
  const state=savedBed();
  assert.equal(reconcileWildsBedRest(state,{worldReady:true,creationReady:true,bedAvailable:true,readKai:()=>101}),state);
  const awake=reconcileWildsBedRest(state,{worldReady:true,creationReady:true,bedAvailable:false,readKai:()=>101});
  assert.equal(awake.playerBreaths?.mode,'active');assert.equal(awake.playerBedRest,undefined);
  assert.equal(awake.playerBreaths?.lastKaiUPulse,101);assert.deepEqual(awake.player,state.player);
});

test('manual bed reconciliation depends on its world source, without waiting for creation restoration',()=>{
  const state=savedBed(false);
  assert.equal(reconcileWildsBedRest(state,{worldReady:false,creationReady:true,bedAvailable:false,readKai:()=>101}),state);
  assert.equal(reconcileWildsBedRest(state,{worldReady:true,creationReady:false,bedAvailable:false,readKai:()=>101}).playerBreaths?.mode,'active');
});

test('an admitted supporting floor repairs saved height before waking, without changing horizontal position or time',()=>{
  const state=savedBed();
  const repaired=reconcileWildsBedRest(state,{worldReady:true,creationReady:true,bedAvailable:false,restoredFloorY:12.1,readKai:()=>101});
  assert.equal(repaired.siteSpace.position.y,12.1);assert.deepEqual(repaired.player,state.player);
  assert.equal(repaired.playerBreaths,state.playerBreaths);assert.equal(repaired.playerBedRest,state.playerBedRest);
});
