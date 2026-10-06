import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveCreationGeometry } from '../src/features/play/creation/geometry';
import { compileCreation, verifyCreationPlan } from '../src/features/play/creation/compiler';
import { creationDefinitionFixture, creationContextFixture } from './support/creation-fixtures';
import { creationRenderUploadBytes, creationMetricUVs } from '../src/features/play/creation/render-geometry';
for(const kind of ['cylinder','ellipsoid'] as const)test(kind+' has outward curved normals, analytic cost and a conservative collider',()=>{
  const base=creationDefinitionFixture().nodes[0];
  const node={...base,shape:{kind,width:2,height:3,depth:4}};
  const geometry=deriveCreationGeometry(node,{position:{x:0,y:0,z:0},yaw:0});
  assert.ok(geometry.positions.length>108);
  assert.equal(geometry.solids.length,1);
  assert.ok(Math.abs(geometry.volume-(kind==='cylinder'?6*Math.PI:4*Math.PI))<1e-9);
  for(let i=0;i<geometry.positions.length;i+=3){
    const [x,y,z]=geometry.positions.slice(i,i+3),[nx,ny,nz]=geometry.normals.slice(i,i+3);
    assert.ok(Math.abs(x)<=1.000001&&y>=-.000001&&y<=3.000001&&Math.abs(z)<=2.000001);
    assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-6);
    assert.ok(x*nx+(y-1.5)*ny+z*nz>0);
  }
  for(let i=0;i<geometry.positions.length;i+=9){
    const p=geometry.positions.slice(i,i+9),u=[p[3]-p[0],p[4]-p[1],p[5]-p[2]],v=[p[6]-p[0],p[7]-p[1],p[8]-p[2]];
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(Math.hypot(...cross)>1e-8);
    assert.ok(cross.reduce((sum,n,j)=>sum+n*geometry.normals[i+j],0)>0);
  }
  const uv=creationMetricUVs(new Float32Array(geometry.positions),new Float32Array(geometry.normals));
  for(let i=0;i<uv.length;i+=6){
    const area=(uv[i+2]-uv[i])*(uv[i+5]-uv[i+1])-(uv[i+4]-uv[i])*(uv[i+3]-uv[i+1]);
    assert.ok(Math.abs(area)>1e-8);
  }
  if(kind==='ellipsoid')assert.equal(geometry.walkable.length,0);
  else assert.ok(geometry.walkable[0].halfExtents.x**2+geometry.walkable[0].halfExtents.z**2/4<=1.000001);
  const definition=creationDefinitionFixture({nodes:[node]});
  const result=compileCreation(definition,creationContextFixture());
  assert.equal(result.status,'ready');
  if(result.status==='ready'){
    assert.ok(verifyCreationPlan(result.plan));
    assert.deepEqual(result,compileCreation(definition,creationContextFixture()));
    assert.ok(result.plan.chunks.every(c=>creationRenderUploadBytes(c)<=98304));
    assert.equal(result.plan.requiredResources.timber,Math.ceil(geometry.volume));
  }
});
