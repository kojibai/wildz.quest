import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creationDefinitionFixture,creationContextFixture} from './support/creation-fixtures';
import {createCreationInstance,sealCreationInstance} from '../src/features/play/creation/instance';
import {compileCreation} from '../src/features/play/creation/compiler';
import {projectCreationPhysical} from '../src/features/play/creation/projection';
import {prepareCreationNavigation,resolveCreationMovement,findCreationRoute} from '../src/features/play/creation/navigation';
import {resolveCreationInteraction} from '../src/features/play/creation/interactions';
import {applyWildsInput,initialPlayState} from '../src/features/play/game-state';
import {emptyCreationState} from '../src/features/play/creation/state';
function fixture(){const base=creationDefinitionFixture().nodes[0];const steps=Array.from({length:10},(_,i)=>({...base,id:`step${i}`,shape:{kind:'box' as const,width:1,height:.2,depth:.6},pose:{position:{x:0,y:i*.2,z:i*.55},yaw:0},supports:i?[`step${i-1}`]:[],behaviors:[]}));const definition=creationDefinitionFixture({nodes:steps});const result=compileCreation(definition,creationContextFixture());assert.equal(result.status,'ready');if(result.status!=='ready')throw Error('fixture');const initial=createCreationInstance({instanceId:'stairs',definition,ownerId:'owner',worldId:'wildz',spaceId:'surface',pose:result.plan.pose,kaiUPulse:1});const {head,...basis}=initial;void head;const instance=sealCreationInstance({...basis,stage:'functional'});return {definition,plan:result.plan,instance};}
test('admits connected stairs and inhabitable upper floors',()=>{const f=fixture(),projection=projectCreationPhysical(f.instance,f.definition,f.plan),runtime=prepareCreationNavigation([projection]);const route=findCreationRoute(runtime,'surface',projection.walkable[0].center,projection.walkable.at(-1)!.center);assert.equal(route.reachable,true);assert.equal(projection.spaceId,f.instance.spaceId);assert.equal(route.points.length,10);});
test('movement uses oriented solids, preserves spaces, and sweeps against tunnelling',()=>{const definition=creationDefinitionFixture(),result=compileCreation(definition,creationContextFixture());if(result.status!=='ready')throw Error('fixture');const initial=createCreationInstance({instanceId:'house',definition,ownerId:'owner',worldId:'wildz',spaceId:'surface',pose:result.plan.pose,kaiUPulse:1}),{head,...basis}=initial;void head;const projection=projectCreationPhysical(sealCreationInstance({...basis,stage:'functional'}),definition,result.plan),runtime=prepareCreationNavigation([projection]);const entry=resolveCreationMovement(runtime,'surface',{x:0,y:.15,z:-3},{x:0,y:.15,z:0});assert.equal(entry.blocked,false);const wall=resolveCreationMovement(runtime,'surface',{x:0,y:.15,z:0},{x:4,y:.15,z:0});assert.equal(wall.blocked,true);assert.ok(wall.position.x<2);const isolated=resolveCreationMovement(runtime,'cave',{x:0,y:.15,z:0},{x:4,y:.15,z:0});assert.equal(isolated.blocked,false);});
test('planned previews never become physical and broken supports remove traversal',()=>{const f=fixture(),{head,...basis}=f.instance;assert.throws(()=>projectCreationPhysical(sealCreationInstance({...basis,stage:'planned'}),f.definition,f.plan),/functional/);const states={...basis.nodeStates,step0:{...basis.nodeStates.step0,condition:0}};const damaged=sealCreationInstance({...basis,nodeStates:states,revision:1,parentHead:head});const projection=projectCreationPhysical(damaged,f.definition,f.plan);assert.equal(projection.solids.length,0);assert.equal(projection.walkable.length,0);});
test('duplicate projection heads deduplicate and conflicting heads reject',()=>{const f=fixture(),projection=projectCreationPhysical(f.instance,f.definition,f.plan);assert.equal(prepareCreationNavigation([projection,projection]).instanceCount,1);assert.throws(()=>prepareCreationNavigation([projection,{...projection,head:`sha256:${'b'.repeat(64)}`}]),/conflict/);});
test('interactions require current custody, usable components, range and matching space',()=>{const f=fixture(),state={...emptyCreationState(),definitions:{[f.definition.digest]:f.definition},instances:{stairs:f.instance},custody:{stairs:'owner'}};assert.deepEqual(resolveCreationInteraction(state,'stairs','step0',{id:'visitor',spaceId:'surface',position:{x:0,y:0,z:0}}),[]);const actions=resolveCreationInteraction(state,'stairs','step0',{id:'owner',spaceId:'surface',position:{x:0,y:0,z:0}});assert.ok(actions.some(a=>a.action==='edit'));assert.ok(!actions.some(a=>a.action==='rest'));assert.deepEqual(resolveCreationInteraction({...state,custody:{stairs:'new-owner'}},'stairs','step0',{id:'owner',spaceId:'surface',position:{x:0,y:0,z:0}}),[]);assert.deepEqual(resolveCreationInteraction(state,'stairs','step0',{id:'owner',spaceId:'cave',position:{x:0,y:0,z:0}}),[]);});

