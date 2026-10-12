import {createRequire} from 'node:module';
import path from 'node:path';
import * as React from 'react';

export type ReactTestNode={type?:string;props?:Record<string,unknown>;text?:string;children:ReactTestNode[]};
type Node=ReactTestNode;
type Renderer={createContainer(...args:unknown[]):unknown;updateContainerSync(...args:unknown[]):void;flushSyncWork():void;flushPassiveEffects():void};

/** Exercise real React state/effects using the renderer already shipped with
 * Fiber. Host nodes retain only the public props and text needed by tests. */
export async function mountMutableReact(element:React.ReactNode,{publicInstance=()=>null}:{publicInstance?(node:ReactTestNode):unknown}={}){
 const require=createRequire(import.meta.url);
 const reconcilerPath=path.resolve(path.dirname(require.resolve('@react-three/fiber')),'../react-reconciler/index.js');
 const createRenderer=(await import(reconcilerPath)).default as (config:unknown)=>Renderer;
 const container:Node={children:[]};let priority=0;
 const errors:unknown[]=[];
 const append=(parent:Node,child:Node)=>{const index=parent.children.indexOf(child);if(index!==-1)parent.children.splice(index,1);parent.children.push(child);};
 const remove=(parent:Node,child:Node)=>{const index=parent.children.indexOf(child);if(index!==-1)parent.children.splice(index,1);};
 const insert=(parent:Node,child:Node,before:Node)=>{remove(parent,child);parent.children.splice(parent.children.indexOf(before),0,child);};
 const host={
  supportsMicrotasks:true,scheduleMicrotask:queueMicrotask,isPrimaryRenderer:false,supportsMutation:true,supportsPersistence:false,supportsHydration:false,supportsResources:false,supportsSingletons:false,
  getRootHostContext:()=>({}),getChildHostContext:()=>({}),prepareForCommit:()=>null,resetAfterCommit(){},
  clearContainer:(node:Node)=>{node.children=[];return false;},scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1,
  resolveUpdatePriority:()=>priority||32,getCurrentUpdatePriority:()=>priority,setCurrentUpdatePriority:(value:number)=>{priority=value;},
  HostTransitionContext:React.createContext(null),NotPendingTransition:null,getPublicInstance:publicInstance,
  createInstance:(type:string,props:Record<string,unknown>):Node=>({type,props,children:[]}),createTextInstance:(text:string):Node=>({text,children:[]}),
  appendInitialChild:append,appendChild:append,appendChildToContainer:append,removeChild:remove,removeChildFromContainer:remove,insertBefore:insert,insertInContainerBefore:insert,
  shouldSetTextContent:()=>false,finalizeInitialChildren:()=>false,
  commitUpdate:(node:Node,_type:string,_old:unknown,props:Record<string,unknown>)=>{node.props=props;},commitTextUpdate:(node:Node,_old:string,text:string)=>{node.text=text;},resetTextContent:(node:Node)=>{node.children=[];}
 };
 const renderer=createRenderer(new Proxy(host,{get:(object,key)=>key in object?Reflect.get(object,key):()=>{}}));
 const root=renderer.createContainer(container,1,null,false,null,'',(error:unknown)=>errors.push(error),(error:unknown)=>errors.push(error),(error:unknown)=>errors.push(error),null);
 const flush=async()=>{renderer.flushSyncWork();renderer.flushPassiveEffects();await new Promise<void>(resolve=>setImmediate(resolve));renderer.flushSyncWork();renderer.flushPassiveEffects();if(errors.length)throw errors[0];};
 renderer.updateContainerSync(element,root,null,null);await flush();
 const visit=(node:Node):Node[]=>[node,...node.children.flatMap(visit)];
 return {async flush(){await flush();},nodes:()=>visit(container),text:()=>visit(container).flatMap(node=>node.text?[node.text]:[]).join(''),
  async update(next:React.ReactNode){renderer.updateContainerSync(next,root,null,null);await flush();},
  async unmount(){renderer.updateContainerSync(null,root,null,null);await flush();}};
}
