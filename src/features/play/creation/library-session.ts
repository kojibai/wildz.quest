import type {CreationLibraryScope,CreationLibraryEntry,createWildzCreationLibrary} from '../../../lib/receiz/wildz-creation-library';
export type CreationLibraryPort=Pick<ReturnType<typeof createWildzCreationLibrary>,'page'|'read'|'retain'|'export'>;
export type CreationLibrarySnapshot=Readonly<{entries:readonly CreationLibraryEntry[];nextCursor:string|null;busy:boolean;reason:string|null}>;
export type CreationObjectLibraryInput=Readonly<{scope:CreationLibraryScope;port:CreationLibraryPort}>;
const empty:CreationLibrarySnapshot=Object.freeze({entries:Object.freeze([]),nextCursor:null,busy:false,reason:null});
function message(error:unknown){const reason=error instanceof Error?error.message:'';
 if(reason.includes('owner_mismatch'))return 'This object belongs to another account.';
 if(reason.includes('history_conflict'))return 'These saved versions conflict. Both originals are retained.';
 if(reason.includes('capacity')||reason.includes('budget'))return 'This image exceeds the supported size. Your original is untouched.';
 return 'This saved object could not be verified. Your original is untouched.';
}
/** No timers or initial reads. Every selection/export reopens the exact source and fences account changes. */
export function createCreationLibrarySession(input:{scope:()=>CreationLibraryScope;port:CreationLibraryPort;select:(entry:CreationLibraryEntry)=>void}){
 let snapshot=empty,closed=false,epoch=0,bound=JSON.stringify(input.scope());const listeners=new Set<()=>void>();
 const publish=(next:CreationLibrarySnapshot)=>{if(closed)return;snapshot=Object.freeze(next);listeners.forEach(fn=>{try{fn();}catch{}});};
 function capture(){const scope={...input.scope()},coordinate=JSON.stringify(scope);if(coordinate!==bound){epoch++;bound=coordinate;publish(empty);}return {scope,coordinate,epoch:++epoch};}
 const current=(work:ReturnType<typeof capture>)=>!closed&&epoch===work.epoch&&JSON.stringify(input.scope())===work.coordinate;
 function stale(work:ReturnType<typeof capture>){if(!closed&&epoch===work.epoch)publish(empty);}
 return {snapshot:()=>snapshot,subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};},
 async refresh(append=false){
  const work=capture(),cursor=append?snapshot.nextCursor:null;if(append&&cursor===null)return;
  const prior=append?snapshot.entries:[];publish({...snapshot,busy:true,reason:null});
  try{const page=await input.port.page(work.scope,cursor);if(!current(work)){stale(work);return;}const byId=new Map(prior.map(e=>[e.instanceId,e]));page.entries.forEach(e=>byId.set(e.instanceId,e));publish({entries:Object.freeze([...byId.values()]),nextCursor:page.nextCursor,busy:false,reason:null});}
  catch(error){if(current(work))publish({...snapshot,busy:false,reason:message(error)});else stale(work);}
 },
 async import(source:Readonly<{bytes:Uint8Array;mimeType:string;name?:string}>){
  const work=capture();publish({...snapshot,busy:true,reason:null});
  try{await input.port.retain(work.scope,source);if(!current(work)){stale(work);return false;}
   const page=await input.port.page(work.scope);if(!current(work)){stale(work);return false;}
   publish({entries:Object.freeze(page.entries),nextCursor:page.nextCursor,busy:false,reason:'Saved to your account.'});return true;
  }catch(error){if(current(work))publish({...snapshot,busy:false,reason:message(error)});else stale(work);return false;}
 },
 async select(id:string){
  const work=capture();publish({...snapshot,busy:true,reason:null});
  try{const entry=await input.port.read(work.scope,id);if(!current(work)){stale(work);return false;}
   if(entry.status!=='owned'||!entry.artifact)throw Error(entry.status==='conflict'?'creation_library_history_conflict':'creation_library_owner_mismatch');
   input.select(entry);publish({...snapshot,busy:false,reason:null});return true;
  }catch(error){if(current(work))publish({...snapshot,busy:false,reason:message(error)});else stale(work);return false;}
 },
 async export(id:string){
  const work=capture();publish({...snapshot,busy:true,reason:null});
  try{const source=await input.port.export(work.scope,id);if(!current(work)){stale(work);return null;}publish({...snapshot,busy:false,reason:null});return source;}
  catch(error){if(current(work))publish({...snapshot,busy:false,reason:message(error)});else stale(work);return null;}
 },
 cancel(){epoch++;publish(empty);},
 close(){closed=true;epoch++;listeners.clear();snapshot=empty;}
 };
}
