import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';
import * as navigation from '../src/features/play/creation/navigation';
import * as siteRuntime from '../src/features/play/wilds-site-runtime';
import * as flightCamera from '../src/features/play/wilds-flight-camera';
import * as underwaterCamera from '../src/features/play/wilds-underwater-camera';
import * as obstacles from '../src/features/play/wilds-terrain-obstacles';
import {admitWildsDiscoveryPhysicalNeighborhood} from '../src/features/play/wilds-discovery-sites';
import {deriveCreationGeometry} from '../src/features/play/creation/geometry';
import type {CreationPhysicalProjection} from '../src/features/play/creation/projection';
import {creationDefinitionFixture} from './support/creation-fixtures';

const OUTER='wildz.space.outer.v1';
const origin={x:137,y:11,z:-63};
const turn=(x:number,y:number,z:number,yaw=.61)=>new THREE.Vector3(x*Math.cos(yaw)+z*Math.sin(yaw),y,-x*Math.sin(yaw)+z*Math.cos(yaw));
function house(yaw=.61,spaceId=OUTER):CreationPhysicalProjection{
  const geometry=deriveCreationGeometry(creationDefinitionFixture().nodes[0],{position:origin,yaw});
  return {instanceId:'house',head:'sha256:house',definitionDigest:'sha256:definition',worldId:'wildz',spaceId,...geometry,chunks:[],nodePoses:new Map()};
}
function emptySiteRuntime(){
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  return siteRuntime.prepareWildsSiteRuntime({...physical,sites:[],solids:[],surfaces:[],ceilings:[],mountainFields:[],portals:[],waterVolumes:[],encounterVolumes:[]});
}

const dependencyRequire=createRequire(createRequire(import.meta.url).resolve('@react-three/drei'));
const {OrbitControls:RealOrbitControls}=await import(pathToFileURL(join(dirname(dependencyRequire.resolve('three-stdlib')),'controls/OrbitControls.js')).href);

