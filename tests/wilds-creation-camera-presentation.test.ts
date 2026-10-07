import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';
import {createCreationRenderGeometry,creationRenderUploadBytes} from '../src/features/play/creation/render-geometry';
import {compileCreation,type CreationChunk} from '../src/features/play/creation/compiler';
import {prepareCreationCameraCutaway} from '../src/features/play/creation/camera-presentation';
import {creationDefinitionFixture,creationContextFixture} from './support/creation-fixtures';
import {proposeLocalCreation} from '../src/lib/receiz/wilds-local-creation-planner';

const origin={x:137,y:11,z:-63},yaw=.61;
const turn=(x:number,y:number,z:number)=>new THREE.Vector3(x*Math.cos(yaw)+z*Math.sin(yaw),y,-x*Math.sin(yaw)+z*Math.cos(yaw));
function room(){
  const result=compileCreation(creationDefinitionFixture(),creationContextFixture({pose:{position:origin,yaw}}));
  assert.equal(result.status,'ready');if(result.status!=='ready')throw Error('fixture');return result.plan.chunks[0];
}
function mountPage(chunk:CreationChunk,{viewer=origin,strictMemo=false}:{viewer?:{x:number;y:number;z:number};strictMemo?:boolean}={}){
  let builds=0;const frames:((state:{camera:THREE.PerspectiveCamera;controls:{target:THREE.Vector3}})=>void)[]=[],refs:{current:unknown}[]=[];
  const material=new THREE.MeshStandardMaterial(),source=readFileSync('src/features/play/creation/WildsCreations.tsx','utf8');
  const body=source.slice(source.indexOf('const Page ='),source.indexOf('/** Only the admission store'));
  const exports={Page:null as unknown as (props:unknown)=>{props:{geometry:THREE.BufferGeometry;material:THREE.Material[];ref?:{current:THREE.Mesh|null}}}};
  const scope={exports,memo:(fn:unknown)=>fn,Vector3:THREE.Vector3,prepareCreationCameraCutaway,
    createCreationRenderGeometry(input:CreationChunk){builds++;return createCreationRenderGeometry(input);},
    // React StrictMode keeps the first memo result after evaluating the factory
    // a second time to expose side effects in render preparation.
    useMemo:(factory:()=>unknown)=>{const retained=factory();if(strictMemo)factory();return retained;},useEffect:()=>{},useRef:(current:unknown)=>{const ref={current};refs.push(ref);return ref;},
    useFrame:(callback:typeof frames[number])=>frames.push(callback),
    require:(name:string)=>{if(name==='react/jsx-runtime')return {jsx:(_type:unknown,props:unknown)=>({props})};throw Error(name);}
  };
  const output=ts.transpileModule(body+'\nexports.Page=Page;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  Function(...Object.keys(scope),output)(...Object.values(scope));
  const element=exports.Page({chunk,materials:{material:()=>material},onRendered:()=>{}}),geometry=element.props.geometry;
  const mesh=new THREE.Mesh(geometry,element.props.material),group=new THREE.Group();group.position.set(-viewer.x,-viewer.y,-viewer.z);group.add(mesh);
  if(element.props.ref)element.props.ref.current=mesh;
  const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(0,.9,0)};
  return {geometry,material,builds:()=>builds,frame(position:THREE.Vector3){camera.position.copy(position);frames.forEach(frame=>frame({camera,controls}));},
    count(){return geometry.groups.reduce((sum,g)=>sum+g.count,0);}
  };
}

test('prompt renderer cuts only the occluding rotated wall or roof and restores it for an open view',()=>{
  const chunk=room(),mounted=mountPage(chunk),total=chunk.positions.length/3;
  mounted.frame(turn(6,1.5,0));assert.equal(mounted.count(),total-36,'cutaway must hide the near wall while retaining floor, roof and far wall');
  const index=mounted.geometry.index,buffer=index?.array,groups=mounted.geometry.groups;
  mounted.frame(turn(0,5,0));assert.equal(mounted.count(),total-36,'a roof view must reveal the room without pulling the camera inside');
  mounted.frame(turn(0,.9,-7));assert.equal(mounted.count(),total,'the doorway must leave the complete geometry visible');
  mounted.frame(turn(0,1.5,-1.2));assert.equal(mounted.count(),total,'inside camera keeps the walls visible from within');
  assert.equal(mounted.geometry.index,index);assert.equal(mounted.geometry.index?.array,buffer);assert.equal(mounted.geometry.groups,groups);
  assert.equal(mounted.geometry.getAttribute('position').array,chunk.positions);assert.equal(mounted.geometry.getAttribute('normal').array,chunk.normals);
  assert.equal(mounted.builds(),1,'camera frames never rebuild geometry');assert.equal(mounted.geometry.groups.length,chunk.materials.length,'cutaways never add draw groups');
});

