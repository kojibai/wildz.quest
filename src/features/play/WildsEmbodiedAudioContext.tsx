'use client';
import { createContext, useContext, useEffect, useRef } from 'react';
import type { WildsEmbodiedAudioRegistry, WildsEmbodiedSource } from './wilds-embodied-audio';
export const WildsEmbodiedAudioContext=createContext<WildsEmbodiedAudioRegistry|null>(null);
/** Register one existing presentation position; do not add simulation or render state. */
export function useWildsEmbodiedSource(id:string,read:()=>WildsEmbodiedSource|null) {
  const registry=useContext(WildsEmbodiedAudioContext), latest=useRef(read); latest.current=read;
  useEffect(()=>{
    if(!registry)return;
    const source=()=>latest.current(); registry.set(id,source);
    return ()=>{if(registry.get(id)===source)registry.delete(id);};
  },[registry,id]);
}
