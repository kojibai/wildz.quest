'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {Download,RefreshCw,Upload} from 'lucide-react';
import {createCreationLibrarySession,type CreationObjectLibraryInput} from './library-session';
import type {CreationConversationEvent} from './conversation';
import {downloadBlob} from '../card-export';
export function CreationLibraryControls({library,active,busy,selectedId,onChange}:{library:CreationObjectLibraryInput;active:boolean;busy:boolean;selectedId?:string;onChange:(event:CreationConversationEvent)=>void}){
 const scopeRef=useRef(library.scope);scopeRef.current=library.scope;const selectRef=useRef(onChange);selectRef.current=onChange;
 const fileRef=useRef<HTMLInputElement>(null),[fileError,setFileError]=useState<string|null>(null),[reading,setReading]=useState(false);
 const session=useMemo(()=>createCreationLibrarySession({scope:()=>scopeRef.current,port:library.port,select:entry=>{const artifact=entry.artifact;if(!artifact)return;const instance=artifact.payload.checkpoint.instances[0],definition=artifact.payload.checkpoint.definitions.find(d=>d.digest===instance.definitionDigest);if(definition)selectRef.current({type:'selection',definition,pose:instance.pose,instance:{instanceId:instance.instanceId,head:instance.head,definitionDigest:instance.definitionDigest}});}}),[library.port]);
 const state=useSyncExternalStore(session.subscribe,session.snapshot,session.snapshot),disabled=busy||state.busy||reading;
 useEffect(()=>{setFileError(null);if(active)void session.refresh();return ()=>session.cancel();},[active,library.scope.keyId,library.scope.actorId,session]);
 const importFile=async(file:File)=>{const scope=JSON.stringify(scopeRef.current);if(file.size>36*1024*1024){setFileError('This image exceeds the supported size.');return;}setReading(true);setFileError(null);try{const bytes=new Uint8Array(await file.arrayBuffer());if(JSON.stringify(scopeRef.current)===scope)await session.import({bytes,mimeType:file.type||'application/octet-stream',name:file.name});}catch{setFileError('This image could not be opened.');}finally{setReading(false);}};
 const exportFile=async(id:string)=>{const source=await session.export(id);if(source)downloadBlob(new Blob([source.bytes.slice().buffer],{type:source.mimeType}),source.filename);};
 if(!active)return null;
 return <div data-creation-library>
  <div data-library-actions><button type="button" disabled={disabled} onClick={()=>fileRef.current?.click()} title="Import a saved object"><Upload size={13}/>Import image</button><button type="button" disabled={disabled} aria-label="Refresh saved objects" title="Refresh saved objects" onClick={()=>void session.refresh()}><RefreshCw size={13}/></button></div>
  <input ref={fileRef} type="file" accept=".png,.receiz,.receized,.receizbundle,image/png,application/octet-stream" aria-label="Import saved creation image" hidden onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void importFile(file);}}/>
  {state.entries.map((entry,index)=>{const instance=entry.artifact?.payload.checkpoint.instances[0],definition=entry.artifact?.payload.checkpoint.definitions.find(d=>d.digest===instance?.definitionDigest);return <div key={entry.instanceId} data-library-object>
   <button type="button" disabled={disabled||entry.status!=='owned'} aria-pressed={selectedId===entry.instanceId} onClick={()=>void session.select(entry.instanceId)}>Saved creation {index+1}<small>{definition?definition.nodes.length+' parts · ':''}{entry.status==='owned'?'Owned':entry.status==='recovery'?'Recovery image':entry.status==='transferred'?'Transferred':entry.status==='conflict'?'Conflicting versions':'Verification unavailable'}</small></button>
   {['owned','recovery'].includes(entry.status)?<button type="button" disabled={disabled} aria-label={'Export saved creation '+(index+1)} title="Save exact verified image" onClick={()=>void exportFile(entry.instanceId)}><Download size={13}/></button>:null}
  </div>;})}
  {state.nextCursor?<button type="button" disabled={disabled} onClick={()=>void session.refresh(true)}>More saved objects</button>:null}
  {!state.entries.length&&!state.busy?<small>No saved creations yet.</small>:null}
  {reading||state.busy?<small role="status">Verifying your saved objects…</small>:null}
  {fileError||state.reason?<small role="status">{fileError||state.reason}</small>:null}
 </div>;
}