test('a sealed candidate or transport admission cannot enter the playable store',async()=>{const {createCreationPhysicalStore}=await import('../src/features/play/creation/physical-store');const {creationOperationFixture,creationOperationContextFixture}=await import('./support/creation-operation-fixtures');const operation=creationOperationFixture(),context=creationOperationContextFixture(),compiled=compileCreation(context.definition,context.compileContext);if(compiled.status!=='ready')throw Error('fixture');let projectCalls=0;const store=createCreationPhysicalStore({project:async(instance,definition,plan)=>{projectCalls++;return projectCreationPhysical(instance,definition,plan);}});assert.equal(await store.adopt(operation,{status:'admitted',operationId:operation.operationId,operationDigest:operation.digest,instance:operation.command.instance,successorSources:[],eventIds:[],receipt:{canonical:true}},compiled.plan),false);assert.equal(projectCalls,0);assert.equal(store.snapshot().projections.length,0);});

test('projection rejects altered plan stages even when digest text is unchanged',()=>{const f=fixture();assert.throws(()=>projectCreationPhysical(f.instance,f.definition,{...f.plan,stages:[['step9']]}),/seal/);});

test('leaving a raised created floor returns to the real ground instead of floating',()=>{const f=fixture(),projection=projectCreationPhysical(f.instance,f.definition,f.plan),runtime=prepareCreationNavigation([projection]),start=projection.walkable.at(-1)!.center,end={...start,x:4,y:0};const result=resolveCreationMovement(runtime,'surface',start,end);assert.equal(result.blocked,false);assert.equal(result.position.y,0);});

test('gameplay movement consumes the admitted creation navigation cache and charges only actual travel',()=>{const base=creationDefinitionFixture().nodes[0],p=initialPlayState.player,definition=creationDefinitionFixture({nodes:[{...base,shape:{kind:'box',width:.2,height:20,depth:5},pose:{position:{x:p.x+.65,y:-2,z:p.z},yaw:0}}]}),context=creationContextFixture({spaceId:'wildz.space.outer.v1',budget:{timber:100}}),compiled=compileCreation(definition,context);if(compiled.status!=='ready')throw Error('fixture');const initial=createCreationInstance({instanceId:'wall',definition,ownerId:'owner',worldId:'wildz',spaceId:context.spaceId,pose:context.pose,kaiUPulse:1}),{head,...basis}=initial;void head;const nav=prepareCreationNavigation([projectCreationPhysical(sealCreationInstance({...basis,stage:'functional'}),definition,compiled.plan)]),input={type:'move' as const,direction:'east' as const,creationNavigation:nav},unobstructed=applyWildsInput(initialPlayState,{type:'move',direction:'east'}),blocked=applyWildsInput(initialPlayState,input);assert.ok(blocked.player.x<unobstructed.player.x);assert.ok(blocked.player.x-p.x<.25);assert.ok(blocked.energy>=unobstructed.energy);});


test('a local stair route never enumerates distant creation surfaces', () => {
 const f=fixture(), projection=projectCreationPhysical(f.instance,f.definition,f.plan);
 const distant=Array.from({length:6000},(_,i)=>({...projection,instanceId:`distant:${i}`,solids:[],walkable:projection.walkable.map(s=>({...s,center:{...s.center,x:1000+i*32}}))}));
 const runtime=prepareCreationNavigation([projection,...distant]),index=runtime.spaces.get('surface')!;
 let enumerated=false;
 index.surfaces.values=()=>{enumerated=true;throw Error('whole surface scan');};
 const route=findCreationRoute(runtime,'surface',projection.walkable[0].center,projection.walkable.at(-1)!.center);
 assert.equal(route.reachable,true);assert.equal(route.points.length,10);assert.equal(enumerated,false);
});

