/** One explicit operation per worker. No idle SDK, decoded history or Original
 * cache survives completion/cancellation. An uncertain result is never credit. */
export function createWildsClearanceActionWorkerClient(input:{
 worker:()=>Worker;initialize:()=>unknown|Promise<unknown>;
 callback:(method:string,args:unknown[],signal:AbortSignal)=>Promise<unknown>;
 timeoutMs?:number;
}){
 let cancel:(()=>void)|null=null,disposed=false;
 return {
  dispose(){disposed=true;cancel?.();},
  async run(method:string,args:unknown[],beforeCommit?:()=>Promise<void>,assertScope?:()=>Promise<void>):Promise<unknown>{
   if(disposed)throw Error('wilds_clearance_worker_disposed');
   if(!['readCurrent','previewGameplay','admitMaterialCommand','deriveClearance','admitClearancePickup','recoverClearance'].includes(method))throw Error('wilds_clearance_worker_method_invalid');
   if(cancel)throw Error('wilds_clearance_worker_busy');
   const worker=input.worker();
   return new Promise((resolve,reject)=>{
    let active=true;const abort=new AbortController();
    const finish=(error:Error|null,value?:unknown)=>{if(!active)return;active=false;abort.abort();clearTimeout(timer);worker.removeEventListener('message',message);worker.removeEventListener('error',failure);worker.terminate();cancel=null;if(error)reject(error);else resolve(value);};
    const failure=()=>finish(Error('wilds_clearance_worker_failed'));
    const message=(event:MessageEvent)=>{
     const data=event.data;if(!active||!data)return;
     if(data.type==='result'){finish(data.ok?null:Error(data.error??'wilds_clearance_worker_failed'),data.value);return;}
     if(data.type!=='callback'||!Number.isSafeInteger(data.id)||!Array.isArray(data.args))return;
     void (async()=>{
      try{const value=data.method==='beforeCommit'?await beforeCommit?.():data.method==='assertScope'?await assertScope?.():await input.callback(data.method,data.args,abort.signal);
       if(active)worker.postMessage({type:'callback-result',id:data.id,ok:true,value});
      }catch(cause){if(active)worker.postMessage({type:'callback-result',id:data.id,ok:false,error:cause instanceof Error?cause.message:'wilds_clearance_callback_failed'});}
     })();
    };
    const timer=setTimeout(()=>finish(Error('wilds_clearance_worker_timeout')),input.timeoutMs??120_000);
    cancel=()=>finish(Error('wilds_clearance_worker_cancelled'));
    worker.addEventListener('message',message);worker.addEventListener('error',failure);
    void Promise.resolve().then(()=>input.initialize()).then(initial=>{if(active)worker.postMessage({type:'run',method,args,initial});},cause=>finish(cause instanceof Error?cause:Error('wilds_clearance_worker_initialize_failed')));
   });
  }
 };
}

/** Coalesce asynchronous worker-port creation independently of action callers. */
export function createWildsClearanceRuntimeSlot<K,T extends {dispose():void}>(create:(key:K)=>Promise<T>,assertCurrent:()=>void){
 let lifecycle=0,generation=0,held:{key:K;value:T}|null=null,opening:{key:K;promise:Promise<T>}|null=null;
 const release=()=>{generation++;held?.value.dispose();held=null;opening=null;};
 const dispose=()=>{lifecycle++;release();};
 const open=(key:K):Promise<T>=>{
  assertCurrent();if(held?.key===key)return Promise.resolve(held.value);if(opening?.key===key)return opening.promise;
  release();const expected=generation;
  const promise=create(key).then(value=>{try{if(generation!==expected)throw Error('wilds_clearance_worker_open_cancelled');assertCurrent();held={key,value};return value;}catch(cause){value.dispose();throw cause;}});
  opening={key,promise};void promise.finally(()=>{if(opening?.promise===promise)opening=null;}).catch(()=>undefined);return promise;
 };
 return {dispose,open,async openAfter(resolveKey:()=>Promise<K>):Promise<T>{
  const expected=lifecycle;const key=await resolveKey();
  if(lifecycle!==expected)throw Error('wilds_clearance_worker_open_cancelled');
  return open(key);
 }};
}
