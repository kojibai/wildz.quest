import * as THREE from "three";
import { deriveHeartboundIdentity } from "./heartbound-identity";
import { sha256PortableBasis } from "./portable-card";
import type { CreatureVisualFace } from "./creature-visual-identity";
import { WildsFaceGeometryBuilder, addWildsFaceEye, radialPatch } from "./wilds-face-geometry";
import { createWildsFaceSurface } from "./wilds-face-surface";
import { wildsFaceUnit } from "./wilds-face-motion";

/** Catalog-only actors get stable traits; admitted actors always supply the sealed face. */
export function fallbackWildsCreatureFace(token: string, familyId: string): CreatureVisualFace {
  const identity = deriveHeartboundIdentity(sha256PortableBasis(`wildz.creature.actor-face:${token}`), {familyId,locomotion:"biped",signatureDetail:"face"});
  return {geometry:identity.faceGeometry,eye:"round",mouth:"smile",blinkMs:identity.behavior.blinkMs};
}

export function createWildsCreatureFace(face: CreatureVisualFace, primary: string, accent: string, iris: string, token: string) {
  const builder = new WildsFaceGeometryBuilder(), add = builder.add.bind(builder);
  const f = face.geometry, seed = wildsFaceUnit(token, 97);
  const tint = new THREE.Color(primary), marking = new THREE.Color(accent);
  const head = new THREE.SphereGeometry(.34,20,14), p = head.getAttribute("position");
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const jaw=THREE.MathUtils.smoothstep(-y,0,.34),top=THREE.MathUtils.smoothstep(y,0,.34);
    const tapered=f.head==="tapered"||f.head==="heart"?1-jaw*.1:f.head==="broad"?1.1:1;
    const muzzle=z>0?Math.exp(-Math.pow(x/.19,2)-Math.pow((y+.07)/.14,2))*.027*f.muzzle:0;
    p.setXYZ(i,x*.82*(f.cheek*(1-jaw)+f.jaw*jaw)*tapered,y*.72*(1+top*(f.forehead-1))*(f.head==="long"?1.1:1),z*.6+muzzle);
  }
  const surface = createWildsFaceSurface(head);
  add(head,(x,y,z)=>{
    const cheek=z>.1?Math.exp(-Math.pow((Math.abs(x)-.15)/.085,2)-Math.pow((y+.04)/.06,2)):0;
    const stripe=z>.12&&y>.11?Math.exp(-Math.pow((x-(seed-.5)*.04)/.045,2)):0;
    return tint.clone().lerp(marking,cheek*.2+stripe*.26);
  });
  // Keep each complete socket inside the actual triangle silhouette. A proportional fit
  // retains trait differences and also bounds malformed legacy eye-height values.
  const eyeWidth=.06*f.eyeSize,eyeHeight=eyeWidth*(face.eye==="almond"?.59:face.eye==="crescent"?.5:.78)*THREE.MathUtils.clamp(Number.isFinite(f.eyeHeight)?f.eyeHeight:1,.7,1.2);
  for(const side of [-1,1]) {
    const y=.045+(side*(seed-.5)*.009),tilt=side*f.eyeTilt*Math.PI/180;
    let fit=1;
    for(let attempt=0;attempt<12;attempt++) {
      let inside=true;
      for(let i=0;i<32;i++) {
        const angle=i/32*Math.PI*2,dx=Math.cos(angle)*eyeWidth*1.42*fit;
        if(!Number.isFinite(surface(side*.125*f.eyeSpacing*fit+dx,y+Math.sin(angle)*eyeHeight*1.42*fit+dx*tilt))) {inside=false;break;}
      }
      for(const dx of [-eyeWidth*.8,0,eyeWidth*.8]) if(!Number.isFinite(surface(side*.125*f.eyeSpacing*fit+dx*fit,y+eyeHeight*fit*1.5+.02)))inside=false;
      if(inside)break;
      fit*=.94;
    }
    const x=side*.125*f.eyeSpacing*fit,w=eyeWidth*fit,h=eyeHeight*fit;
    addWildsFaceEye(builder,{center:[x,y,0],width:w,height:h,depth:.009,tilt,skin:primary,iris,seed:seed+side*.11,segments:16,pupil:f.pupil,highlight:f.highlight,surface});
    const browY=y+h*1.5,browTilt=f.brow==="heroic"?-.013:f.brow==="curious"?.016:f.brow==="mischievous"?side*.013:0;
    const brow=new THREE.CatmullRomCurve3([[-w*.8,-browTilt],[0,.012],[w*.8,browTilt]].map(([dx,dy])=>new THREE.Vector3(x+dx,browY+dy,surface(x+dx,browY+dy)+.002)));
    add(new THREE.TubeGeometry(brow,5,.004,3,false),tint.clone().multiplyScalar(.58).getStyle());
  }
  let mouthSurface=surface;
  if(face.mouth==="beak") {
    const beak=new THREE.ConeGeometry(.041,.085,8);beak.rotateX(Math.PI/2);
    add(beak,accent,[0,-.055,.247],[1,.72,1]);
    const beakSurface=createWildsFaceSurface(beak);
    mouthSurface=(x,y)=>Math.max(surface(x,y),beakSurface(x,y)||-Infinity);
  } else {
    add(new THREE.SphereGeometry(1,8,6),(x,y)=>tint.clone().multiplyScalar(.3+Math.max(0,y+.055)*2),[0,-.055,surface(0,-.055)+.008],[.035*f.muzzle,.027,.025]);
  }
  const beaked=face.mouth==="beak",smiling=face.mouth==="smile";
  const mouthWidth=(beaked?.047:face.mouth==="muzzle"?.078:.066)*f.muzzle;
  const mouthY=beaked?-.055:-.121, mouthHeight=beaked?.015:.024;
  // A dark opening with a skin lip that intersects the skull around its entire root.
  // The beak split follows the existing cone's front envelope instead of the cheek.
  const mouth=radialPatch([0,.55,.78,1,1.18],32,(r,angle)=>{
    const x=Math.cos(angle)*mouthWidth*r,y=mouthY+Math.sin(angle)*mouthHeight*r+(smiling?.021*(x/mouthWidth)**2:0);
    return [x,y,mouthSurface(x,y)+(r<=.78?(beaked?.01:.006):r<=1?.008:-.003)];
  });
  const mouthTint=new THREE.Color(Math.max(tint.r,tint.g,tint.b)<.15?"#955d73":"#24131d");
  const lipTint=tint.clone().lerp(new THREE.Color("#b38e99"), Math.max(tint.r,tint.g,tint.b)<.15?.6:.24);
  add(mouth,(x,y)=>{
    const centerY=mouthY+(smiling?.021*(x/mouthWidth)**2:0);
    const r=Math.hypot(x/mouthWidth,(y-centerY)/mouthHeight);
    return r<.65?mouthTint:lipTint;
  },undefined,undefined,undefined,false,true);
  if(face.mouth==="fang") for(const side of [-1,1]) {
    const x=side*mouthWidth*.62,y=mouthY+.002;
    const fang=new THREE.ConeGeometry(.009,.026,5);fang.rotateZ(Math.PI);
    add(fang,"#eee7d4",[x,y,mouthSurface(x,y)+.012]);
  }
  return builder.finish();
}
