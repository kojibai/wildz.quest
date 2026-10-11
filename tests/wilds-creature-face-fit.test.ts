import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createWildsCreatureFace, fallbackWildsCreatureFace } from '../src/features/play/wilds-creature-face.js';
const base = fallbackWildsCreatureFace('fit-regression', 'spriggle');
function skullDepth(g: THREE.BufferGeometry, x: number, y: number) {
  const p=g.getAttribute('position'), ix=g.index!;
  const ray=new THREE.Ray(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
  let z=-Infinity;
  for(let i=0;i<20*26*3;i+=3) {
    a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));
    if(ray.intersectTriangle(a,b,c,false,hit)) z=Math.max(z,hit.z);
  }
  return z;
}
for(const head of ['round','broad','tapered','heart','long'] as const) {
  test(`${head}: ocular perimeter stays inside actual skull through blink`,()=>{
    const face={...base,geometry:{...base.geometry,head,cheek:.82,jaw:.82,forehead:.84,muzzle:.72,eyeSize:1.18,eyeSpacing:1.16,eyeHeight:1.1,eyeTilt:8}};
    const g=createWildsCreatureFace(face,'#88bb77','#ccdd55','#337766','fit-regression');
    const p=g.getAttribute('position'),closed=g.getAttribute('faceClosed'),ocular=g.getAttribute('faceOcular');
    for(const t of [0,.25,.5,.75,1])for(let i=0;i<p.count;i++)if(ocular.getX(i)) {
      const x=THREE.MathUtils.lerp(p.getX(i),closed.getX(i),t),y=THREE.MathUtils.lerp(p.getY(i),closed.getY(i),t),z=THREE.MathUtils.lerp(p.getZ(i),closed.getZ(i),t);
      const skull=skullDepth(g,x,y);
      assert.ok(Number.isFinite(skull),`ocular outside skull at ${x},${y}, blink ${t}`);
      assert.ok(z-skull<.025,`ocular relief ${z-skull} exceeds inset relief at blink ${t}`);
    }
    assert.ok(g.index!.count/3<1808);g.dispose();
  });
}
test('mouth opening has readable front-facing area',()=>{
  const g=createWildsCreatureFace(base,'#88bb77','#ccdd55','#337766','fit-regression');
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true}));mesh.updateMatrixWorld();
  let darkHits=0;
  for(let x=-.025;x<=.025;x+=.005)for(let y=-.155;y<=-.10;y+=.0025) {
    const hit=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
    if(hit?.face) {
      const color=g.getAttribute('color'), ids=[hit.face.a,hit.face.b,hit.face.c];
      const light=ids.reduce((sum,i)=>sum+color.getX(i)+color.getY(i)+color.getZ(i),0)/9;
      if(light<.075)darkHits++;
    }
  }
  assert.ok(darkHits>=45,`mouth opening only covers ${darkHits} front-ray samples`);g.dispose();mesh.material.dispose();
});

// Connected parts are discovered from triangle topology, independent of builder offsets.
function parts(g:THREE.BufferGeometry) {
  const parent=Array.from({length:g.getAttribute('position').count},(_,i)=>i),used=new Set<number>();
  const root=(i:number):number=>parent[i]===i?i:(parent[i]=root(parent[i]));
  const ix=g.index!;
  for(let i=0;i<ix.count;i+=3){const a=ix.getX(i);for(let k=0;k<3;k++){const b=ix.getX(i+k);parent[root(b)]=root(a);used.add(b);}}
  const groups=new Map<number,number[]>();for(const i of used){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r)!.push(i);}return [...groups.values()];
}
function verifySockets(g:THREE.BufferGeometry) {
  const p=g.getAttribute('position'),c=g.getAttribute('faceClosed'),o=g.getAttribute('faceOcular');
  const lids=parts(g).filter(ids=>!o.getX(ids[0])&&ids.some(i=>Math.abs(p.getY(i)-c.getY(i))>.001));
  assert.equal(lids.length,2,'two moving skin lids');
  for(const ids of lids){
    const roots=ids.filter(i=>Math.abs(p.getY(i)-c.getY(i))+Math.abs(p.getZ(i)-c.getZ(i))<1e-6);
    assert.ok(roots.length>=16,'whole rooted socket perimeter');
    for(const i of roots){const depth=skullDepth(g,p.getX(i),p.getY(i));assert.ok(Number.isFinite(depth));assert.ok(p.getZ(i)-depth<.0001&&p.getZ(i)-depth>-.008,'socket root intersects skull');}
    // Every outer edge, not just its endpoints, must be backed by actual skull.
    const rootSet=new Set(roots),ix=g.index!;
    for(let k=0;k<ix.count;k+=3)for(let e=0;e<3;e++){
      const a=ix.getX(k+e),b=ix.getX(k+(e+1)%3);if(!rootSet.has(a)||!rootSet.has(b))continue;
      for(const t of [.25,.5,.75]){const x=THREE.MathUtils.lerp(p.getX(a),p.getX(b),t),y=THREE.MathUtils.lerp(p.getY(a),p.getY(b),t),z=THREE.MathUtils.lerp(p.getZ(a),p.getZ(b),t);assert.ok(Number.isFinite(skullDepth(g,x,y)));assert.ok(z<=skullDepth(g,x,y)+.0002,'no daylight under root edge');}
    }
  }
}

