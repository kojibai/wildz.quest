import type { CreationNode, CreationPoint, CreationPose } from './types';
import type { CreationSolid, CreationSurface } from './geometry';
/** Fixed tessellation and conservative collision proxies: visual quality never alters construction costs. */
export function deriveCreationCurvedGeometry(node:CreationNode,pose:CreationPose){
  const {width:w,height:h,depth:d,kind}=node.shape,a=w/2,b=h/2,c=d/2;
  const segments=24,rings=12,positions:number[]=[],normals:number[]=[];
  const cos=Math.cos(pose.yaw),sin=Math.sin(pose.yaw);
  type Vertex={p:CreationPoint;n:CreationPoint};
  const vertex=(p:CreationPoint,n:CreationPoint):Vertex=>{const len=Math.hypot(n.x,n.y,n.z);return {
    p:{x:pose.position.x+p.x*cos+p.z*sin,y:pose.position.y+p.y+b,z:pose.position.z-p.x*sin+p.z*cos},
    n:{x:(n.x*cos+n.z*sin)/len,y:n.y/len,z:(-n.x*sin+n.z*cos)/len}
  };};
  const triangle=(a:Vertex,b:Vertex,c:Vertex)=>{
    const u={x:b.p.x-a.p.x,y:b.p.y-a.p.y,z:b.p.z-a.p.z},v={x:c.p.x-a.p.x,y:c.p.y-a.p.y,z:c.p.z-a.p.z};
    const cross={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
    const vertices=cross.x*a.n.x+cross.y*a.n.y+cross.z*a.n.z>0?[a,b,c]:[a,c,b];
    vertices.forEach(({p,n})=>{positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);});
  };
  if(kind==='cylinder'){
    const side=(angle:number,y:number)=>vertex({x:a*Math.cos(angle),y,z:c*Math.sin(angle)},{x:Math.cos(angle)/a,y:0,z:Math.sin(angle)/c});
    for(let i=0;i<segments;i++){
      const angle=i*Math.PI*2/segments,next=(i+1)*Math.PI*2/segments;
      const low=side(angle,-b),lowNext=side(next,-b),high=side(angle,b),highNext=side(next,b);
      triangle(low,lowNext,high);triangle(lowNext,highNext,high);
      for(const sign of [-1,1]){
        const n={x:0,y:sign,z:0};
        triangle(vertex({x:0,y:sign*b,z:0},n),vertex({x:a*Math.cos(angle),y:sign*b,z:c*Math.sin(angle)},n),vertex({x:a*Math.cos(next),y:sign*b,z:c*Math.sin(next)},n));
      }
    }
  }else{
    const surface=(latitude:number,longitude:number)=>{const p={x:a*Math.sin(latitude)*Math.cos(longitude),y:b*Math.cos(latitude),z:c*Math.sin(latitude)*Math.sin(longitude)};return vertex(p,{x:p.x/(a*a),y:p.y/(b*b),z:p.z/(c*c)});};
    for(let r=0;r<rings;r++)for(let i=0;i<segments;i++){
      const lat=r*Math.PI/rings,nextLat=(r+1)*Math.PI/rings,angle=i*Math.PI*2/segments,next=(i+1)*Math.PI*2/segments;
      const a=surface(lat,angle),b=surface(lat,next),c=surface(nextLat,angle),d=surface(nextLat,next);
      if(r>0)triangle(a,b,c);if(r<rings-1)triangle(b,d,c);
    }
  }
  const solid:CreationSolid={id:node.id+':body',center:{x:pose.position.x,y:pose.position.y+b,z:pose.position.z},halfExtents:{x:a,y:b,z:c},yaw:pose.yaw};
  // A rounded top never advertises a floating rectangular floor. Cylinder landings fit inside the ellipse.
  const walkable:CreationSurface[]=kind==='cylinder'?[{...solid,id:node.id+':top',center:{...solid.center,y:pose.position.y+h},halfExtents:{x:a/Math.SQRT2,y:0,z:c/Math.SQRT2}}]:[];
  return {solids:[solid],walkable,interiors:[],connections:[],positions,normals,volume:kind==='cylinder'?Math.PI*a*c*h:4/3*Math.PI*a*b*c};
}
