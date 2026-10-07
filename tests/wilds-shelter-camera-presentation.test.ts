import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import * as THREE from 'three';
import {projectWildsTerrainActorPosition} from '../src/features/play/wilds-terrain-rendering';
import {wildsConstructionOccludesCamera} from '../src/features/play/wilds-construction-camera';

test('prefab shelter roof cuts away for an overhead camera and returns for an interior side view',()=>{
  const source=readFileSync('src/features/play/WildsStewardEnvironment.tsx','utf8'),frames:((state:unknown,delta:number)=>void)[]=[];
  const body=source.slice(source.indexOf('function TrailShelter('),source.indexOf('\nfunction TrailBridge(')),exports={TrailShelter:null as unknown as (props:unknown)=>any};
  const scope={exports,THREE,Shared:'Shared',projectWildsTerrainActorPosition,wildsConstructionOccludesCamera,
    useRef:(current:unknown)=>({current}),useMemo:(factory:()=>unknown)=>factory(),useFrame:(callback:typeof frames[number])=>frames.push(callback),
    writeConstructionStage(group:THREE.Group|null,progress:number,start:number,end:number){if(group){group.visible=progress>start;group.scale.set(1,Math.max(.035,Math.min(1,(progress-start)/(end-start))),1);}},
    require:(name:string)=>{if(name==='react/jsx-runtime')return {jsx:(type:unknown,props:unknown)=>({type,props}),jsxs:(type:unknown,props:unknown)=>({type,props})};throw Error(name);}
  };
  const output=ts.transpileModule(body+'\nexports.TrailShelter=TrailShelter;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  Function(...Object.keys(scope),output)(...Object.values(scope));
  const roofGeometry=new THREE.ConeGeometry(4.2,1.25,4),material=new THREE.MeshStandardMaterial(),geometry={roof:roofGeometry,foundation:new THREE.BoxGeometry(5.6,.4,4.8),post:new THREE.CylinderGeometry(.16,.2,2.5,8),beam:new THREE.BoxGeometry(5.4,.22,.28)};
  const element=exports.TrailShelter({geometry,materials:{roof:material,wood:material,foundation:material},player:{x:137,z:-63},structure:{position:{x:137,y:11,z:-63},rotationQuarterTurns:1,structureId:'fixture'},terrainElevation:11});
  let roof:THREE.Mesh|null=null;
  function mount(node:any):THREE.Object3D{
    const props=node.props,object=node.type==='group'?new THREE.Group():new THREE.Mesh(props.geometry,props.material);
    if(props.position)object.position.set(...props.position as [number,number,number]);if(props.rotation)object.rotation.set(...props.rotation as [number,number,number]);if(props.scale)object.scale.set(...props.scale as [number,number,number]);
    if(props.visible!==undefined)object.visible=props.visible;if(props.ref)props.ref.current=object;if(props.geometry===roofGeometry)roof=object as THREE.Mesh;
    for(const child of [props.children].flat(Infinity).filter(Boolean))object.add(mount(child));return object;
  }
  const root=mount(element),camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(0,.9,0)};root.updateMatrixWorld(true);
  camera.position.set(0,6,0);for(let frame=0;frame<120;frame++)frames.forEach(write=>write({camera,controls},1/30));
  assert.equal(roof!.visible,false,'overhead roof must not cover the player when the camera zooms out');
  camera.position.set(0,1.5,-1.2);frames.forEach(write=>write({camera,controls},1/30));assert.equal(roof!.visible,true,'roof must return for a clear interior view');
  assert.equal(roof!.geometry,roofGeometry);assert.equal(roof!.material,material);
});