test('flight sweeps vertically against creation roofs without snapping to a ground floor', async () => {
 const {resolveCreationFlight}=await import('../src/features/play/creation/navigation');
 const f=fixture(),p=projectCreationPhysical(f.instance,f.definition,f.plan);
 const roof={id:'roof',center:{x:0,y:4,z:0},halfExtents:{x:4,y:.15,z:4},yaw:0};
 const runtime=prepareCreationNavigation([{...p,solids:[roof],walkable:[]}]);
 const hit=resolveCreationFlight(runtime,'surface',{x:0,y:0,z:0},{x:0,y:8,z:0});
 assert.equal(hit.blocked,true);assert.ok(hit.position.y<2.4);
 const clear=resolveCreationFlight(runtime,'surface',{x:8,y:3,z:0},{x:8,y:7,z:0});
 assert.deepEqual(clear,{position:{x:8,y:7,z:0},blocked:false});
});


test('aerial ceiling and floor samples use the same cached creation solids as movement', async () => {
 const {writeCreationAerialCollision}=await import('../src/features/play/creation/navigation');
 const f=fixture(),p=projectCreationPhysical(f.instance,f.definition,f.plan);
 const roof={id:'roof',center:{x:0,y:4,z:0},halfExtents:{x:4,y:.15,z:4},yaw:0};
 const runtime=prepareCreationNavigation([{...p,solids:[roof],walkable:[{...roof,id:'floor',center:{x:0,y:1,z:0},halfExtents:{x:4,y:0,z:4}}]}]);
 const sample={obstacleTopY:0,ceilingY:0,protectedAirspace:false,blockerId:null as string|null,floorY:0};
 writeCreationAerialCollision(sample,runtime,'surface',{x:0,y:1,z:0},0);
 assert.equal(sample.floorY,1);assert.equal(sample.ceilingY,3.85);assert.equal(sample.blockerId,'roof');
 writeCreationAerialCollision(sample,runtime,'other',{x:0,y:1,z:0},0);
 assert.equal(sample.floorY,0);assert.ok(Number.isNaN(sample.ceilingY));assert.equal(sample.blockerId,null);
});

function wallRuntime(yaw=0) {
 const f=fixture(),p=projectCreationPhysical(f.instance,f.definition,f.plan);
 return prepareCreationNavigation([{...p,solids:[{id:'wall',center:{x:0,y:1.5,z:0},halfExtents:{x:.1,y:1.5,z:5},yaw}],walkable:[]}]);
}
test('walking diagonally against a created wall slides along it instead of freezing',()=>{
 const result=resolveCreationMovement(wallRuntime(),'surface',{x:-.5,y:0,z:-2},{x:.5,y:0,z:2});
 assert.equal(result.blocked,true);
 assert.ok(result.position.x<=-.44999);
 assert.ok(result.position.z>1.99);
});
test('a small restored overlap with a created wall can be escaped by walking away',()=>{
 const runtime=wallRuntime(),first=resolveCreationMovement(runtime,'surface',{x:-.3,y:0,z:0},{x:-.325,y:0,z:.025});
 assert.ok(first.position.x<=-.44999);
 const result=resolveCreationMovement(runtime,'surface',first.position,{x:-1,y:0,z:1});
 assert.ok(result.position.x<-.99);assert.ok(result.position.z>.99);
});
test('wall sliding follows the wall orientation at arbitrary building rotations',()=>{
 const yaw=Math.PI/3,c=Math.cos(yaw),s=Math.sin(yaw),world=(x:number,z:number)=>({x:x*c+z*s,y:0,z:z*c-x*s});
 const result=resolveCreationMovement(wallRuntime(yaw),'surface',world(-.5,-2),world(.5,2));
 const x=result.position.x*c-result.position.z*s,z=result.position.x*s+result.position.z*c;
 assert.equal(result.blocked,true);assert.ok(x<=-.44999);assert.ok(z>1.99);
});
test('a diagonal doorway approach can round a jamb and then enter and leave repeatedly',()=>{
 const definition=creationDefinitionFixture(),context=creationContextFixture(),compiled=compileCreation(definition,context);
 if(compiled.status!=='ready')throw Error('fixture');
 const initial=createCreationInstance({instanceId:'door-round-trip',definition,ownerId:'owner',worldId:'wildz',spaceId:'surface',pose:compiled.plan.pose,kaiUPulse:1});
 const {head,...basis}=initial;void head;
 const runtime=prepareCreationNavigation([projectCreationPhysical(sealCreationInstance({...basis,stage:'functional'}),definition,compiled.plan)]);
 let position={x:.65,y:.15,z:-3};
 for(let i=0;i<4;i++){
  position=resolveCreationMovement(runtime,'surface',position,{x:0,y:.15,z:0}).position;
  assert.ok(position.z>-1,'the diagonal approach must slide past the jamb');
  position=resolveCreationMovement(runtime,'surface',position,{x:0,y:.15,z:0}).position;
  assert.ok(Math.abs(position.x)<.01&&Math.abs(position.z)<.01,JSON.stringify(position));
  position=resolveCreationMovement(runtime,'surface',position,{x:0,y:.15,z:-3}).position;
  assert.ok(Math.abs(position.z+3)<.01);
 }
});

