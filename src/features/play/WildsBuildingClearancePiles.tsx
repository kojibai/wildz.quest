'use client';
import {memo,useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import type {ThreeEvent} from '@react-three/fiber';
import type {WildsClearancePile} from './wilds-building-clearance';
import {WILDS_TERRAIN_TILE_SIZE} from './wilds-terrain-authority';

/** Three shared instanced batches. Pile complexity is constant regardless of
 * quantity; camera/player offsets never rebuild the instance transforms. */
export const WildsBuildingClearancePiles=memo(function WildsBuildingClearancePiles({piles,player,elevation,onCollect}:{piles:readonly WildsClearancePile[];player:{x:number;z:number};elevation:number;onCollect?:(pile:WildsClearancePile)=>void}){
 const tileX=Math.floor(player.x/WILDS_TERRAIN_TILE_SIZE),tileZ=Math.floor(player.z/WILDS_TERRAIN_TILE_SIZE);
 const nearby=useMemo(()=>piles.filter(pile=>Math.abs(Math.floor(pile.position.x/WILDS_TERRAIN_TILE_SIZE)-tileX)<=2&&Math.abs(Math.floor(pile.position.z/WILDS_TERRAIN_TILE_SIZE)-tileZ)<=2),[piles,tileX,tileZ]);
 const wood=useMemo(()=>nearby.filter(p=>p.kind==='timber'),[nearby]),stone=useMemo(()=>nearby.filter(p=>p.kind==='stone'),[nearby]),food=useMemo(()=>nearby.filter(p=>p.kind==='food'),[nearby]);
 return <group name="building-clearance-piles" position={[-player.x,-elevation,-player.z]}>
  <PileBatch kind="timber" piles={wood} onCollect={onCollect}/><PileBatch kind="stone" piles={stone} onCollect={onCollect}/><PileBatch kind="food" piles={food} onCollect={onCollect}/>
 </group>;
});
const PileBatch=memo(function PileBatch({kind,piles,onCollect}:{kind:WildsClearancePile['kind'];piles:readonly WildsClearancePile[];onCollect?:(pile:WildsClearancePile)=>void}){
 const mesh=useRef<THREE.InstancedMesh>(null),parts=kind==='food'?1:3;
 useLayoutEffect(()=>{
  if(!mesh.current)return;const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
  piles.forEach((pile,index)=>{const height=.72+Math.min(12,pile.remaining)*.025;
   for(let part=0;part<parts;part++){
    position.set(pile.position.x+(part-1)*.22*(kind==='food'?0:1),pile.position.y+(kind==='food'?.25:part===2?.38:.16),pile.position.z+(part%2)*.12);
    rotation.setFromEuler(new THREE.Euler(kind==='timber'?Math.PI/2:0,0,kind==='stone'?part*.3:0));
    scale.set(kind==='timber'?.18:kind==='stone'?.3:.44,kind==='timber'?height:kind==='stone'?.24:.27,kind==='timber'?.18:kind==='stone'?.28:.44);
    matrix.compose(position,rotation,scale);mesh.current!.setMatrixAt(index*parts+part,matrix);
   }
  });mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();
 },[kind,piles,parts]);
 const interact=(event:ThreeEvent<MouseEvent>)=>{if(event.instanceId===undefined)return;const pile=piles[Math.floor(event.instanceId/parts)];if(pile){event.stopPropagation();onCollect?.(pile);}};
 if(!piles.length)return null;
 return <instancedMesh ref={mesh} args={[undefined,undefined,piles.length*parts]} name={`clearance-${kind}`} onClick={interact} castShadow receiveShadow>
  {kind==='timber'?<cylinderGeometry args={[1,1,1,7]}/>:kind==='stone'?<icosahedronGeometry args={[1,0]}/>:<cylinderGeometry args={[1,.74,1,10,1,true]}/>}
  <meshStandardMaterial color={kind==='timber'?'#795239':kind==='stone'?'#7e8b92':'#c29a52'} roughness={.9} side={kind==='food'?THREE.DoubleSide:THREE.FrontSide}/>
 </instancedMesh>;
});
