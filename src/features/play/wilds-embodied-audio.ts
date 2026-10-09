export type WildsFootSurface = 'grass' | 'soil' | 'sand' | 'trail' | 'rock' | 'mountain-rock' | 'wood' | 'shallow-water' | 'deep-water';
export type WildsAudioPoint = { x: number; y: number; z: number };
export type WildsEmbodiedSource = {
  id: string; kind: 'player' | 'creature' | 'bird' | 'animal';
  position: WildsAudioPoint; spaceId: string; active: boolean;
  locomotion: 'ground' | 'air' | 'swim'; updatedAt?: number;
};
export type WildsEmbodiedSound = { assetId: string; gain: number; pan: number; playbackRate: number; group: 'effects' | 'ambience' };
export type WildsEmbodiedSnapshot = {
  listener: WildsAudioPoint; heading: number; spaceId: string; grounded: boolean; running: boolean;
  swimming?: boolean; underwater?: boolean;
  aerialMode?: 'ground' | 'flight' | 'glide';
  sources: Iterable<WildsEmbodiedSource>;
  surfaceAt: (point: WildsAudioPoint, spaceId: string) => WildsFootSurface;
};
export type WildsEmbodiedAudioRegistry = Map<string, () => WildsEmbodiedSource | null>;
export const WILDS_EMBODIED_AUDIO_ASSETS = ['step-grass-1', 'step-grass-2', 'step-soil', 'step-trail', 'step-rock', 'step-wood-1', 'step-wood-2', 'step-water-1', 'step-water-2', 'fauna-bird', 'creature-call', 'swim-water-1', 'swim-water-2', 'climb-rock', 'flight-wind'] as const;
const surfaceAssets: Record<WildsFootSurface, readonly string[]> = {
  grass: ['step-grass-1', 'step-grass-2'], soil: ['step-soil'], sand: ['step-soil'],
  trail: ['step-trail'], rock: ['step-rock'], 'mountain-rock': ['climb-rock'], wood: ['step-wood-1', 'step-wood-2'],
  'shallow-water': ['step-water-1', 'step-water-2'], 'deep-water': []
};
const finite = (point: WildsAudioPoint) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
const distance = (a: WildsAudioPoint, b: WildsAudioPoint) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
const contactGains = [.94, 1, .97, .92, .98, .95] as const;
function seedFor(id: string) {
  let seed=0; for(let i=0;i<id.length;i++) seed=(Math.imul(seed,31)+id.charCodeAt(i))>>>0;
  return seed;
}
type Motion = { position: WildsAudioPoint; travelled: number; speed: number; lastStep: number; sequence: number; nextCall: number; seen: number };
function motion(point: WildsAudioPoint, now: number, seed=0): Motion {
  return { position: {...point}, travelled:0, speed:0, lastStep:-Infinity, sequence:0, nextCall:now+4000+seed%11000, seen:now };
}
/** Presentation only: consumes already available positions, never proof history or network authority. */
export function createWildsEmbodiedAudioPlanner() {
  let listener: Motion | null=null, realm='', lastAt=-Infinity, priorLocomotion='', lastWorldSound=-Infinity, nextUnderwater=-Infinity;
  let airborne=false;
  const wind:WildsEmbodiedSound={assetId:'flight-wind',gain:0,pan:0,playbackRate:1,group:'ambience'};
  const actors=new Map<string,Motion>();
  const reset=()=>{listener=null; realm=''; lastAt=-Infinity; priorLocomotion=''; lastWorldSound=-Infinity; nextUnderwater=-Infinity; airborne=false; actors.clear();};
  const move=(track: Motion, point: WildsAudioPoint, now: number) => {
    const moved=distance(point,track.position),elapsed=now-track.seen; Object.assign(track.position,point); track.seen=now;
    if(moved>3) { track.travelled=0; track.speed=0; return 0; }
    track.speed += .35*((elapsed>0?moved*1000/elapsed:0)-track.speed);
    return moved;
  };
  const step=(track: Motion, point: WildsAudioPoint, now: number, stride: number, cooldown: number) => {
    const moved=move(track,point,now);
    if(moved<.002)return false;
    track.travelled+=moved;
    if(track.travelled<stride || now-track.lastStep<cooldown)return false;
    track.travelled=0; track.lastStep=now; track.sequence++; return true;
  };
  const footfall=(snapshot:WildsEmbodiedSnapshot, point:WildsAudioPoint, track:Motion, gain:number, pan:number, group:WildsEmbodiedSound['group']):WildsEmbodiedSound|null=>{
    const choices=surfaceAssets[snapshot.surfaceAt(point,snapshot.spaceId)];
    if(!choices?.length)return null;
    // Soft contacts rise gently with actual speed; tiny deterministic variation avoids a rigid loop.
    const dynamics=(.72+.28*Math.min(1,track.speed/4.5))*contactGains[track.sequence%contactGains.length]!;
    return {assetId:choices[track.sequence%choices.length]!, gain:gain*dynamics, pan, group, playbackRate:track.sequence%2 ? .96 : 1.04};
  };
  return { reset, airflow:()=>airborne?wind:null, sample(snapshot: WildsEmbodiedSnapshot, now: number): WildsEmbodiedSound[] {
    if(!finite(snapshot.listener)||!Number.isFinite(now)||!Number.isFinite(snapshot.heading)){reset();return [];}
    const discontinuity=realm!==snapshot.spaceId||now-lastAt>750||now<lastAt;
    if(discontinuity)reset();
    const sounds:WildsEmbodiedSound[]=[];
    const locomotion=snapshot.swimming?'swim':snapshot.grounded?'ground':'air';
    if(!listener)listener=motion(snapshot.listener,now);
    else if(locomotion!=='air'&&locomotion===priorLocomotion) {
      if(step(listener,snapshot.listener,now,snapshot.swimming?1.1:snapshot.running?1.05:.72,snapshot.swimming?800:snapshot.running?220:320)) {
        const sound=snapshot.swimming
          ? {assetId:`swim-water-${listener.sequence%2+1}`,gain:.12,pan:0,playbackRate:1,group:'effects' as const}
          : footfall(snapshot,snapshot.listener,listener,snapshot.running?.12:.085,0,'effects');
        if(sound)sounds.push(sound);
      }
    } else { move(listener,snapshot.listener,now); listener.travelled=0; }
    airborne=!snapshot.grounded&&!snapshot.swimming&&(snapshot.aerialMode==='flight'||snapshot.aerialMode==='glide');
    if(airborne){
      const speed=Math.min(1,listener.speed/8);
      wind.gain=snapshot.aerialMode==='flight'?.055+.075*speed:.05+.055*speed;
      wind.playbackRate=.9+.18*speed;
    }
    priorLocomotion=locomotion; realm=snapshot.spaceId; lastAt=now;
    if(!snapshot.underwater)nextUnderwater=-Infinity;
    else if(nextUnderwater===-Infinity)nextUnderwater=now+9000;
    else if(now>=nextUnderwater&&sounds.length===0){
      sounds.push({assetId:'swim-water-1',gain:.028,pan:0,playbackRate:.85,group:'ambience'});
      nextUnderwater=now+13000;
    }
    // A fixed candidate budget and nearest eight retain bounded positional history.
    const nearest:Array<{source:WildsEmbodiedSource;distance:number}>=[];
    let inspected=0;
    for(const source of snapshot.sources) {
      if(++inspected>64)break;
      if(!source.active||source.spaceId!==realm||!finite(source.position)||(source.updatedAt!==undefined&&now-source.updatedAt>750))continue;
      if(snapshot.underwater&&source.locomotion!=='swim')continue;
      const d=distance(source.position,snapshot.listener); if(d>36)continue;
      let index=0; while(index<nearest.length&&nearest[index].distance<=d)index++;
      if(index<8){nearest.splice(index,0,{source,distance:d});if(nearest.length>8)nearest.pop();}
    }
    const seen=new Set<string>();
    for(const {source,distance:d} of nearest) {
      seen.add(source.id);
      let track=actors.get(source.id);
      if(!track){track=motion(source.position,now,seedFor(source.id));actors.set(source.id,track);continue;}
      const dx=source.position.x-snapshot.listener.x,dz=source.position.z-snapshot.listener.z;
      // Camera heading matches the world camera's orientation; screen-right is +pan.
      const pan=d>.001?Math.max(-1,Math.min(1,(dx*Math.cos(snapshot.heading)-dz*Math.sin(snapshot.heading))/d))*.85:0;
      const attenuation=(1-d/36)**2;
      const moved=source.locomotion!=='air'&&step(track,source.position,now,source.locomotion==='swim'?1.1:source.kind==='player'?.72:.32,source.kind==='player'?480:950);
      if(!moved){Object.assign(track.position,source.position);track.seen=now;}
      if(moved&&d<12&&now-lastWorldSound>=450&&sounds.length<2) {
        const sound=source.locomotion==='swim'
          ? {assetId:`swim-water-${track.sequence%2+1}`,gain:.065*attenuation,pan,playbackRate:1,group:'ambience' as const}
          : footfall(snapshot,source.position,track,(source.kind==='player'?.06:.0325)*attenuation,pan,'ambience');
        if(sound){sounds.push(sound);lastWorldSound=now;}
      }
      if(!snapshot.underwater&&(source.kind==='bird'||source.kind==='creature')&&now>=track.nextCall) {
        if(now-lastWorldSound>=4000&&sounds.length<2) {
          sounds.push({assetId:source.kind==='bird'?'fauna-bird':'creature-call',gain:(source.kind==='bird'?.13:.065)*attenuation,pan,playbackRate:1,group:'ambience'});
          lastWorldSound=now;track.nextCall=now+18000+seedFor(source.id)%17000;
        } else track.nextCall=now+1500+seedFor(source.id)%2000;
      }
    }
    for(const id of actors.keys())if(!seen.has(id))actors.delete(id);
    return sounds;
  }};
}
