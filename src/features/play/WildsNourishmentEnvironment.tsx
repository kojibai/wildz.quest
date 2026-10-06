'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { KAI_PULSE_DURATION_MS } from './kai-klok-moment';
import { projectWildsWildAnimalPosition } from './wilds-animal-ecology';
import { drawWildsFauna, type WildsFaunaPart } from './wilds-fauna-model';
import { projectWildsFruitAttachments } from './wilds-nourishment-visuals';
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
  onGather?: (plant: WildsNourishmentPlantProjection) => void;
  onInspect?: (animal: WildsWildAnimalProjection | WildsOwnedLivestockProjection) => void;
  onHunt?: (animal: WildsWildAnimalProjection) => void;
  onCapture?: (animal: WildsWildAnimalProjection) => void;
  onProduce?: (animal: WildsOwnedLivestockProjection) => void;
}>;
const CAPACITY=1536;
const DETAIL={low:{plants:24,animals:6,livestock:3,segments:8,rings:6},medium:{plants:32,animals:10,livestock:4,segments:10,rings:6},high:{plants:48,animals:12,livestock:6,segments:12,rings:8}};
type Shape = WildsFaunaPart | 'apple' | 'leaf';
type Pick = { kind:'plant'; plant:WildsNourishmentPlantProjection } | { kind:'animal'; animal:WildsWildAnimalProjection | WildsOwnedLivestockProjection };
type Batch = { mesh:THREE.InstancedMesh | null; count:number; picks:Pick[] };
const SHAPES: Shape[]=['body','limb','tip','apple','leaf'];
const ANIMAL_SHAPES: WildsFaunaPart[]=['body','limb','tip'];
function batches(): Record<Shape, Batch> {
  const batch = (): Batch => ({ mesh: null, count: 0, picks: [] });
  return { body: batch(), limb: batch(), tip: batch(), apple: batch(), leaf: batch() };
}

