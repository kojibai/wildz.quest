import {deriveBirthGenome} from './heartbound-genome';
import {renderHeartboundSvg,type HeartboundPose} from './heartbound-renderer';
import {currentLivingGenome} from './living-card-proof';
import {isLivingCardAsset} from './living-card-types';
import type {LivingCardGenome} from './living-card-types';
import {sha256PortableBasis,type PortableCardAsset} from './portable-card';
import {projectCardCreatureLevelAppearance} from './wilds-creature-level-appearance';
import {projectWildsBiome} from './wilds-biome';
import {sampleWildsTerrain,WILDS_TERRAIN_TILE_SIZE} from './wilds-terrain-authority';

export const WILDS_COLLECTIBLE_ART_EDITION='wildz.collectible-portrait.v1';
const xml=(text:string)=>text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const color=(value:string)=>/^(?:#[a-f0-9]{3,8}|(?:hsl|rgb)a?\([\d\s.,%+-]+\))$/i.test(value)?value:'#8ebfaf';
const unit=(seed:string,index:number)=>Number.parseInt(sha256PortableBasis(`${seed}:${index}`).slice(7,15),16)/0xffffffff;

/** An illustrated view of sealed discovery geography, not a historical screenshot
 * of player construction/weather. Legacy cards use an identified genome habitat. */
export function projectWildsCardArtHabitat(asset:PortableCardAsset,genome:LivingCardGenome){
 const traits=asset.manifest.variant.traits;
 const discovery='identity' in traits&&traits.identity.version===3?traits.identity.discovery:null;
 if(discovery){const {x,z}=discovery.location;
  const tile=projectWildsBiome(Math.floor(x/WILDS_TERRAIN_TILE_SIZE),Math.floor(z/WILDS_TERRAIN_TILE_SIZE),0,0),terrain=sampleWildsTerrain(x,z);
  return {source:'sealed-discovery-location' as const,x,z,region:terrain.regionId,water:terrain.waterDepth>0,rock:terrain.surface==='rock',seed:`${x}:${z}:${tile.seed}`,ground:tile.ground.base,canopy:tile.canopy.deep,landmark:tile.landmark.kind};
 }
 return {source:'genome-habitat' as const,x:null,z:null,region:genome.anatomy.aura,water:genome.anatomy.aura==='tide',rock:genome.anatomy.aura==='stone',seed:genome.identityAnchor,ground:'#315349',canopy:'#123832',landmark:'none'};
}

function texture(kind:LivingCardGenome['surface']['kind'],id:string,seed:string){
 const strokes=Array.from({length:12},(_,i)=>{const x=unit(seed,i)*24,y=unit(seed,i+31)*24;
  return kind==='scale'||kind==='shell'?`<path d="M${x-4} ${y}q4 7 8 0"/>`:kind==='feather'?`<path d="M${x} ${y-4}q-5 8 0 13m0-9-4 3m4 0 4-3"/>`:kind==='energy'?`<circle cx="${x}" cy="${y}" r=".8"/>`:`<path d="M${x} ${y}q-2 3-1 5"/>`;
 }).join('');
 return `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse"><g fill="none" stroke="#fff6db" stroke-width=".7" opacity=".35">${strokes}</g></pattern>`;
}

function scenery(habitat:ReturnType<typeof projectWildsCardArtHabitat>,genome:LivingCardGenome,id:string){
 const seed=habitat.seed,glow=color(genome.palette.glow),canopy=color(habitat.canopy),ground=color(habitat.ground);
 const trees=Array.from({length:8},(_,i)=>{const side=i<4?-1:1;
  const px=side<0?unit(seed,i)*125:435+unit(seed,i)*125,height=160+unit(seed,i+20)*180,width=22+unit(seed,i+80)*24;
  return `<g opacity="${(.22+unit(seed,i+40)*.22).toFixed(2)}"><path d="M${px} 385L${px-width*.2} ${385-height*.55} ${px+width*.2} ${385-height*.55} ${px+width*.5} 385Z" fill="${canopy}"/><path d="M${px} ${385-height}q${-width*1.9} ${height*.34} ${-width*1.5} ${height*.6}q${width*1.5} 34 ${width*3} 0q${width*.4} ${-height*.26} ${-width*1.5} ${-height*.6}Z" fill="${canopy}"/></g>`;
 }).join('');
 const stones=Array.from({length:5},(_,i)=>{const x=20+unit(seed,i+100)*520,y=357+unit(seed,i+140)*57,r=8+unit(seed,i+200)*18;return `<path d="M${x-r} ${y}l${r*.3} ${-r} ${r} ${-r*.3} ${r} ${r*.8} ${-r*.3} ${r*.6}Z" fill="${ground}" stroke="#b1c6b3" stroke-opacity=".15"/>`;}).join('');
 const leaves=Array.from({length:18},(_,i)=>{const left=i<9,x=left?unit(seed,i+90)*133:427+unit(seed,i+90)*133,y=365+unit(seed,i+101)*65,r=9+unit(seed,i+123)*20;
  return `<path d="M${x} ${y}q${-r*1.3} ${-r*1.8} ${r*.4} ${-r*2.3}q${r} ${r*.6} ${-r*.4} ${r*2.3}Z" fill="${i%3===0?glow:ground}" opacity="${i%3===0?'.42':'.75'}" transform="rotate(${(unit(seed,i+44)-.5)*100} ${x} ${y})"/>`;
 }).join('');
 const flowers=Array.from({length:10},(_,i)=>{const x=i<5?25+unit(seed,i+221)*104:431+unit(seed,i+221)*104,y=371+unit(seed,i+281)*45;return `<g transform="translate(${x} ${y})"><path d="M0 12v-12" stroke="${ground}" stroke-width="2"/><g fill="${glow}" opacity=".65"><ellipse cy="-3" rx="2.5" ry="4"/><ellipse cy="-3" rx="2.5" ry="4" transform="rotate(72)"/><ellipse cy="-3" rx="2.5" ry="4" transform="rotate(144)"/><ellipse cy="-3" rx="2.5" ry="4" transform="rotate(216)"/><ellipse cy="-3" rx="2.5" ry="4" transform="rotate(288)"/></g><circle r="2" fill="#fff3cb"/></g>`;}).join('');
 const sparks=Array.from({length:20},(_,i)=>{const x=35+unit(seed,i+301)*490,y=30+unit(seed,i+341)*330;return `<circle cx="${x}" cy="${y}" r="${.7+unit(seed,i+380)*1.5}" fill="${glow}" opacity="${.15+unit(seed,i+400)*.6}"/>`;}).join('');
 const water=habitat.water?`<path d="M0 340Q145 314 280 344T560 340V440H0Z" fill="#163f4c"/><g fill="none" stroke="${glow}" stroke-opacity=".2">${[354,369,394,411].map(y=>`<path d="M15 ${y}q100-8 200 0m65 3q130-9 260-1"/>`).join('')}</g>`:'';
 const landmark=habitat.landmark==='root-arch'?`<path d="M-16 348Q8 32 174 80M576 348Q552 32 386 80" fill="none" stroke="${canopy}" stroke-width="26" opacity=".65"/>`:'';
 return {back:`<rect width="560" height="440" fill="url(#${id}-sky)"/><circle cx="${160+unit(seed,420)*240}" cy="102" r="86" fill="url(#${id}-light)"/><path d="M0 264Q${50+unit(seed,421)*60} 168 204 271T560 250V440H0Z" fill="${canopy}" opacity=".3"/><path d="M0 325Q110 243 256 314T560 290V440H0Z" fill="${ground}" opacity=".27"/>${trees}${landmark}<path d="M0 373Q155 320 280 369T560 353V440H0Z" fill="${ground}" opacity=".42"/>${water}${habitat.rock?stones:''}<ellipse cx="280" cy="404" rx="133" ry="18" fill="#030d10" opacity=".4"/>${sparks}`,front:`${leaves}${flowers}<rect width="560" height="440" fill="url(#${id}-vignette)"/>`};
}

/** Presentation edition only. The original proof renderer and its historical
 * digest law stay intact. Geometry is the existing genome/earned-level view. */
export function renderWildsCollectibleArt(asset:PortableCardAsset,options:Readonly<{width:number;height:number;pose?:HeartboundPose;habitat?:boolean}>){
 const genome=isLivingCardAsset(asset)?currentLivingGenome(asset):deriveBirthGenome({formId:asset.manifest.formId,proofDigest:asset.proof.digest,variant:asset.manifest.variant.traits}),growth=projectCardCreatureLevelAppearance(asset);
 const seed=genome.identityAnchor,id=`wca-${sha256PortableBasis(`${seed}:${growth.level}:${options.pose??'card'}`).slice(7,23)}`;
 const original=renderHeartboundSvg(genome,options.pose??'card',{width:options.width,height:options.height,title:asset.manifest.name,fit:'full-body',levelAppearance:growth});
 const habitat=projectWildsCardArtHabitat(asset,genome),scene=scenery(habitat,genome,id),p=genome.palette;
 const gradients=Object.entries(p).sort(([a],[b])=>a.localeCompare(b)).map(([key,c])=>`<radialGradient id="${id}-${key}" cx=".32" cy=".24" r=".9"><stop stop-color="#fff6dc"/><stop offset=".12" stop-color="${xml(color(c))}"/><stop offset=".55" stop-color="${xml(color(c))}"/><stop offset="1" stop-color="#0b1c25"/></radialGradient>`).join('');
 let body=original.slice(original.indexOf('>')+1,original.lastIndexOf('</svg>'));
 // Shade the authored anatomy and add surface-specific texture inside its paths.
 body=body.replace(/<path\b[^>]*\/>/g,path=>{
  const primary=path.includes(`fill="${p.primary}"`),painted=Object.entries(p).sort(([a],[b])=>a.localeCompare(b)).reduce((markup,[key,c])=>markup.replaceAll(`fill="${c}"`,`fill="url(#${id}-${key})"`),path);
  if(!primary)return painted;
  const grain=path.replace(/fill="[^"]*"/,`fill="url(#${id}-texture)"`).replace(/stroke="[^"]*"/g,'stroke="none"').replace(/opacity="[^"]*"/g,'');
  return `${painted}<g opacity=".24">${grain}</g>`;
 });
 // Scenery covers the portrait viewport; anatomy retains the proof renderer's
 // centered full-body fit. Keep the paints shared outside all three layers.
 const viewport=(layer:string,markup:string,fit:'slice'|'meet')=>`<svg data-art-layer="${layer}" width="${options.width}" height="${options.height}" viewBox="0 0 560 440" preserveAspectRatio="xMidYMid ${fit}">${markup}</svg>`;
 const root=original.slice(0,original.indexOf('>')).replace('viewBox="0 0 560 440"',`viewBox="0 0 ${options.width} ${options.height}"`).replace('data-heartbound=',`data-art-edition="${WILDS_COLLECTIBLE_ART_EDITION}" data-habitat-source="${habitat.source}" data-habitat-region="${xml(habitat.region)}" data-art-identity="${xml(seed)}" data-heartbound=`);
 return root+`><defs>${gradients}${texture(genome.surface.kind,`${id}-texture`,seed)}<radialGradient id="${id}-sky" cx=".5" cy=".32" r=".8"><stop stop-color="${xml(color(p.secondary))}" stop-opacity=".6"/><stop offset=".5" stop-color="#173e3c"/><stop offset="1" stop-color="#071722"/></radialGradient><radialGradient id="${id}-light"><stop stop-color="${xml(color(p.glow))}" stop-opacity=".25"/><stop offset="1" stop-color="${xml(color(p.glow))}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-vignette"><stop offset=".6" stop-color="#031013" stop-opacity="0"/><stop offset="1" stop-color="#031013" stop-opacity=".5"/></radialGradient></defs>${options.habitat===false?'':viewport('habitat-back',scene.back,'slice')}${viewport('creature',body,'meet')}${options.habitat===false?'':viewport('habitat-front',scene.front,'slice')}</svg>`;
}
