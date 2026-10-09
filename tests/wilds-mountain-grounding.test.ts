import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import * as animalEcology from '../src/features/play/wilds-animal-ecology';
import * as faunaMotion from '../src/features/play/wilds-fauna-motion';
import * as faunaModel from '../src/features/play/wilds-fauna-model';
import * as visuals from '../src/features/play/wilds-nourishment-visuals';
import * as picking from '../src/features/play/wilds-nourishment-picking';
import * as materials from '../src/features/play/wilds-nourishment-materials';
import * as interaction from '../src/features/play/wilds-animal-interaction';
import * as kai from '../src/features/play/wilds-kai-runtime';
import * as resourcePlacements from '../src/features/play/wilds-resource-placements';
import * as terrainObstacles from '../src/features/play/wilds-terrain-obstacles';
import * as terrain from '../src/features/play/wilds-terrain-authority';
import * as runtime from '../src/features/play/wilds-site-runtime';
import { admitWildsDiscoveryPhysicalNeighborhood } from '../src/features/play/wilds-discovery-sites';
import { mountFrameComponent } from './support/frame-component-harness';
import { createWildsMovingInstancesRuntime, writeWildsMovingInstances } from '../src/features/play/wilds-moving-instances';

test('moving migration creatures retain their motion while following each local slope',()=>{
  const state=createWildsMovingInstancesRuntime(),matrix=new THREE.Matrix4();let count=0;
  const target={instanceMatrix:{needsUpdate:false},setMatrixAt(_i:number,m:THREE.Matrix4){matrix.copy(m);assert.ok(Math.abs(matrix.elements[13]-(.34+matrix.elements[12]*.5))<1e-7);count++;}};
  for(let i=0;i<60;i++)assert.equal(writeWildsMovingInstances(state,target,9,i/60,false,(x)=>x*.5),state);
  assert.equal(count,540);
});

test('grove pollinators stay above their rotating mountain path and reset when the field leaves',()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0),position={x:40,z:40};
  const field={id:'mountain:pollinators',siteKey:'pollinators',spaceId:'wildz.space.outer.v1' as const,
    center:{x:40,y:10,z:40},halfExtents:{x:4,y:4,z:4},columns:2,rows:2,
    nodes:[[-4,-4],[4,-4],[-4,4],[4,4]].map(([x,z])=>({x:40+x!,z:40+z!,baseY:0,topY:10+x!*.5}))};
  const siteRuntime=runtime.prepareWildsSiteRuntime({...physical,mountainFields:[field]});
  const mounted=mountFrameComponent('src/features/play/WildsRegenerativeGroveEnvironment.tsx',['GrovePollinators'],{...runtime,Shared:()=>null});
  const props={count:2,geometry:{},material:{},siteRuntime,position,groundY:10};
  const element=mounted.render(props),root=new THREE.Group();
  for(const child of element.props.children){const mesh=new THREE.Mesh();mesh.position.set(...child.props.position as [number,number,number]);root.add(mesh);}
  element.props.ref.current=root;
  for(let frame=0;frame<60;frame++){
    mounted.frame({clock:{elapsedTime:frame/60}});root.updateMatrixWorld(true);
    for(let i=0;i<root.children.length;i++){
      const p=root.children[i]!.getWorldPosition(new THREE.Vector3());
      const ground=runtime.wildsSiteRuntimeGroundY(siteRuntime,'wildz.space.outer.v1',p.x+40,p.z+40,10);
      assert.ok(p.y+10-ground>=1,'pollinators cannot fly through an uphill flower bed');
    }
  }
  mounted.render({...props,siteRuntime:runtime.prepareWildsSiteRuntime({...physical,mountainFields:[]})});mounted.frame({clock:{elapsedTime:2}});
  assert.equal(root.children[0]!.position.y,0);assert.equal(root.children[1]!.position.y,.18);
});

test('hunt impact remains at the mountain animal instead of its old base-land coordinate',()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0),position={x:40,y:0,z:40};
  const field={id:'mountain:hunt',siteKey:'hunt',spaceId:'wildz.space.outer.v1' as const,
    center:{x:40,y:5,z:40},halfExtents:{x:2,y:5,z:2},columns:2,rows:2,
    nodes:[[-2,-2],[2,-2],[-2,2],[2,2]].map(([x,z])=>({x:40+x!,z:40+z!,baseY:0,topY:10}))};
  const siteRuntime=runtime.prepareWildsSiteRuntime({...physical,mountainFields:[field]});
  const mounted=mountFrameComponent('src/features/play/WildsAnimalHuntEffect.tsx',['WildsAnimalHuntEffect'],{...interaction,...runtime,performance:{now:()=>500}});
  const hunt={position,from:{x:39,y:11,z:40},spaceId:'wildz.space.outer.v1',startedAtMs:100};
  const element=mounted.render({hunt,origin:{current:{x:40,y:10,z:40}},reducedMotion:false,siteRuntime});
  const root=new THREE.Group();element.props.ref.current=root;
  for(const child of element.props.children)child.props.ref.current=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  mounted.frame();assert.ok(Math.abs(root.position.y-.3)<1e-6);
  assert.equal(hunt.position.y,0,'visual grounding leaves the saved command untouched');
});

