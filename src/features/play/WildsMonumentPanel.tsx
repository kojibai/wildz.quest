'use client';

import {useState} from 'react';
import type {WildsMonumentDescriptor} from './wilds-discovery-monuments';
import styles from './WildsMonumentPanel.module.css';

const lightNames=['Amber','Cyan','Violet'];
export function WildsMonumentPanel({monument,lights,panorama,onPanorama,onScan,onLightChange}:{monument:WildsMonumentDescriptor;lights:readonly number[];panorama:boolean;onPanorama:()=>void;onScan:()=>void;onLightChange:(state:{id:string;lights:readonly number[];aligned:boolean})=>void}){
  const [reading,setReading]=useState(false);
  const aligned=lights.every((light,index)=>light===monument.puzzlePattern[index]);
  return <aside className={styles.panel} aria-label={monument.name}>
    <strong>{monument.name}</strong>
    {monument.type==='stone-arch'?<>
      <p>{reading?monument.lore:'Weathered inscriptions wait beneath the arch.'}</p>
      <button type="button" onClick={()=>setReading(value=>!value)}>{reading?'Close inscription':'Read inscription'}</button>
      <button type="button" onClick={onScan}>Scan the arch</button>
    </>:monument.type==='compass'?<>
      <p>{panorama?'Follow the horizon. Leave the view whenever you like.':monument.lore}</p>
      <button type="button" aria-pressed={panorama} onClick={onPanorama}>{panorama?'Leave panorama':'View panorama'}</button>
    </>:<>
      <p>Match the light sequence: {monument.puzzlePattern.map(light=>lightNames[light]).join(' → ')}.</p>
      <div className={styles.lights}>{lights.map((light,index)=><button key={index} type="button" aria-label={`Turn prism ${index+1}: ${lightNames[light]}`} onClick={()=>{
        const next=lights.map((value,i)=>i===index?(value+1)%3:value);
        onLightChange({id:monument.id,lights:next,aligned:next.every((light,i)=>light===monument.puzzlePattern[i])});
      }}>{index+1} · {lightNames[light]}</button>)}</div>
      <p role="status">{aligned?`The light aligns. ${monument.lore}`:'Turn each prism to align the reflected light.'}</p>
    </>}
  </aside>;
}
