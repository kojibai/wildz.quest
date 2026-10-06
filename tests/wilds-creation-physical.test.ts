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