// Execute the production rig's frame callbacks. Three's camera and vectors, the
// admitted collision caches, and camera writers remain real; only React/Fiber's
// mount and frame scheduling are supplied by this small headless harness.
function mountCamera(desired:THREE.Vector3,projection?:CreationPhysicalProjection,livingPhysicalObstacles:readonly obstacles.WildsTerrainObstacle[]=[],realControls=false){
  const camera=new THREE.PerspectiveCamera(40,1,.1,80);camera.position.copy(desired);
  const events=new Map<string,(event:any)=>void>();
  const listenerHost={addEventListener:(name:string,handler:(event:any)=>void)=>events.set(name,handler),removeEventListener:(name:string)=>events.delete(name)};
  const dom={...listenerHost,style:{},clientHeight:800,ownerDocument:listenerHost,releasePointerCapture(){}};
  const orbit=realControls?new RealOrbitControls(camera,dom):{target:new THREE.Vector3(),object:camera,update(){}};
  Object.assign(orbit,{minDistance:.45,maxDistance:12.5,dampingFactor:.08,minPolarAngle:.38,maxPolarAngle:Math.PI/2.15,rotateSpeed:.62,zoomSpeed:.82,enableDamping:true,enablePan:false,touches:{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE}});
  orbit.target.set(0,.9,0);orbit.update();
  const slots:{value:any;deps?:unknown[]}[]=[];
  let cursor=0,indexBuilds=0;
  const frames=new Map<number,(_:unknown,delta:number)=>void>();
  const source=readFileSync('src/features/play/WildsWorldCanvas.tsx','utf8');
  const body=source.slice(source.indexOf('function CameraRig('),source.indexOf('\nfunction frameSeconds('));
  const output=ts.transpileModule(body+'\nexports.CameraRig=CameraRig;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={CameraRig:null as unknown as (props:any)=>{props:{ref:{current:typeof orbit};camera?:THREE.PerspectiveCamera}}};
  const environment={exports,THREE,OrbitControls:()=>null,...navigation,...siteRuntime,...flightCamera,...underwaterCamera,...obstacles,
    buildWildsObstacleIndex(input:readonly obstacles.WildsTerrainObstacle[]){indexBuilds++;return obstacles.buildWildsObstacleIndex(input);},
    useThree:()=>({camera}),useRef:(value:unknown)=>(slots[cursor++]??={value:{current:value}}).value,
    useMemo(factory:()=>unknown,deps:unknown[]){const slot=cursor++;if(!slots[slot]?.deps||!deps.every((d,i)=>Object.is(d,slots[slot].deps![i])))slots[slot]={value:factory(),deps};return slots[slot].value;},
    useEffect:()=>{},useFrame:(callback:(_:unknown,delta:number)=>void,priority=0)=>frames.set(priority,callback),
    require:(name:string)=>{if(name==='react/jsx-runtime')return {jsx:(type:unknown,props:unknown)=>({type,props})};throw Error(name);}
  };
  Function(...Object.keys(environment),output)(...Object.values(environment));
  const runtime=emptySiteRuntime(),creationNavigation=projection?navigation.prepareCreationNavigation([projection]):undefined;
  const props={actualCameraSubmergedRef:{current:false},verticalTraversalRef:{current:{layer:'ground',offset:0,worldY:origin.y,intent:0,safeMin:0,safeMax:0}},
    aquaticPresentation:{mode:'land',terrainElevation:origin.y,waterSurfaceY:origin.y-2,waterDepth:0,actorLocalY:0,actorWorldY:origin.y,cameraSubmersionAllowed:false,scubaVisible:false},
    onCameraHeadingChange:()=>{},vistaHeading:null,siteRuntime:runtime,siteSpace:{spaceId:OUTER,position:{x:999,y:-50,z:999}},player:{x:origin.x,z:origin.z},terrainElevation:origin.y,creationNavigation,livingPhysicalObstacles};
  const render=()=>{cursor=0;const element=exports.CameraRig(props);orbit.object=element.props.camera??camera;element.props.ref.current=orbit;};render();
  const before=siteRuntime.wildsSiteRuntimeDiagnostics();
  return {camera,orbit,props,creationNavigation,render,indexBuilds:()=>indexBuilds,
    frame(){frames.get(-2)?.({},1/60);if(realControls)orbit.update();frames.get(-.25)?.({},1/60);},
    restore(){frames.get(-2)?.({},1/60);},
    input(name:string,event:Record<string,unknown>){events.get(name)?.({preventDefault(){},...event});},
    unchangedAuthority(){assert.equal(siteRuntime.wildsSiteRuntimeDiagnostics().indexBuilds,before.indexBuilds);assert.equal(siteRuntime.wildsSiteRuntimeDiagnostics().authorityBuilds,before.authorityBuilds);}
  };
}

test('camera retracts before a moved, rotated prompt wall and preserves the requested orbit',()=>{
  const desired=turn(6,.9,0),mounted=mountCamera(desired,house());
  mounted.frame();
  const local=turn(mounted.camera.position.x,mounted.camera.position.y,mounted.camera.position.z,-.61);
  assert.ok(local.x>1.5&&local.x<1.68,'camera must stop inside the wall with near-plane clearance');
  mounted.restore();assert.ok(mounted.camera.position.distanceTo(desired)<1e-8,'controls must receive the original desired orbit before their next update');
  mounted.orbit.object.position.copy(turn(0,.9,-7));mounted.frame();
  assert.ok(mounted.camera.position.distanceTo(turn(0,.9,-7))<1e-8,'an open doorway must restore the full clear view');
});

test('real OrbitControls wheel zoom persists after a clipped frame restores its desired view',()=>{
  const desired=new THREE.Vector3(Math.sqrt(34.56),2.1,0),clipped=mountCamera(desired,house(0),[],true),clear=mountCamera(desired,undefined,[],true);
  clipped.frame();clear.frame();assert.ok(clipped.camera.position.distanceTo(clipped.orbit.target)<2);
  for(const deltaY of [-100,-100,100]){clipped.input('wheel',{deltaY});clear.input('wheel',{deltaY});clipped.frame();clear.frame();}
  clipped.props.creationNavigation=undefined;clipped.render();clipped.frame();clear.frame();
  assert.ok(clear.camera.position.distanceTo(clear.orbit.target)<5.8);
  assert.ok(clipped.camera.position.distanceTo(clear.camera.position)<1e-8,'collision must not erase synchronous wheel updates');
});

test('real OrbitControls pinch zoom persists while clipping and regains the requested clear distance',()=>{
  const desired=new THREE.Vector3(Math.sqrt(34.56),2.1,0),clipped=mountCamera(desired,house(0),[],true),clear=mountCamera(desired,undefined,[],true);
  clipped.frame();clear.frame();
  for(const mounted of [clipped,clear]){
    mounted.input('pointerdown',{pointerId:1,pointerType:'touch',pageX:200,pageY:300});
    mounted.input('pointerdown',{pointerId:2,pointerType:'touch',pageX:400,pageY:300});
    mounted.input('pointermove',{pointerId:1,pointerType:'touch',pageX:180,pageY:300});
    mounted.input('pointermove',{pointerId:2,pointerType:'touch',pageX:420,pageY:300});
    mounted.input('pointerup',{pointerId:1,pointerType:'touch'});mounted.input('pointerup',{pointerId:2,pointerType:'touch'});
  }
  clipped.frame();clear.frame();clipped.props.creationNavigation=undefined;clipped.render();clipped.frame();clear.frame();
  assert.ok(clear.camera.position.distanceTo(clear.orbit.target)<5.2);
  assert.ok(clipped.camera.position.distanceTo(clear.camera.position)<1e-8,'collision must not erase synchronous pinch updates');
});

test('real OrbitControls rotation and damping match a clear orbit while the rendered camera is clipped',()=>{
  const desired=new THREE.Vector3(Math.sqrt(34.56),2.1,0),clipped=mountCamera(desired,house(0),[],true),clear=mountCamera(desired,undefined,[],true);
  clipped.frame();clear.frame();
  for(const mounted of [clipped,clear]){
    mounted.input('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:300});
    mounted.input('pointermove',{pointerId:1,pointerType:'mouse',clientX:300,clientY:300});
    mounted.input('pointerup',{pointerId:1,pointerType:'mouse'});
  }
  for(let frame=0;frame<120;frame++){clipped.frame();clear.frame();}
  clipped.props.creationNavigation=undefined;clipped.render();clipped.frame();clear.frame();
  assert.ok(Math.abs(clear.camera.position.z)>1);
  assert.ok(clipped.camera.position.distanceTo(clear.camera.position)<1e-8,'collision must retain the immediate rotation as well as remaining damping');
});

test('camera sweeps vertically before prompt roofs and floors using the rendered floor origin',()=>{
  const mounted=mountCamera(turn(0,5,0),house());mounted.frame();
  assert.ok(mounted.camera.position.y>2.5&&mounted.camera.position.y<2.68,'roof is at local 2.85, despite stale site-space elevation');
  mounted.restore();mounted.orbit.object.position.set(0,-1,0);mounted.frame();
  assert.ok(mounted.camera.position.y>.32&&mounted.camera.position.y<.35,'camera must stay above the solid floor');
});

test('manual wall and roof collision uses the prepared obstacle index only in outer space',()=>{
  const solids:obstacles.WildsTerrainObstacle[]=[
    {id:'manual:wall',kind:'structure',material:'solid',position:{x:origin.x+2,y:origin.y+1.5,z:origin.z},radius:3,shape:{kind:'box',halfX:.1,halfY:1.5,halfZ:3},visualScale:1},
    {id:'manual:roof',kind:'ceiling',material:'solid',position:{x:origin.x,y:origin.y+3,z:origin.z},radius:4,shape:{kind:'box',halfX:3,halfY:.1,halfZ:3},visualScale:1}
  ];
  const mounted=mountCamera(new THREE.Vector3(6,.9,0),undefined,solids);mounted.frame();
  assert.ok(mounted.camera.position.x>1.6&&mounted.camera.position.x<1.73);
  mounted.restore();mounted.orbit.object.position.set(0,5,0);mounted.frame();assert.ok(mounted.camera.position.y>2.6&&mounted.camera.position.y<2.73);
  mounted.unchangedAuthority();
  mounted.restore();mounted.props.siteSpace.spaceId='other-space';
  mounted.props.siteRuntime=siteRuntime.prepareWildsSiteRuntime({...mounted.props.siteRuntime.physical,surfaces:[{id:'other-floor',siteKey:'fixture',spaceId:'other-space',kind:'interior-floor',center:origin,halfExtents:{x:10,y:.05,z:10},flooded:false}]});
  mounted.render();mounted.frame();
  assert.ok(mounted.camera.position.y>4.99,'outdoor manual obstacles must not clip another space');
});

test('clear outdoor camera views allow close ground zoom and isolate creation spaces',()=>{
  const mounted=mountCamera(turn(6,.9,0),house(.61,'other-space'));mounted.frame();
  assert.ok(mounted.camera.position.distanceTo(turn(6,.9,0))<1e-8);
  assert.ok(mounted.orbit.minDistance<=.45,'ground zoom must reach a small interior even without a cave portal');
  mounted.orbit.object.position.set(.45,.9,0);mounted.frame();assert.equal(mounted.camera.position.x,.45);
});

test('camera frame work stays regional and reuses prepared authority and obstacle indexes',()=>{
  const mounted=mountCamera(turn(6,.9,0),house());
  const nearby=house(),distant=Array.from({length:6000},(_,i)=>({...nearby,instanceId:`far:${i}`,solids:nearby.solids.map(s=>({...s,center:{...s.center,x:10000+i*32}})),walkable:[]}));
  mounted.props.creationNavigation=navigation.prepareCreationNavigation([nearby,...distant]);mounted.render();
  const map=mounted.props.creationNavigation.spaces.get(OUTER)!.solids;
  const get=map.get.bind(map);let reads=0;
  map.get=(key:string)=>{reads++;return get(key);};
  map.values=()=>{throw Error('camera must not scan all creation solids');};
  for(let frame=0;frame<120;frame++){mounted.render();mounted.frame();}
  assert.ok(reads>0&&reads<120*16,'each view queries a bounded group of cached buckets');
  assert.equal(mounted.indexBuilds(),1,'manual collision index must be retained between frames and renders');
  mounted.unchangedAuthority();
});

test('oversized and dense camera queries stop at the target within a fixed work budget',()=>{
  const runtime=navigation.prepareCreationNavigation([house()]),map=runtime.spaces.get(OUTER)!.solids,get=map.get.bind(map);
  let reads=0;map.get=(key:string)=>{reads++;return get(key);};
  const target={x:0,y:.9,z:0},oversized={x:1e6,y:5,z:1e6};
  navigation.writeCreationCameraPosition(oversized,runtime,OUTER,origin,target);
  assert.deepEqual(oversized,target);assert.equal(reads,0);
  const room=house(),solids=Array.from({length:5000},(_,i)=>({...room.solids[0],id:`dense:${i}`,center:{...origin,y:100}}));
  const dense=navigation.prepareCreationNavigation([{...room,solids}]),output={x:3,y:.9,z:0};
  navigation.writeCreationCameraPosition(output,dense,OUTER,origin,target);
  assert.deepEqual(output,target);
});

test('manual cylindrical posts retract a camera crossing them but leave a clear doorway view intact',()=>{
  const index=obstacles.buildWildsObstacleIndex([{id:'post',kind:'structure',material:'solid',position:{x:origin.x+2,y:origin.y,z:origin.z},radius:.2,shape:{kind:'cylinder',radius:.2,height:3},visualScale:1}]);
  const target={x:0,y:.9,z:0},crossing={x:6,y:.9,z:0};
  siteRuntime.writeWildsObstacleCameraPosition(crossing,index,OUTER,origin,target);
  assert.ok(crossing.x>1.6&&crossing.x<1.63);
  const clear={x:0,y:.9,z:-7};siteRuntime.writeWildsObstacleCameraPosition(clear,index,OUTER,origin,target);
  assert.deepEqual(clear,{x:0,y:.9,z:-7});
});