test('entire socket roots and edges overlap real skull across paired trait extremes and all mouth/eye shapes',()=>{
  for(const mouth of ['smile','muzzle','fang','beak'] as const)for(const eye of ['round','almond','star','crescent'] as const)for(const extreme of [false,true]){
    const face={...base,mouth,eye,geometry:{...base.geometry,cheek:extreme?.82:1.24,jaw:extreme?.82:1.18,forehead:extreme?.84:1.22,muzzle:extreme?.72:1.18,eyeSpacing:extreme?1.16:.82,eyeSize:extreme?1.18:.86,eyeHeight:extreme?1.1:.9,eyeTilt:extreme?8:-8}};
    const g=createWildsCreatureFace(face,'#283047','#ccdd55','#337766','paired-extreme');verifySockets(g);
    assert.equal(g.groups.length,0);assert.ok(g.index!.count/3<1808);
    for(const name of ['position','normal','faceClosed','faceClosedNormal'])assert.ok(Array.from(g.getAttribute(name).array).every(Number.isFinite),`${mouth}/${eye} finite ${name}`);
    g.dispose();
  }
});

test('open irises and sclera are exposed; closed lids hide ocular surfaces without changing the mouth',()=>{
  const g=createWildsCreatureFace(base,'#88bb77','#ccdd55','#337766','blink-exposure');
  const p=g.getAttribute('position'),c=g.getAttribute('faceClosed'),o=g.getAttribute('faceOcular');
  const original=p.clone(),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
  for(const t of [0,.25,.5,.75,1]){
    for(let i=0;i<p.count;i++)p.setXYZ(i,THREE.MathUtils.lerp(original.getX(i),c.getX(i),t),THREE.MathUtils.lerp(original.getY(i),c.getY(i),t),THREE.MathUtils.lerp(original.getZ(i),c.getZ(i),t));
    g.computeBoundingSphere();let ocularHits=0;
    for(let x=-.20;x<=.20;x+=.004)for(let y=-.02;y<=.10;y+=.004){
      const hit=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
      if(hit?.face&&o.getX(hit.face.a))ocularHits++;
    }
    assert.ok(t===1?ocularHits===0:ocularHits>15,`blink ${t}: ${ocularHits} ocular rays`);
    for(let i=0;i<p.count;i++)if(original.getY(i)<-.09)assert.equal(p.getZ(i),original.getZ(i),'mouth unchanged by blink');
  }
  g.dispose();mesh.material.dispose();
});

test('legacy malformed eye-height remains bounded without changing the semantic face',()=>{
  for(const eyeHeight of [0,99,NaN,Infinity]){
    const face={...base,geometry:{...base.geometry,eyeHeight}};
    const g=createWildsCreatureFace(face,'#88bb77','#ccdd55','#337766','legacy');
    assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));verifySockets(g);assert.ok(Object.is(face.geometry.eyeHeight,eyeHeight));g.dispose();
  }
});

