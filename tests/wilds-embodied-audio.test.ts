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
test('footsteps stay subtle and gently follow movement speed without changing the contact cadence',()=>{
  const contacts=(metresPerTick:number,running=false)=>{
    const planner=createWildsEmbodiedAudioPlanner();planner.sample({...frame(),running},0);
    const sounds=[] as ReturnType<typeof planner.sample>;
    for(let tick=1;tick<=40;tick++)sounds.push(...planner.sample({...frame(tick*metresPerTick),running},tick*125));
    return sounds;
  };
  const slow=contacts(.1),walk=contacts(.4),run=contacts(.7,true);
  assert.ok(slow.length>0&&walk.length>slow.length&&run.length>walk.length);
  assert.ok(walk.every(sound=>sound.gain>0&&sound.gain<=.085),'walking should be at least 6 dB below the previous mix');
  assert.ok(run.every(sound=>sound.gain<=.12),'running remains subtle too');
  const mean=(sounds:typeof walk)=>sounds.reduce((sum,sound)=>sum+sound.gain,0)/sounds.length;
  assert.ok(mean(slow)<mean(walk)&&mean(walk)<mean(run));
  assert.ok(new Set(walk.slice(-6).map(sound=>sound.gain)).size>1,'steady movement has gentle contact variation');
  const nearby=createWildsEmbodiedAudioPlanner(),player={...bird('player',3),kind:'player' as const};
  nearby.sample(frame(0,[player]),0);player.position.x+=.9;
  const neighbour=nearby.sample(frame(0,[player]),125);
  assert.equal(neighbour.length,1);assert.ok(neighbour[0].gain>0&&neighbour[0].gain<.06);
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

test('every known floor has a fitting footfall and swimming never invents ground steps',()=>{
 for(const [surface,expected] of [['wood','step-wood-'],['soil','step-soil'],['trail','step-trail'],['shallow-water','step-water-'],['deep-water','']] as const){
  const planner=createWildsEmbodiedAudioPlanner();planner.sample(frame(0,[],surface),0);
  const sounds=planner.sample(frame(.9,[],surface),125);
  if(expected)assert.ok(sounds[0].assetId.startsWith(expected));else assert.deepEqual(sounds,[]);
 }
});

test('swimming has quiet water strokes, skips terrain, and never replays a dive or resumed movement',()=>{
 const planner=createWildsEmbodiedAudioPlanner();let probes=0;
 const swim=(x:number):WildsEmbodiedSnapshot=>({...frame(x),grounded:false,swimming:true,underwater:true,surfaceAt:()=>{probes++;return 'deep-water';}});
 planner.sample(swim(0),0);
 const sounds=planner.sample(swim(1.3),125);
 assert.ok(sounds.some(sound=>sound.assetId.startsWith('swim-water-')));
 assert.equal(probes,0);
 assert.deepEqual(planner.sample(swim(1.3),250),[]);
 assert.deepEqual(planner.sample({...swim(100),swimming:false},375),[]);
 assert.deepEqual(planner.sample(swim(101),500),[]);
 assert.deepEqual(planner.sample(swim(102),3000),[]);
});

test('steep mountain contacts use climbing texture and underwater listeners do not hear land birds',()=>{
 const planner=createWildsEmbodiedAudioPlanner();planner.sample(frame(0,[],'mountain-rock'),0);
 assert.equal(planner.sample(frame(.9,[],'mountain-rock'),125)[0].assetId,'climb-rock');
 const submerged=createWildsEmbodiedAudioPlanner();
 for(let t=0;t<30000;t+=125){
  const sounds=submerged.sample({...frame(0,[bird()]),grounded:false,swimming:true,underwater:true},t);
  assert.ok(sounds.every(sound=>sound.assetId.startsWith('swim-water-')));
  assert.ok(sounds.length<=2);
 }
});

test('flight and glide airflow follows real speed, stays silent on ground, and never probes terrain',()=>{
 const planner=createWildsEmbodiedAudioPlanner();
 let probes=0;
 const air=(x:number,mode:'flight'|'glide')=>({...frame(x),grounded:false,aerialMode:mode,surfaceAt:()=>{probes++;return 'rock' as const;}});
 planner.sample(frame(),0);assert.equal(planner.airflow(),null);
 planner.sample(air(0,'flight'),125);const hovering=planner.airflow()?.gain;assert.ok(hovering&&hovering>0);
 for(let tick=2;tick<=16;tick++)assert.deepEqual(planner.sample(air((tick-1)*.7,'flight'),tick*125),[]);
 const fast=planner.airflow();assert.ok(fast&&fast.assetId==='flight-wind'&&fast.gain>hovering&&fast.gain<=.13);
 const powered=fast.gain;planner.sample(air(11.2,'glide'),2125);assert.ok(planner.airflow()!.gain<powered);
 assert.equal(probes,0);
 planner.sample(frame(11.2),2250);assert.equal(planner.airflow(),null);
 planner.sample(air(100,'flight'),4000);assert.ok(planner.airflow()!.gain< powered,'resume/teleport must not create a speed surge');
 planner.reset();assert.equal(planner.airflow(),null);
});
