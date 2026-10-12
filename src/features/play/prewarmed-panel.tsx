'use client';
import dynamic from 'next/dynamic';
import {createElement,useState,type ComponentType,type ReactNode} from 'react';

/** Warm module bytes before a tap, then skip the lazy component's first-mount
 * promise when already loaded. Choose one component for each mounted lifetime
 * so a cold import finishing never replaces a form or loses its local state. */
export function createPrewarmedPanel<Props extends object>(loader:()=>Promise<ComponentType<Props>>,loading?:()=>ReactNode){
 let ready:ComponentType<Props>|null=null,pending:Promise<ComponentType<Props>>|null=null;
 const load=()=>{
  if(ready)return Promise.resolve(ready);
  if(!pending)pending=loader().then(component=>{ready=component;return component;}).catch(cause=>{pending=null;throw cause;});
  return pending;
 };
 const Lazy=dynamic(load,{ssr:false,...(loading?{loading}:{})});
 function Panel(props:Props){
  const [Mounted]=useState<ComponentType<Props>>(()=>ready??Lazy);
  return createElement(Mounted,props);
 }
 return {Panel,load};
}