/** Static crops and moving fauna use bounded, shared meshes. No state publication per frame. */
export function WildsNourishmentEnvironment(props: WildsNourishmentEnvironmentProps) {
  const quality=props.qualityTier??'medium';
  const latest=useRef(props), plants=useRef(batches()), animals=useRef(batches());
  const time=useRef({observedKai:props.kaiUPulse,elapsed:0,draw:0});
  const transform=useMemo(()=>new THREE.Object3D(),[]), color=useMemo(()=>new THREE.Color(),[]);
  const resourcePlacements=useMemo(createWildsResourcePlacementProjector,[]);
  const residentLivestock=useMemo(() => (props.livestock??[])
    .map(animal=>({animal,distance:Math.hypot(animal.position.x-props.origin.x,animal.position.z-props.origin.z)}))
    .filter(row=>row.animal.spaceId===(props.spaceId??'wildz.space.outer.v1')&&row.distance<=72)
    .sort((a,b)=>a.distance-b.distance||a.animal.animalId.localeCompare(b.animal.animalId))
    .slice(0,DETAIL[quality].livestock).map(row=>row.animal),
    [props.livestock,props.origin.x,props.origin.z,props.spaceId,quality]);
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
  useEffect(()=>()=>{Object.values(resources.geometries).forEach(g=>g.dispose());resources.animalMaterial.dispose();resources.plantMaterial.dispose();resources.fruitMaterial.dispose();resources.textures.forEach(t=>t.dispose());},[resources]);
  const write=(collection:Record<Shape,Batch>, shape:Shape, p:{x:number;y:number;z:number}, scale:[number,number,number], tone:string, pick:Pick, rotation:[number,number,number]=[0,0,0])=>{
    const batch=collection[shape], mesh=batch.mesh;
    if(!mesh||batch.count>=CAPACITY) return;
    transform.position.set(p.x-latest.current.origin.x,p.y-latest.current.origin.y,p.z-latest.current.origin.z);
    transform.scale.set(...scale);transform.rotation.set(rotation[0],rotation[1],rotation[2],'YXZ');transform.updateMatrix();
    mesh.setMatrixAt(batch.count,transform.matrix);mesh.setColorAt(batch.count,color.set(tone));batch.picks[batch.count++]=pick;
  };
  const reset=(collection:Record<Shape,Batch>,shapes:readonly Shape[])=>shapes.forEach(shape=>{collection[shape].count=0;});
  const finish=(collection:Record<Shape,Batch>,shapes:readonly Shape[])=>shapes.forEach(shape=>{
    const batch=collection[shape];batch.picks.length=batch.count;
    if(batch.mesh){batch.mesh.count=batch.count;batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.boundingSphere=null;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;}
  });
  const drawPlants=()=>{
    const current=latest.current, outer=!current.spaceId||current.spaceId==='wildz.space.outer.v1';reset(plants.current,SHAPES);
    if(outer) for(const plant of (current.plants??[]).slice(0,DETAIL[current.qualityTier??'medium'].plants)) {
      const pick:Pick={kind:'plant',plant}, p=plant.position;
      const ground=current.siteRuntime?wildsSiteRuntimeGroundY(current.siteRuntime,current.spaceId??'wildz.space.outer.v1',p.x,p.z,p.y):p.y;
      const add=(shape:Shape,x:number,y:number,z:number,sx:number,sy:number,sz:number,tone:string,tilt=0,heading=0,roll=0)=>write(plants.current,shape,{x,y,z},[sx,sy,sz],tone,pick,[tilt,heading,roll]);
      if(plant.kind==='fruit-tree') {
        const tree=wildsTerrainObstaclesForTile(Math.floor(p.x/WILDS_TERRAIN_TILE_SIZE),Math.floor(p.z/WILDS_TERRAIN_TILE_SIZE)).find(o=>o.id===plant.terrainTreeId);
        if(!tree)continue;
        const placement=resourcePlacements([tree],current.harvestedSources,current.kaiUPulse,null).trees[0]!;
        for(const [index,fruit] of projectWildsFruitAttachments(plant,placement,plant.remaining).entries()) {
          const fp={...fruit.position,y:fruit.position.y+ground-p.y},r=fruit.radius;
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
    const drawAnimal=(animal:WildsWildAnimalProjection|WildsOwnedLivestockProjection,p:{x:number;y:number;z:number},heading:number,gait:number,moving:boolean,grazing:boolean)=>{
      const pick:Pick={kind:'animal',animal},cos=Math.cos(heading),sin=Math.sin(heading);
      drawWildsFauna(animal.species,gait,moving,grazing,(shape,x,y,z,sx,sy,sz,tone,tilt=0,roll=0)=>{
        write(animals.current,shape,{x:p.x+x*cos+z*sin,y:p.y+y,z:p.z+z*cos-x*sin},[sx,sy,sz],tone,pick,[tilt,heading,roll]);
      });
    };
    if(outer) for(const animal of (current.animals??[]).filter(a=>a.status==='wild').slice(0,DETAIL[current.qualityTier??'medium'].animals)) {
      const motion=projectWildsWildAnimalPosition(animal,kai);drawAnimal(animal,motion.position,motion.heading,motion.gait,motion.moving,motion.grazing);
    }
    for(const [index,animal] of residentLivestock.entries()) {
      // Farm animals have the same gait; a small local stroll stays inside their shelter.
      const seconds=(kai%40_000_000)/1_000_000*KAI_PULSE_DURATION_MS/1000,progress=((seconds/24+index*.37)%1);
      const moving=progress<.8,travel=moving?progress/.8:1,angle=(travel-Math.sin(travel*Math.PI*2)/(Math.PI*2))*Math.PI*2+index*2.399;
      drawAnimal(animal,{...animal.position,x:animal.position.x+Math.cos(angle)*.35,z:animal.position.z+Math.sin(angle)*.35},-angle,
        seconds*(animal.species==='ground-bird'?12:7),moving,!moving);
    }
    finish(animals.current,ANIMAL_SHAPES);
  };
  useLayoutEffect(()=>{
    latest.current=props;
    if(time.current.observedKai!==props.kaiUPulse)time.current={observedKai:props.kaiUPulse,elapsed:0,draw:0};
    drawPlants();drawAnimals(props.kaiUPulse);
  });
  useFrame((_,delta)=>{
    time.current.elapsed+=delta;time.current.draw+=delta;
    if(time.current.draw<.05||(!(latest.current.animals?.length)&&!(latest.current.livestock?.length)))return;
    time.current.draw=0;
    drawAnimals(time.current.observedKai+Math.floor(time.current.elapsed*1000/KAI_PULSE_DURATION_MS*1_000_000));
  });
  const activate=(event:ThreeEvent<MouseEvent>,collection:Record<Shape,Batch>,shape:Shape)=>{
    const pick=event.instanceId===undefined?undefined:collection[shape].picks[event.instanceId];if(!pick)return;event.stopPropagation();
    if(pick.kind==='plant'){if(pick.plant.canGather)latest.current.onGather?.(pick.plant);}
    else latest.current.onInspect?.(pick.animal);
  };
  return <group name="wilds-nourishment-landscape">
    {SHAPES.map(shape=><instancedMesh key={`plant-${shape}`} name={`nourishment-plants-${shape}`} ref={mesh=>{plants.current[shape].mesh=mesh;}} args={[resources.geometries[shape],shape==='apple'?resources.fruitMaterial:resources.plantMaterial,CAPACITY]} frustumCulled={false} userData={{nourishment:true}} castShadow receiveShadow onClick={event=>activate(event,plants.current,shape)} />)}
    {ANIMAL_SHAPES.map(shape=><instancedMesh key={`animal-${shape}`} name={`landscape-fauna-${shape}`} ref={mesh=>{animals.current[shape].mesh=mesh;mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}} args={[resources.geometries[shape],resources.animalMaterial,CAPACITY]} frustumCulled={false} userData={{nourishment:true}} castShadow receiveShadow onClick={event=>activate(event,animals.current,shape)} />)}
  </group>;
}
