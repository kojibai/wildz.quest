import * as THREE from "three";
import { deriveHeartboundIdentity } from "./heartbound-identity";
import { sha256PortableBasis } from "./portable-card";
import type { CreatureVisualFace } from "./creature-visual-identity";
import { WildsFaceGeometryBuilder, addWildsFaceEye } from "./wilds-face-geometry";
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
  add(head,(x,y,z)=>{
    const cheek=z>.1?Math.exp(-Math.pow((Math.abs(x)-.15)/.085,2)-Math.pow((y+.04)/.06,2)):0;
    const stripe=z>.12&&y>.11?Math.exp(-Math.pow((x-(seed-.5)*.04)/.045,2)):0;
    return tint.clone().lerp(marking,cheek*.2+stripe*.26);
  });
  const eyeWidth=.06*f.eyeSize,eyeHeight=eyeWidth*(face.eye==="almond"?.59:face.eye==="crescent"?.5:.78)*f.eyeHeight;
  for(const side of [-1,1]) {
    const x=side*.125*f.eyeSpacing,y=.045+(side*(seed-.5)*.009);
    addWildsFaceEye(builder,{center:[x,y,.211],width:eyeWidth,height:eyeHeight,depth:.025,tilt:side*f.eyeTilt*Math.PI/180,skin:primary,iris,seed:seed+side*.11,segments:16,pupil:f.pupil,highlight:f.highlight,lidFold:.005});
    const browY=y+eyeHeight*1.5,tilt=f.brow==="heroic"?-.013:f.brow==="curious"?.016:f.brow==="mischievous"?side*.013:0;
    const brow=new THREE.CatmullRomCurve3([new THREE.Vector3(x-eyeWidth*.8,browY-tilt,.191),new THREE.Vector3(x,browY+.012,.206),new THREE.Vector3(x+eyeWidth*.8,browY+tilt,.19)]);
    add(new THREE.TubeGeometry(brow,5,.004,3,false),tint.clone().multiplyScalar(.58).getStyle());
  }
  if(face.mouth==="beak") {
    const beak=new THREE.ConeGeometry(.041,.085,8);beak.rotateX(Math.PI/2);
    add(beak,accent,[0,-.055,.247],[1,.72,1]);
  } else {
    add(new THREE.SphereGeometry(1,8,6),(x,y)=>tint.clone().multiplyScalar(.3+Math.max(0,y+.055)*2),[0,-.055,.244],[.035*f.muzzle,.027,.025]);
  }
  const beaked=face.mouth==="beak",smiling=face.mouth==="smile";
  const mouthWidth=(beaked?.034:face.mouth==="muzzle"?.062:.052)*f.muzzle;
  const mouthY=beaked?-.067:-.121;
  const mouth=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-mouthWidth,mouthY+(smiling?.015:.003),beaked?.254:.221),
    new THREE.Vector3(0,mouthY-(smiling?.009:.002),beaked?.285:.239),
    new THREE.Vector3(mouthWidth,mouthY+(smiling?.015:.003),beaked?.254:.221)
  ]);
  add(new THREE.TubeGeometry(mouth,8,.0055,4,false),tint.clone().lerp(new THREE.Color("#682e38"),.65).getStyle());
  if(face.mouth==="fang") for(const side of [-1,1]) {
    const fang=new THREE.ConeGeometry(.008,.023,5);fang.rotateZ(Math.PI);
    add(fang,"#eee7d4",[side*mouthWidth*.7,mouthY-.002,.235]);
  }
  return builder.finish();
}
