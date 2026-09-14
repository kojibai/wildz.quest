import assert from 'node:assert/strict';
import {test} from 'node:test';
import {companionFootStep, companionFootRows, writeWildsCompanionAnimation} from '../src/features/play/wilds-companion-gait';
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

test('fast travel keeps leg cycles readable at 30, 60 and 120 fps and eases into rest',()=>{
 for(const hz of [30,60,120]) {
  const animation={distance:0,sourceDistance:0,weight:0};
  for(let frame=1;frame<=hz*4;frame++) {
   const before=animation.distance;
   writeWildsCompanionAnimation(animation,{distance:frame/hz*35,speed:35},1/hz);
   assert.ok(animation.distance-before<=.65*2/hz+1e-10);
  }
  assert.ok(Math.abs(animation.distance-.65*8)<1e-9);
  assert.ok(animation.weight>.999);
  const stopped=animation.distance;
  for(let frame=0;frame<hz;frame++) {
   const before=animation.weight;
   writeWildsCompanionAnimation(animation,{distance:140,speed:0},1/hz);
   assert.ok(animation.weight<=before);
  }
  assert.equal(animation.distance,stopped);
  assert.ok(animation.weight<.000001);
  writeWildsCompanionAnimation(animation,{distance:0,speed:0},1/hz);
  assert.equal(animation.distance,stopped,'a regroup resets source distance without reversing the legs');
 }
});
