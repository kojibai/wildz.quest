'use client';

import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { WildsEmbodiedAudioContext } from './WildsEmbodiedAudioContext';
import type { WildsEmbodiedSource } from './wilds-embodied-audio';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createWildsKaiRuntimeClock } from './wilds-kai-runtime';
import { projectWildsWildAnimalPosition, type WildsWildAnimal } from './wilds-animal-ecology';
import { WildsAnimalHuntEffect } from './WildsAnimalHuntEffect';
import { createWildsHuntAnimationFrame, writeWildsHuntAnimationFrame, type WildsAnimalHuntPresentation, type WildsHuntAnimationFrame } from './wilds-animal-interaction';
import { projectWildsFaunaMotion, type WildsFaunaLifePose } from './wilds-fauna-motion';
import { drawWildsFauna, type WildsFaunaPart } from './wilds-fauna-model';
import { createWildsNourishmentPlantRenderCache, projectWildsFruitAttachments, type WildsNourishmentPlantRenderRow } from './wilds-nourishment-visuals';
import { createWildsFruitTouchRaycast } from './wilds-nourishment-picking';
import { createWildsAppleGeometry, createWildsFoodLeafGeometry, createWildsNourishmentTexture } from './wilds-nourishment-materials';
import { wildsTerrainObstaclesForTile } from './wilds-terrain-obstacles';
import { WILDS_TERRAIN_TILE_SIZE } from './wilds-terrain-authority';
import { createWildsResourcePlacementProjector } from './wilds-resource-placements';
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from './wilds-site-runtime';
import type { WildsQualityTier } from './wilds-quality-profile';
import type { WildsWorldProjection } from './wilds-world-state';
import type { WildsNourishmentPlantProjection, WildsWildAnimalProjection, WildsOwnedLivestockProjection } from './WildsNourishmentPanel';

export type WildsNourishmentEnvironmentProps = Readonly<{
  plants?: readonly WildsNourishmentPlantProjection[];
  animals?: readonly WildsWildAnimalProjection[];
  livestock?: readonly WildsOwnedLivestockProjection[];
  origin: Readonly<{ x: number; y: number; z: number }>;
  kaiUPulse: number;
  spaceId?: string;
  qualityTier?: WildsQualityTier;
  harvestedSources?: WildsWorldProjection['harvestedSources'];
  siteRuntime?: WildsSiteRuntimeProjection;
  selectedAnimalId?: string | null;
  hunt?: WildsAnimalHuntPresentation | null;
  reducedMotion?: boolean;
  onGather?: (plant: WildsNourishmentPlantProjection) => void;
  onInspect?: (source: WildsNourishmentPlantProjection | WildsWildAnimalProjection | WildsOwnedLivestockProjection) => void;
  onHunt?: (animal: WildsWildAnimalProjection) => void;
  onCapture?: (animal: WildsWildAnimalProjection) => void;
  onProduce?: (animal: WildsOwnedLivestockProjection) => void;
}>;
const CAPACITY=1536;
const DETAIL={low:{plants:24,animals:6,livestock:3,segments:8,rings:6},medium:{plants:32,animals:10,livestock:4,segments:10,rings:6},high:{plants:48,animals:12,livestock:6,segments:12,rings:8}};
type Shape = WildsFaunaPart | 'apple' | 'leaf';
type Pick = { kind:'plant'; plant:WildsNourishmentPlantProjection } | { kind:'animal'; animal:WildsWildAnimalProjection | WildsOwnedLivestockProjection } | { kind:'hunt' };
type Batch = { mesh:THREE.InstancedMesh | null; count:number; picks:Pick[]; tones:string[]; colorsChanged:boolean };
const SHAPES: Shape[]=['body','limb','tip','apple','leaf'];
const ANIMAL_SHAPES: WildsFaunaPart[]=['body','limb','tip'];
function batches(): Record<Shape, Batch> {
  const batch = (): Batch => ({ mesh: null, count: 0, picks: [], tones: [], colorsChanged: false });
  return { body: batch(), limb: batch(), tip: batch(), apple: batch(), leaf: batch() };
}

