// Run pnpm test first to prepare the same production physics modules.
import {performance} from 'node:perf_hooks';
import {admitWildsDiscoveryPhysicalNeighborhood} from '../.test-build/src/features/play/wilds-discovery-sites.js';
import {appendWildsDiscoveryVisualSolids} from '../.test-build/src/features/play/wilds-discovery-monuments.js';
import {prepareWildsSiteRuntime,wildsSiteRuntimeDiagnostics,writeWildsSiteRuntimeCamera,writeWildsSiteRuntimeAerialCollision,writeWildsSiteRuntimeMovement} from '../.test-build/src/features/play/wilds-site-runtime.js';
const natural=admitWildsDiscoveryPhysicalNeighborhood(-3,0),varied=appendWildsDiscoveryVisualSolids(natural);
const sites=natural.sites.filter(site=>site.waterfall);
const points=sites.map(site=>({x:site.waterfall.pool.x+4,y:site.waterfall.pool.y,z:site.waterfall.pool.z}));
const camera={floorY:0,ceilingY:0,flooded:false,waterSurfaceY:NaN};
const aerial={obstacleTopY:NaN,ceilingY:NaN,protectedAirspace:false,blockerId:null,floorY:0,flooded:false,waterSurfaceY:NaN};
const movement={x:0,z:0,floorY:0,ceilingY:0,surfaceId:null,flooded:false,blocked:false,blockedByClimb:false};
function frame(runtime,index){const p=points[index%points.length],space='wildz.space.outer.v1';
 writeWildsSiteRuntimeCamera(camera,runtime,space,p.x,p.y,p.z);
 writeWildsSiteRuntimeAerialCollision(aerial,runtime,space,p.x,p.y,p.z,1.55,.38);
 writeWildsSiteRuntimeMovement(movement,runtime,space,p.x,p.y,p.z,p.x+.1,p.z+.1,.38);
}
function sample(physical){const runtime=prepareWildsSiteRuntime(physical);
 for(let i=0;i<3000;i++)frame(runtime,i);
 const before=wildsSiteRuntimeDiagnostics(),times=[];
 for(let window=0;window<30;window++){const start=performance.now();for(let i=0;i<1000;i++)frame(runtime,i);times.push((performance.now()-start)/1000);}
 const after=wildsSiteRuntimeDiagnostics();times.sort((a,b)=>a-b);
 return {solids:physical.solids.length,medianMs:times[15],p95Ms:times[28],runtimeBuildsDuringFrames:after.runtimeBuilds-before.runtimeBuilds,indexBuildsDuringFrames:after.indexBuilds-before.indexBuilds};
}
// Alternating warm scenarios reduces cold-cache and process-start skew.
sample(natural);sample(varied);
console.log(JSON.stringify({framesPerScenario:30000,queriesPerFrame:3,waterfallCount:points.length,natural:sample(natural),varied:sample(varied)},null,2));
