export type WildsFootSurface = 'grass' | 'soil' | 'sand' | 'trail' | 'rock' | 'wood' | 'shallow-water' | 'deep-water';
export type WildsAudioPoint = { x: number; y: number; z: number };
export type WildsEmbodiedSource = {
  id: string; kind: 'player' | 'creature' | 'bird' | 'animal';
  position: WildsAudioPoint; spaceId: string; active: boolean;
  locomotion: 'ground' | 'air' | 'swim'; updatedAt?: number;
};
export type WildsEmbodiedSound = { assetId: string; gain: number; pan: number; playbackRate: number; group: 'effects' | 'ambience' };
export type WildsEmbodiedSnapshot = {
  listener: WildsAudioPoint; heading: number; spaceId: string; grounded: boolean; running: boolean;
  sources: Iterable<WildsEmbodiedSource>;
  surfaceAt: (point: WildsAudioPoint, spaceId: string) => WildsFootSurface;
};
export type WildsEmbodiedAudioRegistry = Map<string, () => WildsEmbodiedSource | null>;
export const WILDS_EMBODIED_AUDIO_ASSETS = ['step-grass-1', 'step-grass-2', 'step-soil', 'step-trail', 'step-rock', 'step-wood-1', 'step-wood-2', 'step-water-1', 'step-water-2', 'fauna-bird', 'creature-call'] as const;
const surfaceAssets: Record<WildsFootSurface, readonly string[]> = {
  grass: ['step-grass-1', 'step-grass-2'], soil: ['step-soil'], sand: ['step-soil'],
  trail: ['step-trail'], rock: ['step-rock'], wood: ['step-wood-1', 'step-wood-2'],
  'shallow-water': ['step-water-1', 'step-water-2'], 'deep-water': []
};
const finite = (point: WildsAudioPoint) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
const distance = (a: WildsAudioPoint, b: WildsAudioPoint) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
function seedFor(id: string) {
  let seed=0; for(let i=0;i<id.length;i++) seed=(Math.imul(seed,31)+id.charCodeAt(i))>>>0;
  return seed;
}
type Motion = { position: WildsAudioPoint; travelled: number; lastStep: number; sequence: number; nextCall: number; seen: number };
function motion(point: WildsAudioPoint, now: number, seed=0): Motion {
  return { position: {...point}, travelled:0, lastStep:-Infinity, sequence:0, nextCall:now+4000+seed%11000, seen:now };
}
/** Presentation only: consumes already available positions, never proof history or network authority. */
export function createWildsEmbodiedAudioPlanner() {
  let listener: Motion | null=null, realm='', lastAt=-Infinity, wasGrounded=false, lastWorldSound=-Infinity;
  const actors=new Map<string,Motion>();
  const reset=()=>{listener=null; realm=''; lastAt=-Infinity; wasGrounded=false; actors.clear();};
  const step=(track: Motion, point: WildsAudioPoint, now: number, stride: number, cooldown: number) => {
    const moved=distance(point,track.position); Object.assign(track.position,point); track.seen=now;
    if(moved>3 || moved<.002) { if(moved>3)track.travelled=0; return false; }
    track.travelled+=moved;
    if(track.travelled<stride || now-track.lastStep<cooldown)return false;
    track.travelled=0; track.lastStep=now; track.sequence++; return true;
  };
  const footfall=(snapshot:WildsEmbodiedSnapshot, point:WildsAudioPoint, track:Motion, gain:number, pan:number, group:WildsEmbodiedSound['group']):WildsEmbodiedSound|null=>{
    const choices=surfaceAssets[snapshot.surfaceAt(point,snapshot.spaceId)];
    if(!choices?.length)return null;
    return {assetId:choices[track.sequence%choices.length]!, gain, pan, group, playbackRate:track.sequence%2 ? .96 : 1.04};
  };
  return { reset, sample(snapshot: WildsEmbodiedSnapshot, now: number): WildsEmbodiedSound[] {
    if(!finite(snapshot.listener)||!Number.isFinite(now)||!Number.isFinite(snapshot.heading)){reset();return [];}
    const discontinuity=realm!==snapshot.spaceId||now-lastAt>750||now<lastAt;
    if(discontinuity)reset();
    const sounds:WildsEmbodiedSound[]=[];
    if(!listener)listener=motion(snapshot.listener,now);
    else if(snapshot.grounded&&wasGrounded) {
      if(step(listener,snapshot.listener,now,snapshot.running?1.05:.72,snapshot.running?220:320)) {
        const sound=footfall(snapshot,snapshot.listener,listener,snapshot.running?.24:.17,0,'effects');
        if(sound)sounds.push(sound);
      }
    } else { Object.assign(listener.position,snapshot.listener); listener.travelled=0; }
    wasGrounded=snapshot.grounded; realm=snapshot.spaceId; lastAt=now;
    // A fixed candidate budget and nearest eight retain bounded positional history.
    const nearest:Array<{source:WildsEmbodiedSource;distance:number}>=[];
    let inspected=0;
    for(const source of snapshot.sources) {
      if(++inspected>64)break;
      if(!source.active||source.spaceId!==realm||!finite(source.position)||(source.updatedAt!==undefined&&now-source.updatedAt>750))continue;
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
      const moved=source.locomotion==='ground'&&step(track,source.position,now,source.kind==='player'?.72:.32,source.kind==='player'?480:950);
      if(!moved){Object.assign(track.position,source.position);track.seen=now;}
      if(moved&&d<12&&now-lastWorldSound>=450&&sounds.length<2) {
        const sound=footfall(snapshot,source.position,track,(source.kind==='player'?.12:.065)*attenuation,pan,'ambience');
        if(sound){sounds.push(sound);lastWorldSound=now;}
      }
      if((source.kind==='bird'||source.kind==='creature')&&now>=track.nextCall) {
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
