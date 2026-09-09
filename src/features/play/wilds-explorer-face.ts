import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import type {WildsExplorerAnatomy} from "./wilds-explorer-anatomy";

/** Face, eyes, lips, brows and ears share one vertex-colored mesh and one material. */
export function createWildsExplorerFace(anatomy:WildsExplorerAnatomy,skin:string,hair:string,remote=false) {
  const parts:THREE.BufferGeometry[]=[];
  const add=(geometry:THREE.BufferGeometry,color:string,position:[number,number,number],scale:[number,number,number]=[1,1,1])=>{
    geometry.scale(...scale);geometry.translate(...position);
    const tint=new THREE.Color(color),colors=new Float32Array(geometry.getAttribute("position").count*3);
    for(let i=0;i<colors.length;i+=3)colors.set(tint.toArray(),i);
    geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));parts.push(geometry);
  };
  const head=new THREE.SphereGeometry(.225,remote?16:24,remote?12:20),positions=head.getAttribute("position");
  for(let i=0;i<positions.count;i++){
    const y=positions.getY(i),jaw=THREE.MathUtils.smoothstep(-y,0,.225);
    positions.setXYZ(i,positions.getX(i)*(anatomy.cheek*(1-jaw)+anatomy.jaw*jaw),y*anatomy.faceHeight,positions.getZ(i)*.92);
  }
  head.computeVertexNormals();add(head,skin,[0,0,0]);
  const lip=new THREE.Color(skin).lerp(new THREE.Color("#9f4e4a"),.28).getStyle();
  for(const side of [-1,1]) {
    add(new THREE.SphereGeometry(anatomy.earSize,8,6),skin,[side*.217,-.02,.01],[.7,1.35,.65]);
    add(new THREE.SphereGeometry(anatomy.eyeSize,10,8),"#e8e3d9",[side*anatomy.eyeSpacing,.018,-.196],[1,.62,.52]);
    add(new THREE.SphereGeometry(anatomy.eyeSize*.53,8,6),anatomy.iris,[side*anatomy.eyeSpacing,.018,-.211],[1,1,.23]);
    add(new THREE.SphereGeometry(anatomy.eyeSize*.26,7,5),"#181b1b",[side*anatomy.eyeSpacing,.018,-.216],[1,1,.2]);
    add(new THREE.SphereGeometry(.004,5,4),"#ffffff",[side*anatomy.eyeSpacing-.005,.024,-.219]);
    const brow=new THREE.CatmullRomCurve3([new THREE.Vector3(side*(anatomy.eyeSpacing-.032),.062,-.188),new THREE.Vector3(side*anatomy.eyeSpacing,.071+anatomy.browTilt*.04,-.201),new THREE.Vector3(side*(anatomy.eyeSpacing+.035),.06,-.18)]);
    add(new THREE.TubeGeometry(brow,6,.006,3,false),hair,[0,0,0]);
    add(new THREE.SphereGeometry(.007,6,4),"#4a3028",[side*anatomy.noseWidth*.62,-.048,-.213-anatomy.noseLength*.35],[1,.45,.6]);
  }
  add(new THREE.SphereGeometry(1,10,8),skin,[0,-.014,-.205],[anatomy.noseWidth*.68,.049,anatomy.noseLength]);
  add(new THREE.SphereGeometry(1,10,8),skin,[0,-.044,-.21],[anatomy.noseWidth,.019,anatomy.noseLength*.8]);
  add(new THREE.SphereGeometry(1,12,6),lip,[0,-.098,-.185],[anatomy.mouthWidth,anatomy.lipFullness,.016]);
  add(new THREE.SphereGeometry(1,12,6),lip,[0,-.115,-.18],[anatomy.mouthWidth*.88,anatomy.lipFullness*.85,.014]);
  if(anatomy.freckles&&!remote)for(let i=0;i<8;i++) {
    const side=i%2?1:-1;
    add(new THREE.SphereGeometry(.0025,4,3),"#81513b",[side*(.08+(i%4)*.012),-.025-(i%3)*.01,-.197+(i%4)*.005]);
  }
  const merged=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());merged.computeBoundingSphere();return merged;
}

export function createWildsExplorerTorso(anatomy:WildsExplorerAnatomy) {
  const rings=[new THREE.Vector2(.17*anatomy.waist,-.25),new THREE.Vector2(.18*anatomy.waist,-.18),new THREE.Vector2(.2,-.05),new THREE.Vector2(.265*anatomy.shoulders,.16),new THREE.Vector2(.27*anatomy.shoulders,.23),new THREE.Vector2(.19,.3),new THREE.Vector2(.085,.34),new THREE.Vector2(.08,.39)];
  const geometry=new THREE.LatheGeometry(rings,16);geometry.scale(1,1,.72);return geometry;
}
