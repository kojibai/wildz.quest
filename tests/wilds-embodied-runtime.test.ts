import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWildsAudioRuntime, DEFAULT_WILDS_AUDIO_SETTINGS, type WildsAudioContextLike } from '../src/features/play/wilds-audio';
import type { WildsEmbodiedSound } from '../src/features/play/wilds-embodied-audio';
const sound:WildsEmbodiedSound={assetId:'step-rock',gain:.2,pan:.7,playbackRate:1,group:'effects'};
function engine(){
 let contexts=0,fetches=0,stops=0,disconnects=0,volume=0,failStart=false;
 const sources:Array<{onended?:(()=>void)|null;stop:()=>void}>=[];
 const param={setValueAtTime(value:number){volume=value;},exponentialRampToValueAtTime(){}};
 const context:WildsAudioContextLike={currentTime:0,destination:{},resume:async()=>{},close:async()=>{},
  createOscillator:()=>({type:'sine',frequency:param,connect(){},disconnect(){},start(){},stop(){}}),
  createGain:()=>({gain:param,connect(){},disconnect(){disconnects++;}}),
  createBufferSource:()=>{const source={buffer:null,onended:null as (()=>void)|null,connect(){},disconnect(){disconnects++;},start(){if(failStart)throw Error('context interrupted');},stop(){stops++;}};sources.push(source);return source;},
  decodeAudioData:async()=>({}),
 };
 const runtime=createWildsAudioRuntime(()=>{contexts++;return context;},async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};});
 return {runtime,sources,fail(){failStart=true;},metrics:()=>({contexts,fetches,stops,disconnects,volume})};
}
test('the sound layer creates no context or fetch until unlocked and skips undecoded audio',async()=>{
 const e=engine();assert.equal(e.runtime.playEmbodied(sound),false);await e.runtime.preload(['step-rock']);assert.equal(e.metrics().contexts,0);assert.equal(e.metrics().fetches,0);
 await e.runtime.unlock();assert.equal(e.runtime.playEmbodied(sound),false);
 await Promise.all([e.runtime.preload(['step-rock']),e.runtime.preload(['step-rock'])]);assert.equal(e.metrics().fetches,1);
 assert.equal(e.runtime.playEmbodied(sound),true);await e.runtime.destroy();
});
test('at most four optional voices play, ended voices release nodes, and mute stops them',async()=>{
 const e=engine();await e.runtime.unlock();await e.runtime.preload(['step-rock']);
 for(let i=0;i<4;i++)assert.equal(e.runtime.playEmbodied(sound),true);
 assert.equal(e.runtime.playEmbodied(sound),false);e.sources[0].onended?.();assert.equal(e.metrics().disconnects,2);
 assert.equal(e.runtime.playEmbodied(sound),true);e.runtime.setSettings({...DEFAULT_WILDS_AUDIO_SETTINGS,muted:true});
 assert.equal(e.metrics().stops,4);assert.equal(e.runtime.playEmbodied(sound),false);await e.runtime.destroy();assert.equal(e.metrics().stops,4);
});
test('volume controls affect an already sounding animal immediately',async()=>{
 const e=engine();await e.runtime.unlock();await e.runtime.preload(['step-rock']);e.runtime.playEmbodied(sound);
 e.runtime.setSettings({...DEFAULT_WILDS_AUDIO_SETTINGS,master:0});assert.equal(e.metrics().volume,0);await e.runtime.destroy();
});
test('an interrupted optional source never throws into gameplay and releases its voice',async()=>{
 const e=engine();await e.runtime.unlock();await e.runtime.preload(['step-rock']);e.fail();
 assert.equal(e.runtime.playEmbodied(sound),false);assert.equal(e.metrics().disconnects,2);await e.runtime.destroy();
});