test('every catalog stage and body retains deterministic fitted faces, finite normals and budget',async()=>{
  const {creatureForms}=await import('../src/features/play/creature-catalog.js');
  const bodies=new Set<string>(),mouths=new Set<string>();
  for(const [i,form] of creatureForms.entries()){
    bodies.add(form.anatomy.body);
    const mouth=(['smile','muzzle','fang','beak'] as const)[i%4];mouths.add(mouth);
    const face={...fallbackWildsCreatureFace(form.id,form.familyId),mouth};
    const before=JSON.stringify(face),g=createWildsCreatureFace(face,form.palette.primary,form.palette.accent,form.palette.glow,form.id);
    verifySockets(g);assert.ok(g.index!.count/3<1808,form.id);assert.equal(g.groups.length,0);
    for(const name of ['position','normal','faceClosed','faceClosedNormal'])assert.ok(Array.from(g.getAttribute(name).array).every(Number.isFinite),`${form.id} ${name}`);
    const reopened=createWildsCreatureFace(face,form.palette.primary,form.palette.accent,form.palette.glow,form.id);
    assert.deepEqual(g.getAttribute('position').array,reopened.getAttribute('position').array);assert.equal(JSON.stringify(face),before);
    g.dispose();reopened.dispose();
  }
  assert.equal(bodies.size,5);assert.equal(mouths.size,4);
});

test('all mouth variants expose their opening to front and default oblique view rays',()=>{
  for(const mouth of ['smile','muzzle','fang','beak'] as const){
    const g=createWildsCreatureFace({...base,mouth},'#88bb77','#ccdd55','#337766','mouth-rays'),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
    for(const direction of [new THREE.Vector3(0,0,1),new THREE.Vector3(.48,.35,.8).normalize(),new THREE.Vector3(-.48,.35,.8).normalize()]){
      let visible=0;
      for(let x=-.025;x<=.025;x+=.005)for(let dy=-.008;dy<=.008;dy+=.004){
        const y=(mouth==='beak'?-.055:-.121)+dy,z=skullDepth(g,x,y)+(mouth==='beak'?.06:.005);
        const target=new THREE.Vector3(x,y,z),hit=new THREE.Raycaster(target.clone().add(direction),direction.clone().negate()).intersectObject(mesh)[0];
        if(hit?.face){const c=g.getAttribute('color');if([hit.face.a,hit.face.b,hit.face.c].every(i=>(c.getX(i)+c.getY(i)+c.getZ(i))/3<.075))visible++;}
      }
      assert.ok(visible>=6,`${mouth} ${direction.toArray()}: only ${visible} opening rays`);
    }g.dispose();mesh.material.dispose();
  }
});

test('mouth pigment bypasses dark skin texture without becoming ocular or changing its blink pose',()=>{
  const g=createWildsCreatureFace(base,'#283047','#ccdd55','#337766','dark-pigment');
  const p=g.getAttribute('position'),c=g.getAttribute('faceClosed'),o=g.getAttribute('faceOcular'),pigment=g.getAttribute('faceUntextured');
  assert.ok(pigment,'independent pigment mask');let mouthVertices=0;
  for(let i=0;i<p.count;i++){
    if(o.getX(i))assert.equal(pigment.getX(i),1,'ocular bypass preserved');
    else if(pigment.getX(i)){mouthVertices++;assert.ok(p.getY(i)<-.075,'only mouth pigment opts in');assert.deepEqual([p.getX(i),p.getY(i),p.getZ(i)],[c.getX(i),c.getY(i),c.getZ(i)]);}
  }
  assert.ok(mouthVertices>40);g.dispose();
});

test('explorer texture bypass still equals its ocular mask on the negative-z face',async()=>{
  const {createWildsExplorerFace}=await import('../src/features/play/wilds-explorer-face.js');
  const {projectWildsExplorerAnatomy}=await import('../src/features/play/wilds-explorer-anatomy.js');
  for(const remote of [false,true]){
    const g=createWildsExplorerFace(projectWildsExplorerAnatomy('texture-regression'),'#aa8855','#332211',remote);
    assert.deepEqual(g.getAttribute('faceUntextured').array,g.getAttribute('faceOcular').array);
    g.dispose();
  }
});
