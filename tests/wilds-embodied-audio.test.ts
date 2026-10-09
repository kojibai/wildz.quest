import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWildsEmbodiedAudioPlanner, type WildsEmbodiedSnapshot, type WildsEmbodiedSource, type WildsFootSurface } from '../src/features/play/wilds-embodied-audio';
const frame = (x=0, sources: WildsEmbodiedSource[]=[], surface: WildsFootSurface='grass'): WildsEmbodiedSnapshot => ({listener:{x,y:0,z:0},heading:0,spaceId:'outer',grounded:true,running:false,sources,surfaceAt:()=>surface});
const bird=(id='bird',x=5,spaceId='outer'):WildsEmbodiedSource=>({id,kind:'bird',position:{x,y:0,z:0},spaceId,active:true,locomotion:'ground'});

test('walking uses actual travelled distance and the surface under the player',()=>{
  const planner=createWildsEmbodiedAudioPlanner(); let probes=0;
  planner.sample({...frame(),surfaceAt:()=>{probes++;return 'rock';}},0);
  for(let t=125;t<=2000;t+=125) assert.equal(planner.sample(frame(),t).length,0);
  assert.equal(probes,0,'idle must not sample terrain');
  assert.equal(planner.sample(frame(.4,[],'rock'),2125).length,0);
  const sounds=planner.sample(frame(.9,[],'rock'),2250);
  assert.equal(sounds.length,1); assert.equal(sounds[0].assetId,'step-rock');
  assert.equal(sounds[0].group,'effects'); assert.equal(sounds[0].pan,0);
});
test('teleports, realm changes, flight and resume never replay accumulated footsteps',()=>{
  const planner=createWildsEmbodiedAudioPlanner(); planner.sample(frame(),0);
  assert.deepEqual(planner.sample(frame(100),125),[]);
  assert.deepEqual(planner.sample({...frame(101),grounded:false},250),[]);
  assert.deepEqual(planner.sample(frame(102),375),[]);
  assert.deepEqual(planner.sample({...frame(103),spaceId:'interior'},500),[]);
  assert.deepEqual(planner.sample(frame(104),3000),[]);
  planner.reset(); assert.deepEqual(planner.sample(frame(105),3125),[]);
});
test('nearby sound is spatial, distant sound softer, with bounded quiet calls',()=>{
  const planner=createWildsEmbodiedAudioPlanner(), sources=[bird()]; planner.sample(frame(0,sources),0);
  let sounds=[] as ReturnType<typeof planner.sample>;
  for(let t=125;t<45000;t+=125) sounds.push(...planner.sample(frame(0,sources),t));
  const calls=sounds.filter(s=>s.assetId==='fauna-bird');
  assert.ok(calls.length>=1&&calls.length<=3); assert.ok(calls[0].pan>0); assert.ok(calls[0].gain>0&&calls[0].gain<.2);
  const far=createWildsEmbodiedAudioPlanner(), distant=[bird('bird',25)]; far.sample(frame(0,distant),0);
  const distantCalls=[] as typeof calls; for(let t=125;t<45000;t+=125)distantCalls.push(...far.sample(frame(0,distant),t));
  assert.ok(distantCalls[0].gain<calls[0].gain);
});
test('wrong spaces, vanished or stale actors are silent and stationary players never walk',()=>{
  const planner=createWildsEmbodiedAudioPlanner();
  const sources=[bird('wrong',2,'interior'),{...bird('player'),kind:'player' as const},{...bird('stale'),updatedAt:0}];
  for(let t=1000;t<30000;t+=125) assert.deepEqual(planner.sample(frame(0,sources),t),[]);
  assert.deepEqual(planner.sample(frame(),30125),[]);
});
test('nearby player steps follow movement, with no stationary movement loop',()=>{
  const planner=createWildsEmbodiedAudioPlanner(); const player={...bird('player',3),kind:'player' as const};
  planner.sample(frame(0,[player]),0); player.position.x+=.9;
  const step=planner.sample(frame(0,[player]),1000); // A long gap resets, rather than replaying a packet.
  assert.deepEqual(step,[]); player.position.x+=.9;
  assert.equal(planner.sample(frame(0,[player]),1125)[0].group,'ambience');
  assert.deepEqual(planner.sample(frame(0,[player]),1250),[]);
});
test('a crowded scene cannot create a chorus or an unbounded state history',()=>{
  const planner=createWildsEmbodiedAudioPlanner();const sources=Array.from({length:400},(_,i)=>bird('bird'+i,2+i*.01));
  for(let t=0;t<60000;t+=125) assert.ok(planner.sample(frame(0,sources),t).length<=2);
});
