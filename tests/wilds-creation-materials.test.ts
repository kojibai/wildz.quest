import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Texture, SRGBColorSpace, NoColorSpace, RepeatWrapping } from 'three';
import { creationMetricUVs, creationRenderUploadBytes } from '../src/features/play/creation/render-geometry';
import { createCreationMaterialLibrary } from '../src/features/play/creation/material-library';
test('metric mapping keeps metre-scale detail across wall sizes and rotations', () => {
  const positions = new Float32Array([0,0,0, 4,0,0, 4,3,0]);
  const normals = new Float32Array([0,0,1, 0,0,1, 0,0,1]);
  assert.deepEqual([...creationMetricUVs(positions,normals)], [0,0,4,0,4,3]);
  const rotated = new Float32Array([0,0,0, 0,0,-4, 0,3,-4]);
  assert.deepEqual([...creationMetricUVs(rotated,new Float32Array([1,0,0,1,0,0,1,0,0]))], [0,0,4,0,4,3]);
  assert.equal(creationRenderUploadBytes({positions,normals}), 96);
  assert.throws(()=>creationMetricUVs(positions,new Float32Array(1)), /geometry/);
});
test('materials load only when requested and reuse the same three maps across all objects', async () => {
  const requests:string[]=[];
  const library=createCreationMaterialLibrary({resolution:256,anisotropy:2,load:async url=>{requests.push(url);return new Texture();}});
  assert.equal(requests.length,0);
  const wood=library.material('timber');
  assert.equal(library.material('timber'),wood);
  assert.equal(requests.length,0);
  await Promise.all([library.load('timber'),library.load('timber')]);
  assert.equal(requests.length,3);
  assert.ok(requests.every(url=>url.startsWith('/materials/creation/')&&url.includes('256')));
  assert.equal(wood.map?.colorSpace,SRGBColorSpace);
  assert.equal(wood.normalMap?.colorSpace,NoColorSpace);
  assert.equal(wood.roughnessMap?.colorSpace,NoColorSpace);
  assert.equal(wood.map?.wrapS,RepeatWrapping);
  assert.equal(wood.map?.anisotropy,2);
  assert.equal(library.textureBytes(), 3*Math.ceil(256*256*4*4/3));
  library.dispose();
});
test('failed or late map loads retain the immediate surface and release unused textures', async () => {
  const finishes:((value:Texture)=>void)[]=[];
  const late=new Texture();let disposed=0;late.addEventListener('dispose',()=>disposed++);
  const library=createCreationMaterialLibrary({resolution:256,anisotropy:1,load:()=>new Promise<Texture>(resolve=>{finishes.push(resolve);})});
  const hay=library.material('hay');await library.load('hay');
  assert.ok(hay.map);assert.equal(finishes.length,0);
  const pending=library.load('timber');
  library.dispose();
  // All requests resolve to one test texture; disposal is still idempotent per snapshot.
  finishes.forEach(resolve=>resolve(late));
  await pending;
  assert.equal(disposed,1);
});
test('a read failure leaves the whole fallback coherent and disposes partial downloads', async () => {
  const textures:Texture[]=[];let count=0,disposed=0;
  const library=createCreationMaterialLibrary({resolution:512,anisotropy:1,load:async()=>{if(++count===2)throw Error('offline');const t=new Texture();t.addEventListener('dispose',()=>disposed++);textures.push(t);return t;}});
  const material=library.material('stone'),fallback=material.map;
  await library.load('stone');
  assert.equal(material.map,fallback);
  assert.equal(disposed,2);
  assert.equal(material.normalMap,null);
  assert.ok(library.textureBytes()<=Math.ceil(128*128*4*4/3));
  library.dispose();
});
