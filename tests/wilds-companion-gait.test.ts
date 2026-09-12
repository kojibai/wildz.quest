import assert from 'node:assert/strict';
import {test} from 'node:test';
import {companionFootStep, companionFootRows} from '../src/features/play/wilds-companion-gait';
test('ground steps alternate diagonal feet and stop without time-based floating',()=>{
 for(const distance of [0,.04,.16,.32,100]) {
  assert.deepEqual(companionFootStep(distance,1,1,false),{z:0,lift:0});
  const a=companionFootStep(distance,1,1,true),b=companionFootStep(distance,-1,1,true);
  assert.ok(a.lift>=0 && b.lift>=0);
  assert.ok(Math.abs(a.z+b.z)<1e-10);
  assert.ok(Math.min(a.lift,b.lift)<1e-10);
  assert.deepEqual(a,companionFootStep(distance,-1,-1,true));
 }
});

test('canonical locomotion selects two legs, four legs, or no invented legs',()=>{
 assert.equal(companionFootRows('biped').length*2,2);
 assert.equal(companionFootRows('quadruped').length*2,4);
 assert.equal(companionFootRows('flying').length,0);
 assert.equal(companionFootRows('serpentine').length,0);
});
