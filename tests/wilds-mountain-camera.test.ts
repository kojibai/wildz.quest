import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitWildsDiscoveryPhysicalNeighborhood } from '../src/features/play/wilds-discovery-sites';
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY, wildsSiteRuntimeDiagnostics, writeWildsMountainCameraPosition } from '../src/features/play/wilds-site-runtime';

test('mountain camera keeps the whole sightline above real admitted mountain triangles',()=>{
  const runtime=prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0,0));
  const before=wildsSiteRuntimeDiagnostics(),target={x:0,y:.9,z:0};let checked=0;
  for(const field of runtime.physical.mountainFields.slice(0,4))for(let node=0;node<field.nodes.length;node+=Math.max(1,Math.floor(field.nodes.length/9))) {
    const point=field.nodes[node]!,origin={x:point.x,y:wildsSiteRuntimeGroundY(runtime,field.spaceId,point.x,point.z,point.topY),z:point.z};
    for(let angle=0;angle<12;angle++) {
      const output={x:Math.cos(angle/12*Math.PI*2)*12,y:1.3,z:Math.sin(angle/12*Math.PI*2)*12};
      assert.equal(writeWildsMountainCameraPosition(output,runtime,field.spaceId,origin,target),output);
      for(let step=0;step<=32;step++) {
        const t=step/32,x=origin.x+output.x*t,z=origin.z+output.z*t,y=origin.y+target.y+(output.y-target.y)*t;
        const ground=wildsSiteRuntimeGroundY(runtime,field.spaceId,x,z,Number.NaN);
        if(Number.isFinite(ground))assert.ok(y>=ground+.17999,'camera and intervening view must stay outside the visible skin');
      }
      checked++;
    }
  }
  assert.ok(checked>=100);
  assert.equal(wildsSiteRuntimeDiagnostics().indexBuilds,before.indexBuilds);
  assert.equal(wildsSiteRuntimeDiagnostics().authorityBuilds,before.authorityBuilds);
});

test('camera terrain protection leaves clear, flat, high flight and interior views unchanged',()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0),runtime=prepareWildsSiteRuntime(physical);
  for(const [spaceId,origin,desired] of [
    ['wildz.space.outer.v1',{x:1e5,y:0,z:1e5},{x:.45,y:.9,z:0}],
    ['wildz.space.outer.v1',{x:0,y:1e5,z:0},{x:6,y:3,z:6}],
    ['interior:test',{x:0,y:0,z:0},{x:6,y:1,z:0}]
  ] as const) {
    const output={...desired};writeWildsMountainCameraPosition(output,runtime,spaceId,origin,{x:0,y:.9,z:0});assert.deepEqual(output,desired);
  }
  const empty=prepareWildsSiteRuntime({...physical,mountainFields:[]}),output={x:6,y:1,z:0};
  writeWildsMountainCameraPosition(output,empty,'wildz.space.outer.v1',{x:0,y:0,z:0},{x:0,y:.9,z:0});assert.deepEqual(output,{x:6,y:1,z:0});
});
