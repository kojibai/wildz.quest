import * as THREE from "three";
import type {WildsExplorerAnatomy} from "./wilds-explorer-anatomy";
import { WildsFaceGeometryBuilder, addWildsFaceEye } from "./wilds-face-geometry";

/** Face, eyes, lips, brows and ears share one vertex-colored mesh and one material. */
export function createWildsExplorerFace(anatomy:WildsExplorerAnatomy,skin:string,hair:string,remote=false) {
  const builder = new WildsFaceGeometryBuilder();
  const add = builder.add.bind(builder);
  const detail = anatomy.detail;
  const skinTint = new THREE.Color(skin), warmTint = new THREE.Color("#a86959");
  const head=new THREE.SphereGeometry(.225,remote?16:24,remote?12:20),positions=head.getAttribute("position");
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),jaw=THREE.MathUtils.smoothstep(-y,0,.225);
    const cheek = Math.exp(-Math.pow((Math.abs(x)-.11)/.07,2)-Math.pow((y-detail.cheekHeight+.065)/.08,2));
    const chin = Math.exp(-Math.pow(x/.085,2)-Math.pow((y+.17)/.05,2));
    const temple = y > .06 ? THREE.MathUtils.lerp(1,detail.temple,THREE.MathUtils.smoothstep(y,.06,.18)) : 1;
    positions.setXYZ(i,x*(anatomy.cheek*(1-jaw)+anatomy.jaw*jaw)*temple,y*anatomy.faceHeight,z*detail.depth-(z<0?cheek*.009+chin*detail.chin:0));
  }
  head.computeVertexNormals();
  add(head,(x,y,z)=>{
    const cheeks = z < -.08 ? Math.exp(-Math.pow((Math.abs(x)-.11)/.055,2)-Math.pow((y+.045)/.065,2)) : 0;
    return skinTint.clone().lerp(warmTint,cheeks*.14).multiplyScalar(1+Math.sin(x*75+y*59)*detail.skinVariation);
  });
  const lip=new THREE.Color(skin).lerp(new THREE.Color("#9f4e4a"),.28).getStyle();
  for(const side of [-1,1]) {
    const eyeY = .018 + side * detail.asymmetry;
    add(new THREE.SphereGeometry(anatomy.earSize,8,6),(x,y,z)=>skinTint.clone().lerp(warmTint,z<.01&&Math.abs(y+.02)<.027?.23:0),[side*.217,-.02,.01],[.7,1.35,.65+detail.earAngle]);
    addWildsFaceEye(builder, {center:[side*anatomy.eyeSpacing,eyeY,-.205],width:anatomy.eyeSize,height:anatomy.eyeSize*detail.eyeHeight,depth:-.012,tilt:side*detail.eyeTilt,skin,iris:anatomy.iris,seed:detail.irisSeed+side*.07,segments:remote?12:16,lidFold:remote?undefined:detail.lidFold});
    const brow=new THREE.CatmullRomCurve3([new THREE.Vector3(side*(anatomy.eyeSpacing-.032),.062,-.188),new THREE.Vector3(side*anatomy.eyeSpacing,.071+anatomy.browTilt*.04,-.201),new THREE.Vector3(side*(anatomy.eyeSpacing+.035),.06,-.18)]);
    add(new THREE.TubeGeometry(brow,6,.006,3,false),hair,[0,0,0]);
    add(new THREE.SphereGeometry(.006,6,4),"#573a30",[side*anatomy.noseWidth*.62,-.047,-.214-anatomy.noseLength*.35],[1,.4,.5]);
  }
  add(new THREE.SphereGeometry(1,10,8),skin,[0,-.006,-.2],[anatomy.noseWidth*.55*detail.noseBridge,.054,anatomy.noseLength*.8]);
  add(new THREE.SphereGeometry(1,10,6),skin,[0,-.04,-.213],[anatomy.noseWidth,.02,anatomy.noseLength*.67*detail.noseTip]);
  const upperLip = new THREE.SphereGeometry(1,10,5),lipPositions=upperLip.getAttribute("position");
  for(let i=0;i<lipPositions.count;i++) {
    const x = lipPositions.getX(i);
    lipPositions.setY(i,lipPositions.getY(i)-Math.exp(-Math.pow(x/.2,2))*detail.cupidBow/anatomy.lipFullness);
  }
  add(upperLip,lip,[0,-.098,-.184],[anatomy.mouthWidth,anatomy.lipFullness,.013]);
  add(new THREE.SphereGeometry(1,10,5),lip,[0,-.115,-.18],[anatomy.mouthWidth*.92,anatomy.lipFullness*detail.lowerLip,.014]);
  const mouth=new THREE.CatmullRomCurve3([new THREE.Vector3(-anatomy.mouthWidth,-.106,-.19),new THREE.Vector3(0,-.108,-.199),new THREE.Vector3(anatomy.mouthWidth,-.106,-.19)]);
  add(new THREE.TubeGeometry(mouth,6,.0018,3,false),new THREE.Color(lip).multiplyScalar(.55).getStyle());
  if(anatomy.freckles&&!remote)for(let i=0;i<6;i++) {
    const side=i%2?1:-1;
    add(new THREE.SphereGeometry(.002,4,3),"#81513b",[side*(.08+(i%4)*.012),-.025-(i%3)*.01,-.205+(i%4)*.005],[1,1,.2]);
  }
  return builder.finish();
}

export function createWildsExplorerTorso(anatomy:WildsExplorerAnatomy) {
  const rings=[new THREE.Vector2(.17*anatomy.waist,-.25),new THREE.Vector2(.18*anatomy.waist,-.18),new THREE.Vector2(.2,-.05),new THREE.Vector2(.265*anatomy.shoulders,.16),new THREE.Vector2(.27*anatomy.shoulders,.23),new THREE.Vector2(.19,.3),new THREE.Vector2(.085,.34),new THREE.Vector2(.08,.39)];
  const geometry=new THREE.LatheGeometry(rings,16);geometry.scale(1,1,.72);return geometry;
}