test('gameplay walks on a created floor over deep water and retains swim gates outside it',async()=>{
 const {sampleWildsTerrain}=await import('../src/features/play/wilds-terrain-authority');
 const p={x:-1000,z:-1000},base=creationDefinitionFixture().nodes[0],context=creationContextFixture({spaceId:'wildz.space.outer.v1',pose:{position:{x:p.x,y:100,z:p.z},yaw:Math.PI/3},budget:{timber:100}});
 assert.ok(sampleWildsTerrain(p.x+1.05,p.z).traversal.some(t=>t.kind==='swim'));
 const definition=creationDefinitionFixture({nodes:[{...base,shape:{kind:'box',width:8,height:.01,depth:8},pose:{position:{x:0,y:0,z:0},yaw:0},behaviors:[]}]}),compiled=compileCreation(definition,context);
 if(compiled.status!=='ready')throw Error('fixture');
 const {head,...basis}=createCreationInstance({instanceId:'water-floor',definition,ownerId:'owner',worldId:'wildz',spaceId:context.spaceId,pose:compiled.plan.pose,kaiUPulse:1});void head;
 const navigation=prepareCreationNavigation([projectCreationPhysical(sealCreationInstance({...basis,stage:'functional'}),definition,compiled.plan)]);
 const state={...initialPlayState,player:p,siteSpace:{version:'wildz.site-space-state.v1' as const,spaceId:context.spaceId,siteKey:null,surfaceId:null,position:{...p,y:100.01},flooded:false}};
 const walked=applyWildsInput(state,{type:'move',direction:'east',creationNavigation:navigation});
 assert.ok(walked.player.x>p.x+1);assert.ok(Math.abs(walked.siteSpace.position.y-100.01)<1e-8);assert.doesNotMatch(walked.lastEvent,/deep water/i);
 const outside=applyWildsInput(state,{type:'move',direction:'east'});
 assert.equal(outside.player.x,p.x);assert.match(outside.lastEvent,/deep water/i);
 const underneath=applyWildsInput({...state,siteSpace:{...state.siteSpace,position:{...state.siteSpace.position,y:0}}},{type:'move',direction:'east',creationNavigation:navigation});
 assert.equal(underneath.player.x,p.x);assert.match(underneath.lastEvent,/deep water/i);
});
test('a sideways wall slide adopts the real floor at its adjusted endpoint',async()=>{
 const {wildsTerrainElevation}=await import('../src/features/play/wilds-terrain-authority');
 const p={x:-12,z:12},y=wildsTerrainElevation(p.x,p.z),base=creationDefinitionFixture().nodes[0];
 const context=creationContextFixture({spaceId:'wildz.space.outer.v1',pose:{position:{x:p.x,y,z:p.z},yaw:0},budget:{timber:100}});
 const definition=creationDefinitionFixture({nodes:[{...base,shape:{kind:'box',width:.2,height:3,depth:10},pose:{position:{x:.5,y:0,z:0},yaw:Math.PI/4},behaviors:[]}]}),compiled=compileCreation(definition,context);
 if(compiled.status!=='ready')throw Error('fixture');
 const {head,...basis}=createCreationInstance({instanceId:'slope-wall',definition,ownerId:'owner',worldId:context.worldId,spaceId:context.spaceId,pose:compiled.plan.pose,kaiUPulse:1});void head;
 const navigation=prepareCreationNavigation([projectCreationPhysical(sealCreationInstance({...basis,stage:'functional'}),definition,compiled.plan)]);
 const state={...initialPlayState,player:p,siteSpace:{version:'wildz.site-space-state.v1' as const,spaceId:context.spaceId,siteKey:null,surfaceId:null,position:{x:p.x,y,z:p.z},flooded:false}};
 const moved=applyWildsInput(state,{type:'move',direction:'east',creationNavigation:navigation});
 assert.ok(Math.hypot(moved.player.x-p.x,moved.player.z-p.z)>.1,'a safe wall slide should still travel');
 assert.ok(Math.abs(moved.siteSpace.position.y-wildsTerrainElevation(moved.player.x,moved.player.z))<.000001,'feet must follow terrain after sideways adjustment');
});
