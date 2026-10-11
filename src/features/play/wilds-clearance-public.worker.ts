/// <reference lib="webworker" />
import {createWildsClearancePublicReaderV128} from '../../lib/receiz/wilds-clearance-public-read-v128';
const scope=self as unknown as DedicatedWorkerGlobalScope;
const reader=createWildsClearancePublicReaderV128();
let abort:AbortController|null=null;
let painted:Awaited<ReturnType<typeof reader.read>>=null;
scope.addEventListener('message',(event:MessageEvent<{id:number;cancel?:boolean}>)=>{
 const {id,cancel}=event.data;if(cancel){abort?.abort();return;}
 abort=new AbortController();const started=performance.now();
 void reader.read(abort.signal).then(value=>{const unchanged=value===painted;painted=value;scope.postMessage({id,ok:true,value:unchanged?null:value,unchanged,durationMs:performance.now()-started});},cause=>scope.postMessage({id,ok:false,error:cause instanceof Error?cause.message:'Public piles are unavailable.'}));
});
