/** Run pnpm test first. Synthetic prepared-page CPU timings, not browser FPS. */
import {performance} from 'node:perf_hooks';
import {proposeLocalCreation} from '../.test-build/src/lib/receiz/wilds-local-creation-planner.js';
import {compileCreation} from '../.test-build/src/features/play/creation/compiler.js';
import {createCreationRenderGeometry} from '../.test-build/src/features/play/creation/render-geometry.js';
import {prepareCreationCameraCutaway} from '../.test-build/src/features/play/creation/camera-presentation.js';
import {creationContextFixture} from '../.test-build/tests/support/creation-fixtures.js';
const countWindows=30,framesPerWindow=120;
const percentile=(values,fraction)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*fraction)-1)];};
const stats=values=>({samples:values.length,medianMs:percentile(values,.5),p95Ms:percentile(values,.95)});
for(const [rooms,floors] of [[10,2],[24,4]]){
  const context=creationContextFixture({pose:{position:{x:137,y:11,z:-63},yaw:.61},budget:{timber:100000,stone:100000,hay:100000}});
  const proposal=proposeLocalCreation({requestId:`camera-benchmark:${rooms}`,actorId:'owner',selected:null,message:`Build a timber house with ${rooms} rooms and ${floors} floors`,workers:[],context},new AbortController().signal);
  if(!('definition' in proposal))throw Error('Expected a definition');
  const compiled=compileCreation(proposal.definition,context);
  if(compiled.status!=='ready')throw Error(JSON.stringify(compiled));
  const chunks=compiled.plan.chunks;
  const setupStart=performance.now();
  const pages=chunks.map(chunk=>{const geometry=createCreationRenderGeometry(chunk);return{geometry,writer:prepareCreationCameraCutaway(chunk,geometry)};});
  const setupMs=performance.now()-setupStart;
  const root=proposal.definition.nodes.find(node=>node.id==='room');
  const c=Math.cos(context.pose.yaw),s=Math.sin(context.pose.yaw),origin=context.pose.position;
  const world=(x,y,z)=>({x:origin.x+x*c+z*s,y:origin.y+y,z:origin.z-x*s+z*c});
  const target=world(root.pose.position.x,.9,0),x=root.pose.position.x;
  const views=[world(x+6,1.6,0),world(x+1,1.5,-1),world(x,12,0)];
  const orbit=Array.from({length:framesPerWindow},(_,frame)=>{const angle=frame/framesPerWindow*Math.PI*2,radius=.45+12.05*(.5+.5*Math.sin(angle*2)),pitch=.03+Math.PI*.47*(.5+.5*Math.cos(angle));return world(x+Math.cos(angle)*Math.sin(pitch)*radius,.9+Math.cos(pitch)*radius,Math.sin(angle)*Math.sin(pitch)*radius);});
  const write=camera=>{let updated=0;for(const page of pages)if(page.writer.write(camera,target))updated++;return updated;};
  // Warm all helper paths and the JIT before recording individual frame CPU time.
  for(let frame=0;frame<3000;frame++)write(orbit[frame%framesPerWindow]);
  const stable=[];let stableUpdates=0;const stableWindows=[];
  for(let window=0;window<countWindows;window++){
    const view=views[window%views.length];write(view);
    const versions=pages.map(p=>p.geometry.index.version);let windowUpdates=0;
    for(let frame=0;frame<framesPerWindow;frame++){
      const start=performance.now();const updated=write(view);stable.push(performance.now()-start);windowUpdates+=updated;
    }
    stableUpdates+=windowUpdates;
    if(pages.some((p,i)=>p.geometry.index.version!==versions[i]))throw Error('Stable view published an index update');
    stableWindows.push(windowUpdates);
  }
  const transitions=[];let transitionUpdates=0;
  for(let window=0;window<countWindows;window++)for(let frame=0;frame<framesPerWindow;frame++){
    const start=performance.now();const updated=write(orbit[frame]);transitions.push(performance.now()-start);transitionUpdates+=updated;
  }
  console.log(JSON.stringify({rooms,floors,nodes:proposal.definition.nodes.length,pages:chunks.length,solids:chunks.reduce((sum,p)=>sum+p.solids.length,0),vertices:chunks.reduce((sum,p)=>sum+p.positions.length/3,0),setupIncludingGeometryMs:setupMs,stable:{...stats(stable),framesPerWindow,windows:countWindows,indexUpdates:stableUpdates,maximumUpdatesPerWindow:Math.max(...stableWindows)},orbit:{...stats(transitions),framesPerWindow,windows:countWindows,indexUpdates:transitionUpdates,updatesPerFrame:transitionUpdates/transitions.length}}));
  pages.forEach(p=>p.geometry.dispose());
}