/** Static crops and moving fauna use bounded, shared meshes. No state publication per frame. */
export function WildsNourishmentEnvironment(props: WildsNourishmentEnvironmentProps) {
  const quality=props.qualityTier??'medium';
  const audioRegistry=useContext(WildsEmbodiedAudioContext);
  const audioPositions=useRef(new Map<string,WildsEmbodiedSource>());
  const latest=useRef(props), plants=useRef(batches()), animals=useRef(batches());
  const sceneOrigin=useRef({ ...props.origin });
  const sceneGroup=useRef<THREE.Group>(null);
  const selectionRing=useRef<THREE.Mesh>(null);
  const renderedSelection=useRef(props.selectedAnimalId);
  const renderedHunt=useRef<WildsAnimalHuntPresentation|null|undefined>(undefined);
  const huntFrame=useMemo(createWildsHuntAnimationFrame,[]);
  const huntPick=useMemo<Pick>(()=>({kind:'hunt'}),[]);
  const plantPicks=useRef(new Map<string, Extract<Pick,{kind:'plant'}>>());
  const animalPicks=useRef(new Map<string, Extract<Pick,{kind:'animal'}>>());
  const retainPlantRows=useMemo(createWildsNourishmentPlantRenderCache,[]);
  const renderedPlants=useRef<readonly WildsNourishmentPlantRenderRow[]|null>(null);
  const renderedAnimals=useRef<readonly (WildsWildAnimalProjection|WildsOwnedLivestockProjection)[]>([]);
  const fruitTouchRadii=useRef<number[]>([]);
  const fruitRaycast=useMemo(()=>createWildsFruitTouchRaycast(fruitTouchRadii.current),[]);
  const time=useRef<{observedKai:number;clock:ReturnType<typeof createWildsKaiRuntimeClock>|null;lastDraw:number}>({observedKai:props.kaiUPulse,clock:null,lastDraw:0});
  const transform=useMemo(()=>new THREE.Object3D(),[]), color=useMemo(()=>new THREE.Color(),[]);
  const resourcePlacements=useMemo(createWildsResourcePlacementProjector,[]);
  const residentLivestock=useMemo(() => (props.livestock??[])
    .map(animal=>({animal,distance:Math.hypot(animal.position.x-props.origin.x,animal.position.z-props.origin.z)}))
    .filter(row=>row.animal.spaceId===(props.spaceId??'wildz.space.outer.v1')&&row.distance<=72)
    .sort((a,b)=>a.distance-b.distance||a.animal.animalId.localeCompare(b.animal.animalId))
    .slice(0,DETAIL[quality].livestock).map(row=>row.animal),
    [props.livestock,props.origin.x,props.origin.z,props.spaceId,quality]);
  useEffect(()=>{
    if(!audioRegistry)return;
    const positions=audioPositions.current;
    const sources=[...(props.animals??[]).filter(a=>a.status==='wild').slice(0,DETAIL[quality].animals),...residentLivestock];
    const retained=new Set(sources.map(animal=>animal.animalId));
    for(const id of positions.keys())if(!retained.has(id))positions.delete(id);
    const readers=sources.map(animal=>{
      const id=`fauna:${animal.animalId}`,read=()=>positions.get(animal.animalId)??null;
      audioRegistry.set(id,read);return {id,read};
    });
    return ()=>{for(const {id,read} of readers)if(audioRegistry.get(id)===read)audioRegistry.delete(id);};
  },[audioRegistry,props.animals,residentLivestock,quality]);
  const resources=useMemo(()=>{
    const coat=createWildsNourishmentTexture('coat'), fruit=createWildsNourishmentTexture('fruit'), leaf=createWildsNourishmentTexture('leaf');
    // Instance colors do not require a vertex-color attribute. Enabling vertexColors on
    // these uncolored geometries would multiply every instance by a zero attribute.
    return {
      geometries:{body:new THREE.SphereGeometry(1,DETAIL[quality].segments,DETAIL[quality].rings),limb:new THREE.CylinderGeometry(.8,1,1,8),tip:new THREE.ConeGeometry(1,1,8),apple:createWildsAppleGeometry(),leaf:createWildsFoodLeafGeometry()},
      animalMaterial:new THREE.MeshStandardMaterial({color:'#ffffff',map:coat,roughness:.94}),
      plantMaterial:new THREE.MeshStandardMaterial({color:'#ffffff',map:leaf,roughness:.88,side:THREE.DoubleSide}),
      fruitMaterial:new THREE.MeshStandardMaterial({color:'#ffffff',map:fruit,roughness:.48}), textures:[coat,fruit,leaf]
    };
  },[quality]);
  const renderedResources=useRef(resources);
  useEffect(()=>()=>{Object.values(resources.geometries).forEach(g=>g.dispose());resources.animalMaterial.dispose();resources.plantMaterial.dispose();resources.fruitMaterial.dispose();resources.textures.forEach(t=>t.dispose());},[resources]);
  const write=(collection:Record<Shape,Batch>, shape:Shape, p:{x:number;y:number;z:number}, scale:[number,number,number], tone:string, pick:Pick, rotation:[number,number,number]=[0,0,0])=>{
    const batch=collection[shape], mesh=batch.mesh;
    if(!mesh||batch.count>=CAPACITY) return;
    transform.position.set(p.x-sceneOrigin.current.x,p.y-sceneOrigin.current.y,p.z-sceneOrigin.current.z);
    transform.scale.set(...scale);transform.rotation.set(rotation[0],rotation[1],rotation[2],'YXZ');transform.updateMatrix();
    mesh.setMatrixAt(batch.count,transform.matrix);
    if(batch.tones[batch.count]!==tone){mesh.setColorAt(batch.count,color.set(tone));batch.tones[batch.count]=tone;batch.colorsChanged=true;}
    batch.picks[batch.count++]=pick;
  };
  const reset=(collection:Record<Shape,Batch>,shapes:readonly Shape[])=>shapes.forEach(shape=>{collection[shape].count=0;collection[shape].colorsChanged=false;});
  const finish=(collection:Record<Shape,Batch>,shapes:readonly Shape[])=>shapes.forEach(shape=>{
    const batch=collection[shape];batch.picks.length=batch.count;
    if(batch.mesh){
      batch.mesh.count=batch.count;
      batch.mesh.instanceMatrix.clearUpdateRanges();
      if(batch.count)batch.mesh.instanceMatrix.addUpdateRange(0,batch.count*16);
      batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.boundingSphere=null;
      if(batch.colorsChanged&&batch.mesh.instanceColor){
        batch.mesh.instanceColor.clearUpdateRanges();
        if(batch.count)batch.mesh.instanceColor.addUpdateRange(0,batch.count*3);
        batch.mesh.instanceColor.needsUpdate=true;
      }
    }
  });
  const drawPlants=(rows:readonly WildsNourishmentPlantRenderRow[])=>{
    reset(plants.current,SHAPES);
    fruitTouchRadii.current.length=0;
    for(const {plant,groundY:ground,tree:placement} of rows) {
      const pick=plantPicks.current.get(plant.sourceId)!, p=plant.position;
      const add=(shape:Shape,x:number,y:number,z:number,sx:number,sy:number,sz:number,tone:string,tilt=0,heading=0,roll=0)=>write(plants.current,shape,{x,y,z},[sx,sy,sz],tone,pick,[tilt,heading,roll]);
      if(plant.kind==='fruit-tree') {
        if(!placement)continue;
        for(const [index,fruit] of projectWildsFruitAttachments(plant,placement,plant.remaining).entries()) {
          const fp={...fruit.position,y:fruit.position.y+ground-p.y},r=fruit.radius;
          fruitTouchRadii.current[plants.current.apple.count]=fruit.touchRadius;
          add('apple',fp.x,fp.y,fp.z,r,r,r,index%2?'#bbd05c':'#cf4a32',fruit.fallen?.8:0,index*.8);
          add('limb',fp.x,fp.y+r*.9,fp.z,.009,.045,.009,'#715132',.18);
          add('leaf',fp.x+.025,fp.y+r*1.08,fp.z,.021,.037,.018,'#4e7433',-.6,.6,.8);
        }
      } else if(plant.kind==='berry-bush') {
        add('body',p.x,ground+.2,p.z,.3,.24,.3,plant.remaining?'#3e663b':'#556048');
        for(let branch=0;branch<5;branch++) {
          const a=branch*2.399,x=p.x+Math.cos(a)*.23,z=p.z+Math.sin(a)*.23;
          add('limb',x,ground+.23,z,.012,.33,.012,'#756244',.3,a);
          add('leaf',x,ground+.35,z,.07,.14,.05,'#558743',.7,a,.3);
        }
        for(let item=0;item<plant.remaining;item++) for(let berry=0;berry<3;berry++) {
          const a=item*2.399;add('body',p.x+Math.cos(a)*.25+(berry-1)*.024,ground+.37+berry*.018,p.z+Math.sin(a)*.25,.027,.029,.027,'#b94457');
        }
      } else for(let item=0;item<plant.remaining;item++) {
        const x=p.x+(item-.5)*.24;
        add('body',x,ground+.035,p.z,.057,.065,.057,'#c4a675');
        for(let leaf=0;leaf<5;leaf++)add('leaf',x,ground+.14,p.z,.043,.12,.04,leaf%2?'#508e40':'#73a550',.8,leaf*2.399,.2);
      }
    }
    finish(plants.current,SHAPES);
  };
  const drawAnimals=(kai:number)=>{
    const current=latest.current,outer=!current.spaceId||current.spaceId==='wildz.space.outer.v1';reset(animals.current,ANIMAL_SHAPES);
    if(selectionRing.current)selectionRing.current.visible=false;
    const drawAnimal=(animal:WildsWildAnimal,p:{x:number;y:number;z:number},heading:number,gait:number,moving:boolean,grazing:boolean,pose:WildsFaunaLifePose,effect?:WildsHuntAnimationFrame,overridePick?:Pick)=>{
      const pick=overridePick??animalPicks.current.get(animal.animalId),cos=Math.cos(heading),sin=Math.sin(heading);
      if(!pick)return;
      const groundY=current.siteRuntime?wildsSiteRuntimeGroundY(current.siteRuntime,current.spaceId??'wildz.space.outer.v1',p.x,p.z,p.y):p.y;
      if(audioRegistry&&!effect){
        let audio=audioPositions.current.get(animal.animalId);
        if(!audio){audio={id:`fauna:${animal.animalId}`,kind:animal.species==='ground-bird'?'bird':'animal',position:{...p},spaceId:current.spaceId??'wildz.space.outer.v1',active:true,locomotion:'ground'};audioPositions.current.set(animal.animalId,audio);}
        Object.assign(audio.position,p);audio.position.y=groundY;audio.spaceId=current.spaceId??'wildz.space.outer.v1';audio.updatedAt=time.current.lastDraw;
      }
      const size=effect?.scale??1,lean=effect?.lean??0,cosLean=Math.cos(lean),sinLean=Math.sin(lean);
      if(selectionRing.current&&current.selectedAnimalId===animal.animalId&&!effect){selectionRing.current.visible=true;selectionRing.current.position.set(p.x-sceneOrigin.current.x,groundY-sceneOrigin.current.y+.025,p.z-sceneOrigin.current.z);selectionRing.current.scale.setScalar(animal.species==='meadow-goat'?.55:.32);}
      drawWildsFauna(animal.species,gait,moving,grazing,(shape,x,y,z,sx,sy,sz,tone,tilt=0,roll=0,yaw=0)=>{
        const localY=(y*cosLean-z*sinLean)*size,localZ=(y*sinLean+z*cosLean)*size,localX=x*size;
        write(animals.current,shape,{x:p.x+localX*cos+localZ*sin,y:groundY+localY+(effect?.lift??0),z:p.z+localZ*cos-localX*sin},[sx*size,sy*size,sz*size],tone,pick,[tilt+lean,heading+yaw,roll]);
      },pose);
    };
    if(outer) for(const animal of (current.animals??[]).filter(a=>a.status==='wild').slice(0,DETAIL[current.qualityTier??'medium'].animals)) {
      const motion=projectWildsWildAnimalPosition(animal,kai);drawAnimal(animal,motion.position,motion.heading,motion.gait,motion.moving,motion.grazing,motion.pose);
    }
    for(const animal of residentLivestock) {
      // The same individual behavior stays inside the farm's existing local extent.
      const motion=projectWildsFaunaMotion(animal.animalId,animal.species,kai,.35);
      drawAnimal(animal,{...animal.position,x:animal.position.x+motion.offset.x,z:animal.position.z+motion.offset.z},
        motion.heading,motion.gait,motion.moving,motion.grazing,motion.pose);
    }
    if(current.hunt&&current.hunt.spaceId===(current.spaceId??'wildz.space.outer.v1')){
      writeWildsHuntAnimationFrame(huntFrame,performance.now()-current.hunt.startedAtMs,current.reducedMotion);
      if(huntFrame.active)drawAnimal(current.hunt.animal,current.hunt.position,current.hunt.heading,current.hunt.gait,false,false,current.hunt.pose,huntFrame,huntPick);
    }
    finish(animals.current,ANIMAL_SHAPES);
  };
  useLayoutEffect(()=>{
    latest.current=props;
    const resourcesChanged=renderedResources.current!==resources;
    const originChanged=Math.abs(sceneOrigin.current.x-props.origin.x)>128
      ||Math.abs(sceneOrigin.current.y-props.origin.y)>128||Math.abs(sceneOrigin.current.z-props.origin.z)>128;
    if(originChanged){sceneOrigin.current={...props.origin};sceneGroup.current?.position.set(0,0,0);renderedPlants.current=null;}
    if(resourcesChanged){
      renderedResources.current=resources;renderedPlants.current=null;
      for(const collection of [plants.current,animals.current])for(const shape of SHAPES)collection[shape].tones=[];
    }
    const now=performance.now();
    let clock=time.current.clock;
    const clockChanged=!clock||time.current.observedKai!==props.kaiUPulse;
    if(clockChanged) {
      const floor=clock?.read(now)??props.kaiUPulse;
      clock=createWildsKaiRuntimeClock({baselineUPulse:props.kaiUPulse,baselineElapsedMs:now,floorUPulse:floor});
      time.current={observedKai:props.kaiUPulse,clock,lastDraw:now};
    }
    const outer=!props.spaceId||props.spaceId==='wildz.space.outer.v1';
    const visiblePlants=outer?(props.plants??[]).slice(0,DETAIL[quality].plants):[];
    const nextPlantPicks=new Map<string, Extract<Pick,{kind:'plant'}>>();
    const rows=retainPlantRows(visiblePlants.map(plant=>{
      const pick=plantPicks.current.get(plant.sourceId)??{kind:'plant' as const,plant};
      pick.plant=plant;nextPlantPicks.set(plant.sourceId,pick);
      const p=plant.position;
      const groundY=props.siteRuntime?wildsSiteRuntimeGroundY(props.siteRuntime,props.spaceId??'wildz.space.outer.v1',p.x,p.z,p.y):p.y;
      const obstacle=plant.kind==='fruit-tree'?wildsTerrainObstaclesForTile(Math.floor(p.x/WILDS_TERRAIN_TILE_SIZE),Math.floor(p.z/WILDS_TERRAIN_TILE_SIZE)).find(o=>o.id===plant.terrainTreeId):undefined;
      return {plant,groundY,tree:obstacle?resourcePlacements([obstacle],props.harvestedSources,props.kaiUPulse,null).trees[0]:undefined};
    }));
    plantPicks.current=nextPlantPicks;
    if(renderedPlants.current!==rows){renderedPlants.current=rows;drawPlants(rows);}
    const visibleAnimals=[...(outer?(props.animals??[]).filter(a=>a.status==='wild').slice(0,DETAIL[quality].animals):[]),...residentLivestock];
    const nextAnimalPicks=new Map<string, Extract<Pick,{kind:'animal'}>>();
    for(const animal of visibleAnimals){const pick=animalPicks.current.get(animal.animalId)??{kind:'animal' as const,animal};pick.animal=animal;nextAnimalPicks.set(animal.animalId,pick);}
    animalPicks.current=nextAnimalPicks;
    const animalChanged=visibleAnimals.length!==renderedAnimals.current.length||visibleAnimals.some((animal,index)=>{
      const prior=renderedAnimals.current[index]!;
      return animal.animalId!==prior.animalId||animal.species!==prior.species||animal.position.x!==prior.position.x||animal.position.y!==prior.position.y||animal.position.z!==prior.position.z;
    });
    renderedAnimals.current=visibleAnimals;
    const presentationChanged=renderedHunt.current!==props.hunt||renderedSelection.current!==props.selectedAnimalId;
    renderedHunt.current=props.hunt;renderedSelection.current=props.selectedAnimalId;
    if(clockChanged||animalChanged||resourcesChanged||originChanged||presentationChanged){time.current.lastDraw=now;drawAnimals(clock!.read(now));}
  });
  useFrame(()=>{
    const now=performance.now();
    if(!time.current.clock||(!renderedAnimals.current.length&&!latest.current.hunt))return;
    time.current.lastDraw=now;
    drawAnimals(time.current.clock.read(now));
  });
  const activate=(event:ThreeEvent<MouseEvent>,collection:Record<Shape,Batch>,shape:Shape)=>{
    const pick=event.instanceId===undefined?undefined:collection[shape].picks[event.instanceId];if(!pick)return;event.stopPropagation();
    if(pick.kind==='hunt')return;
    if(pick.kind==='plant'){if(latest.current.onInspect)latest.current.onInspect(pick.plant);else if(pick.plant.canGather)latest.current.onGather?.(pick.plant);}
    else latest.current.onInspect?.(pick.animal);
  };
  return <group ref={sceneGroup} name="wilds-nourishment-landscape" position={[sceneOrigin.current.x-props.origin.x,sceneOrigin.current.y-props.origin.y,sceneOrigin.current.z-props.origin.z]}>
    {SHAPES.map(shape=><instancedMesh key={`plant-${shape}`} name={`nourishment-plants-${shape}`} ref={mesh=>{plants.current[shape].mesh=mesh;}} args={[resources.geometries[shape],shape==='apple'?resources.fruitMaterial:resources.plantMaterial,CAPACITY]} raycast={shape==='apple'?fruitRaycast:undefined} frustumCulled={false} userData={{nourishment:true}} castShadow receiveShadow onClick={event=>activate(event,plants.current,shape)} />)}
    {ANIMAL_SHAPES.map(shape=><instancedMesh key={`animal-${shape}`} name={`landscape-fauna-${shape}`} ref={mesh=>{animals.current[shape].mesh=mesh;mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}} args={[resources.geometries[shape],resources.animalMaterial,CAPACITY]} frustumCulled={false} userData={{nourishment:true}} castShadow receiveShadow onClick={event=>activate(event,animals.current,shape)} />)}
    <mesh ref={selectionRing} name="selected-landscape-animal" visible={false} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><torusGeometry args={[1,.027,6,28]} /><meshBasicMaterial color="#dfebae" transparent opacity={.72} depthWrite={false} /></mesh>
    {props.hunt?<WildsAnimalHuntEffect hunt={props.hunt} origin={sceneOrigin} reducedMotion={props.reducedMotion??false} siteRuntime={props.siteRuntime}/>:null}
  </group>;
}