test('grove trees and flowers independently follow their local mountain height',()=>{
  const physical=admitWildsDiscoveryPhysicalNeighborhood(0,0),p={x:40,y:0,z:40};
  const field={id:'mountain:grove',siteKey:'grove',spaceId:'wildz.space.outer.v1' as const,
    center:{x:p.x,y:10,z:p.z},halfExtents:{x:4,y:4,z:4},columns:2,rows:2,
    nodes:[[-4,-4],[4,-4],[-4,4],[4,4]].map(([x,z])=>({x:p.x+x!,z:p.z+z!,baseY:0,topY:10+x!*.5}))};
  const siteRuntime=runtime.prepareWildsSiteRuntime({...physical,mountainFields:[field]});
  const mounted=mountFrameComponent('src/features/play/WildsRegenerativeGroveEnvironment.tsx',['GroveManifestation'],{
    ...runtime,...terrain,Shared:()=>null,GrovePollinators:()=>null
  });
  const flowerGeometry={};
  const element=mounted.render({grove:{position:p,groveId:'grove:mountain',ecology:{maturity:60,flowers:5,moisture:0,pollinators:1},structures:{hive:0,nursery:0}},
    siteRuntime,groundY:10,geometry:{flower:flowerGeometry},materials:{},position:[0,0,0]});
  const children=element.props.children.flat().filter(Boolean);
  const trees=children.filter((child:any)=>child.type==='group');
  assert.equal(trees.length,6);
  for(const tree of trees) {
    const [x,y,z]=tree.props.position;
    assert.ok(Math.abs(y-(runtime.wildsSiteRuntimeGroundY(siteRuntime,'wildz.space.outer.v1',p.x+x,p.z+z,0)-10))<1e-6);
  }
  // Flower geometry is the distinct shared input, so this also catches foliage
  // left on the old flat site plane while only its central tree was lifted.
  const flowers=children.filter((c:any)=>c?.props.geometry===flowerGeometry);
  assert.equal(flowers.length,5);
  for(const flower of flowers) {
    const [x,y,z]=flower.props.position;
    assert.ok(Math.abs(y-.16-(runtime.wildsSiteRuntimeGroundY(siteRuntime,'wildz.space.outer.v1',p.x+x,p.z+z,0)-10))<1e-6);
  }
});

test('actual animal meshes, selection ring and nearby sound follow mountain skin while their proof anchors stay intact',()=>{
  const animal=Array.from({length:100},(_,i)=>animalEcology.wildsWildAnimalsForTile(i%10-5,Math.floor(i/10)-5)).flat()[0]!;
  assert.ok(animal);
  const p=animal.anchor,physical=admitWildsDiscoveryPhysicalNeighborhood(0,0);
  const field={id:'mountain:fauna',siteKey:'fauna',spaceId:'wildz.space.outer.v1' as const,
    center:{x:p.x,y:p.y+5,z:p.z},halfExtents:{x:2,y:5,z:2},columns:2,rows:2,
    nodes:[[-2,-2],[2,-2],[-2,2],[2,2]].map(([x,z])=>({x:p.x+x!,z:p.z+z!,baseY:p.y,topY:p.y+10+x!*.5}))};
  const siteRuntime=runtime.prepareWildsSiteRuntime({...physical,mountainFields:[field]});
  const audio=new Map(),shapes=['body','limb','tip','apple','leaf'];
  const mounted=mountFrameComponent('src/features/play/WildsNourishmentEnvironment.tsx',['WildsNourishmentEnvironment'],{
    ...animalEcology,...faunaMotion,...faunaModel,...visuals,...picking,...materials,...interaction,...kai,...resourcePlacements,...terrainObstacles,...terrain,...runtime,
    useContext:()=>audio,WildsEmbodiedAudioContext:{},performance:{now:()=>100},
    createWildsNourishmentTexture:()=>new THREE.Texture(),CAPACITY:1536,SHAPES:shapes,ANIMAL_SHAPES:shapes.slice(0,3),
    DETAIL:{medium:{plants:32,animals:10,livestock:4,segments:10,rings:6}},
    batches:()=>Object.fromEntries(shapes.map(s=>[s,{mesh:null,count:0,picks:[],tones:[],colorsChanged:false}]))
  });
  const projected={...animal,position:p,status:'wild',canHunt:true,canCapture:true,distance:0};
  const element=mounted.render({animals:[projected],origin:{...p,y:p.y+10},kaiUPulse:0,siteRuntime,selectedAnimalId:animal.animalId});
  const meshes:THREE.InstancedMesh[]=[];let ring:THREE.Mesh|undefined;
  for(const child of element.props.children.flat().filter(Boolean)){
    if(child.type==='instancedMesh'){const mesh=new THREE.InstancedMesh(...child.props.args as [THREE.BufferGeometry,THREE.Material,number]);child.props.ref(mesh);meshes.push(mesh);}
    if(child.props.name==='selected-landscape-animal'){ring=new THREE.Mesh();child.props.ref.current=ring;}
  }
  const anchor={...animal.anchor};
  mounted.flushEffects();mounted.frame({},1/60);
  const source=audio.get(`fauna:${animal.animalId}`)();
  const expected=runtime.wildsSiteRuntimeGroundY(siteRuntime,'wildz.space.outer.v1',source.position.x,source.position.z,p.y);
  assert.equal(source.position.y,expected,'spatial audio must follow the animal on the mountain');
  assert.ok(Math.abs(ring!.position.y-(expected-(p.y+10)+.025))<1e-6,'selection must follow its visible body');
  const limb=meshes.find(m=>m.geometry.type==='CylinderGeometry'&&m.material===meshes[5].material)!;
  const matrix=new THREE.Matrix4();let minY=Infinity;
  for(let i=0;i<limb.count;i++){limb.getMatrixAt(i,matrix);minY=Math.min(minY,matrix.elements[13]);}
  assert.ok(minY>-.5,'feet must not remain ten metres inside the mountain');
  assert.deepEqual(animal.anchor,anchor,'presentation cannot rewrite the canonical animal');
  mounted.unmount();
});