test('the real high-coordinate home cutaway updates the rendered index after StrictMode memo preparation',()=>{
  const position={x:5000,y:100,z:5000},viewer={x:5000,y:100.1,z:5001.65};
  const context=creationContextFixture({pose:{position,yaw:0},budget:{timber:20},techniques:['assembly']});
  const proposal=proposeLocalCreation({requestId:'fixture:placed-home',actorId:'fixture:creation-placement',selected:null,message:'Build a timber home with a usable bed',workers:[],context},new AbortController().signal);
  if(!('definition' in proposal))throw Error('Expected the browser fixture home');
  const compiled=compileCreation(proposal.definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture');
  assert.equal(compiled.plan.chunks.length,1);
  const chunk=compiled.plan.chunks[0],mounted=mountPage(chunk,{viewer,strictMemo:true});
  const positionInScene=new THREE.Vector3(12,3,0),index=mounted.geometry.index!;
  mounted.frame(positionInScene);
  assert.equal(mounted.count(),chunk.positions.length/3-36,'the room right wall must cut away at the exact browser coordinates');
  const live=new Set(Array.from(index.array).slice(0,mounted.count()));
  for(let vertex=108;vertex<144;vertex++)assert.equal(live.has(vertex),false,'the retained Page writer must update the index attached to its rendered geometry');
  const version=index.version;for(let frame=0;frame<120;frame++)mounted.frame(positionInScene);
  assert.equal(index.version,version,'an idle StrictMode page must not publish additional indices');
  mounted.frame(new THREE.Vector3(0,1.5,-1.1));assert.equal(mounted.count(),chunk.positions.length/3);
});

test('residency and upload accounting reserve the presentation index bytes',()=>{
  const chunk=room(),mounted=mountPage(chunk),vertices=chunk.positions.length/3;
  mounted.frame(turn(6,1.5,0));
  assert.equal(creationRenderUploadBytes(chunk),vertices*34,'each vertex uses positions, normals, UVs, and a Uint16 draw index');
  assert.equal(mounted.geometry.index?.array.byteLength,vertices*2);
});

test('mixed curved, swept, and catalog nodes keep their geometry while the room wall cuts away',()=>{
  const base=creationDefinitionFixture().nodes[0],definition=creationDefinitionFixture({nodes:[
    {...base,id:'curve',pose:{position:{x:0,y:8,z:0},yaw:0},shape:{kind:'cylinder',width:2,height:2,depth:2}},
    {...base,id:'path',material:'stone',pose:{position:{x:0,y:10,z:0},yaw:.3},shape:{kind:'sweep',width:.3,height:1,depth:1,points:[{x:0,y:0,z:0},{x:1,y:0,z:1},{x:2,y:0,z:1}]}},
    {...base,id:'catalog',material:'hay',pose:{position:{x:0,y:12,z:0},yaw:0},shape:{kind:'catalog',piece:'beam',width:2,height:.3,depth:.4}},base
  ]});
  const result=compileCreation(definition,creationContextFixture({pose:{position:origin,yaw},budget:{timber:10000,stone:10000,hay:1000}}));
  assert.equal(result.status,'ready');if(result.status!=='ready')throw Error('fixture');assert.equal(result.plan.chunks.length,1);
  const chunk=result.plan.chunks[0],mounted=mountPage(chunk);mounted.frame(turn(6,1.5,0));
  assert.equal(mounted.count(),chunk.positions.length/3-36);
  const live=new Set(Array.from(mounted.geometry.index!.array).slice(0,mounted.count())),curveStart=chunk.materials.find(group=>group.material==='timber')!.start;
  for(let vertex=curveStart;vertex<curveStart+288;vertex++)assert.ok(live.has(vertex),'curved triangles must not be mistaken for their conservative box collider');
  mounted.frame(turn(0,.9,-7));assert.equal(mounted.count(),chunk.positions.length/3);
});

test('unknown leading triangles stay visible and never misalign a later admitted box cutaway',()=>{
  const source=room(),positions=new Float32Array(source.positions.length+9),normals=new Float32Array(source.normals.length+9);
  positions.set([origin.x+20,origin.y,origin.z,origin.x+21,origin.y,origin.z,origin.x+20,origin.y,origin.z+1]);positions.set(source.positions,9);
  normals.set([0,1,0,0,1,0,0,1,0]);normals.set(source.normals,9);
  const chunk={...source,positions,normals,materials:[{...source.materials[0],count:source.materials[0].count+3}]},mounted=mountPage(chunk);
  mounted.frame(turn(6,1.5,0));assert.equal(mounted.count(),source.positions.length/3+3-36);
  const live=new Set(Array.from(mounted.geometry.index!.array).slice(0,mounted.count()));
  assert.ok(live.has(0)&&live.has(1)&&live.has(2),'unknown geometry must survive every camera mask');
  const version=mounted.geometry.index!.version;for(let frame=0;frame<120;frame++)mounted.frame(turn(6,1.5,0));
  assert.equal(mounted.geometry.index!.version,version,'an unchanged view never uploads a new draw mask');
});
