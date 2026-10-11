import {mergeQualifiedWildsResourceWorldV128} from '../../features/play/wilds-resource-application-world-v128';
import {createWildzContinuityDatabase} from '../storage/wildz-indexed-db';
import {createWildsWalletSourceSdkClientV128,WILDS_WALLET_RESOURCE_SOURCE_URL_V128} from '../../features/play/wallet/wilds-wallet-source-sdk-v128';
import {createWildsResourcePackageExchangeV128,createWildsResourcePublicStoreLocatorV128} from './wilds-resource-exchange-v128';
import type {WildsClearanceActionWorkerInitial} from './wilds-clearance-action-worker-runtime';
export async function runWildsClearanceWorkerExchange(initial:WildsClearanceActionWorkerInitial,method:string,args:unknown[],callback:(method:string,args:unknown[])=>Promise<unknown>){
 const sdk=createWildsWalletSourceSdkClientV128({...initial.configuration,fetcher:async(request,init)=>{
  const body=init?.body instanceof FormData?{form:[...init.body.entries()]}:{text:init?.body??null};
  const response=await callback('fetch',[String(request),{headers:[...new Headers(init?.headers)],...body}]) as {status:number;headers:[string,string][];bytes:ArrayBuffer};
  return new Response(response.bytes,{status:response.status,headers:response.headers});
 }});
 const author={...initial.author,signChallenge:async(challengeText:string)=>await callback('signChallenge',[challengeText]) as Awaited<ReturnType<NonNullable<typeof initial.author.signChallenge>>>};
 // SDK object is immutable; a local port overrides only device-held signing.
 const publicStore={...sdk.publicStore,signPublish:async(value:Parameters<typeof sdk.publicStore.signPublish>[0])=>await callback('signPublish',[value]) as Awaited<ReturnType<typeof sdk.publicStore.signPublish>>};
 const signingSdk=new Proxy(sdk,{get(target,key){if(key==='publicStore')return publicStore;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 const locator=createWildsResourcePublicStoreLocatorV128({sdk:signingSdk,authority:author,sourceUrl:WILDS_WALLET_RESOURCE_SOURCE_URL_V128});
 const exchange=createWildsResourcePackageExchangeV128({sdk:signingSdk,database:createWildzContinuityDatabase(),authority:author,session:initial.session,gameplayOwnerId:initial.gameplayOwnerId,locator,
  resolveOriginal:async card=>await callback('resolveOriginal',[card]) as Awaited<ReturnType<NonNullable<Parameters<typeof createWildsResourcePackageExchangeV128>[0]['resolveOriginal']>>>});
 return projectWildsClearanceWorkerResult(method,await dispatchWildsClearanceWorkerExchange(exchange,method,args,async()=>{await callback('beforeCommit',[]);},async()=>{await callback('assertScope',[]);}));
}
export async function dispatchWildsClearanceWorkerExchange(exchange:Pick<ReturnType<typeof createWildsResourcePackageExchangeV128>,'readCurrent'|'previewGameplay'|'admitMaterialCommand'|'deriveClearance'|'admitClearancePickup'|'recoverClearance'>,method:string,args:unknown[],beforeCommit:()=>Promise<void>,assertScope:()=>Promise<void>=async()=>{}){
 switch(method){
  case 'readCurrent':return exchange.readCurrent();
  case 'previewGameplay':return exchange.previewGameplay();
  case 'admitMaterialCommand':return exchange.admitMaterialCommand(args[0] as Parameters<typeof exchange.admitMaterialCommand>[0],beforeCommit,assertScope);
  case 'deriveClearance':return exchange.deriveClearance(args[0] as Parameters<typeof exchange.deriveClearance>[0],beforeCommit);
  case 'admitClearancePickup':return exchange.admitClearancePickup(args[0] as Parameters<typeof exchange.admitClearancePickup>[0],beforeCommit);
  case 'recoverClearance':return exchange.recoverClearance(args[0] as string,beforeCommit);
  default:throw Error('wilds_clearance_worker_method_invalid');
 }
}

/** Called only after the full native exchange completes in this worker. This
 * removes transport/history, never substitutes a public display for admission. */
export function projectWildsClearanceWorkerResult(method:string,value:Awaited<ReturnType<typeof dispatchWildsClearanceWorkerExchange>>){
 if(!value)return null;
 if('replay'in value)mergeQualifiedWildsResourceWorldV128(null,value.replay.world);
 if('projection'in value)mergeQualifiedWildsResourceWorldV128(null,value.projection);
 if(method==='previewGameplay'&&'replay'in value)return {replay:{world:value.replay.world}};
 if(method==='admitMaterialCommand'&&'kind'in value)return value;
 if(method==='readCurrent'&&'predecessor'in value)return {state:{clearances:value.state.clearances,clearanceTaken:value.state.clearanceTaken},predecessor:{head:{head:value.predecessor.head.head}}};
 if('status'in value&&value.status==='admitted')return {status:value.status,members:value.members,projection:value.projection,nourishment:value.nourishment};
 if('status'in value)return value;
 throw Error('wilds_clearance_worker_result_invalid');
}
