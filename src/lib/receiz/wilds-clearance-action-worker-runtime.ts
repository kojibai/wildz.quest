import {canonicalizeReceizV122,signReceizIdentityLoginProof,type ReceizAuthoritySessionV124,type ReceizClient} from '@receiz/sdk';
import type {PortableCardAsset} from '../../features/play/portable-card';
import {isWildsWalletResourceSourcePageUrlV128,isWildsWalletSourceSdkPathV128,WILDS_WALLET_RESOURCE_SOURCE_URL_V128} from '../../features/play/wallet/wilds-wallet-source-sdk-v128';
import type {WildsResourceSourceAuthorV128} from './wilds-resource-source-v128';
import type {createWildsResourcePackageExchangeV128} from './wilds-resource-exchange-v128';
import {createWildsClearanceActionWorkerClient} from './wilds-clearance-action-worker-client';
import {captureWildsClearanceAdmissionV128} from './wilds-clearance-admission-v128';
// Only this fixed-URL production runtime can issue receiving qualification.
// Public callers can query it, never register a world, flag or receipt.
const workerCustody=new WeakMap<object,{memberId:string;head:string}>();
export function isQualifiedWildsWorkerCustodyV128(value:object,memberId:string,head:string){
 const held=workerCustody.get(value);return held?.memberId===memberId&&held.head===head;
}
export type WildsClearanceActionWorkerInitial=Readonly<{
 configuration:{applicationId:string;baseUrl:string};author:WildsResourceSourceAuthorV128;
 session:ReceizAuthoritySessionV124;gameplayOwnerId:string;
}>;
/** Closed public author projection. No encrypted/private key, passphrase, grant
 * token or identity artifact is copied into the admission worker. Its existing
 * short-lived session handle is required by exact SDK request/receipt binding. */
export function wildsClearanceWorkerAuthor(author:WildsResourceSourceAuthorV128):WildsResourceSourceAuthorV128{
 const key=author.keyFile;
 return {ownerReceizId:author.ownerReceizId,actorSubjectId:author.actorSubjectId,actorSubjectHead:author.actorSubjectHead,
  grant:{...author.grant,accessToken:''},keyFile:{schema:key.schema,name:key.name,version:key.version,issuedAt:key.issuedAt,keyId:key.keyId,alg:key.alg,
   owner:{uid:key.owner.uid,username:key.owner.username,email:null,displayName:null},attestation:null,portableState:null,
   crypto:{publicKeyRawB64u:key.crypto.publicKeyRawB64u,privateKeyPkcs8CiphertextB64u:'',kdf:{name:'PBKDF2-SHA256',iterations:0,saltB64u:''},cipher:{name:'AES-GCM-256',ivB64u:'',aad:''}}}};
}
type Exchange=import('../../features/play/wilds-building-clearance-interaction').WildsClearanceInteractionExchange & Pick<ReturnType<typeof createWildsResourcePackageExchangeV128>,'admitMaterialCommand'> & {previewGameplay:()=>Promise<{replay:{world:Awaited<ReturnType<ReturnType<typeof createWildsResourcePackageExchangeV128>['previewGameplay']>>['replay']['world']}}>};
export function createWildsClearanceActionWorkerRuntime(input:WildsClearanceActionWorkerInitial&{
 sdk:ReceizClient;assertCurrent:()=>void;
 resolveOriginal?:NonNullable<Parameters<typeof createWildsResourcePackageExchangeV128>[0]['resolveOriginal']>;
 fetcher?:typeof fetch;
}){
 const assertCurrent=()=>{input.assertCurrent();};
 const client=createWildsClearanceActionWorkerClient({
  worker:()=>new Worker(new URL('./wilds-clearance-action.worker.ts',import.meta.url),{type:'module'}),
  initialize:()=>{assertCurrent();return {configuration:input.configuration,author:wildsClearanceWorkerAuthor(input.author),session:input.session,gameplayOwnerId:input.gameplayOwnerId} satisfies WildsClearanceActionWorkerInitial;},
  async callback(method,args,signal){
   assertCurrent();
   if(method==='resolveOriginal'){const card=args[0] as PortableCardAsset;return input.resolveOriginal?input.resolveOriginal(card):null;}
   if(method==='signChallenge'){
    const text=args[0];if(typeof text!=='string'||text.length>16_384)throw Error('wilds_clearance_signing_request_invalid');
    const challenge=JSON.parse(text);
    if(challenge.audience!==input.configuration.applicationId||challenge.artifactDigest!==input.author.grant.artifactDigest
     ||canonicalizeReceizV122(challenge.scopes)!==canonicalizeReceizV122(input.author.grant.grantedScopes))throw Error('wilds_clearance_signing_request_invalid');
    return signReceizIdentityLoginProof({keyFile:input.author.keyFile,challengeText:text,...(input.author.passphrase===undefined?{}:{passphrase:input.author.passphrase})});
   }
   if(method==='signPublish'){
    const value=args[0] as Parameters<typeof input.sdk.publicStore.signPublish>[0];
    if(value.tenantHost!=='wildz.quest'||value.merchantReceizId!==input.author.ownerReceizId||value.namespace!=='wildz.resources.v128'
     ||value.sourceUrl!==WILDS_WALLET_RESOURCE_SOURCE_URL_V128&&!isWildsWalletResourceSourcePageUrlV128(value.sourceUrl??''))throw Error('wilds_clearance_signing_request_invalid');
    return input.sdk.publicStore.signPublish({...value,keyFile:input.author.keyFile,...(input.author.passphrase===undefined?{}:{passphrase:input.author.passphrase})});
   }
   if(method!=='fetch'||args[0]!=='/api/wilds/wallet/source-sdk')throw Error('wilds_clearance_callback_invalid');
   const wire=args[1] as {headers:[string,string][];text?:string|null;form?:[string,string|File][]};
   const headers=new Headers(wire.headers);if(headers.has('authorization'))throw Error('wilds_clearance_worker_credentials_forbidden');
   let body:BodyInit,path:string,nativeMethod:string,query:string;
   if(wire.form){const form=new FormData();for(const [name,value] of wire.form)form.append(name,value);path=String(form.get('wildzSdkPath'));nativeMethod=String(form.get('wildzSdkMethod'));query=String(form.get('wildzSdkQuery'));body=form;}
   else{if(typeof wire.text!=='string'||wire.text.length>2_000_000)throw Error('wilds_clearance_transport_invalid');const value=JSON.parse(wire.text);({path,method:nativeMethod,query}=value);body=wire.text;}
   if(!isWildsWalletSourceSdkPathV128(path,nativeMethod,query)||!['/api/public-proof/by-url','/api/public-proof/registry/feed','/api/sdk/v1/domains/verified-replay','/api/sdk/v1/sources/publish','/api/sdk/v1/assets/seal'].includes(path))throw Error('wilds_clearance_transport_invalid');
   if(path==='/api/public-proof/by-url'){const url=new URLSearchParams(query).get('url')??'';if(url!==WILDS_WALLET_RESOURCE_SOURCE_URL_V128&&!isWildsWalletResourceSourcePageUrlV128(url))throw Error('wilds_clearance_transport_invalid');}
   headers.set('authorization',`Bearer ${input.author.grant.accessToken}`);
   const response=await (input.fetcher??fetch)('/api/wilds/wallet/source-sdk',{method:'POST',headers,body,credentials:'same-origin',cache:'no-store',redirect:'error',signal});
   return {status:response.status,headers:[...response.headers],bytes:await response.arrayBuffer()};
  }
 });
 const run:typeof client.run=async(method,args,beforeCommit,beforeReject)=>{
  assertCurrent();const result=await client.run(method,args,beforeCommit,beforeReject);assertCurrent();
  if(!result||typeof result!=='object')return result;
  const response=result as {replay?:{world?:import('../../features/play/wilds-world-state').WildsWorldProjection};projection?:import('../../features/play/wilds-world-state').WildsWorldProjection;status?:string;kind?:string};
  const world=method==='previewGameplay'?response.replay?.world:
   method==='admitMaterialCommand'&&response.kind==='ordinary'||['deriveClearance','admitClearancePickup','recoverClearance'].includes(method)&&response.status==='admitted'?response.projection:undefined;
  if(world)for(const [id,raw] of Object.entries(world.applicationSourceCustody??{})){
   const lot=world.materialLots[id]??world.resourceLots[id];
   if(!lot||raw.scheme!=='wildz.resource-source.v128'||raw.ownerReceizId!==input.gameplayOwnerId)throw Error('wilds_resource_worker_custody_scope_invalid');
   const custody=Object.freeze({...raw});workerCustody.set(custody,{memberId:id,head:lot.head});world.applicationSourceCustody![id]=custody;
  }
  return result;
 };
 const exchange:Exchange={
  previewGameplay:async()=>{assertCurrent();const result=await run('previewGameplay',[]);assertCurrent();return result as Awaited<ReturnType<Exchange['previewGameplay']>>;},
  admitMaterialCommand:async(request,beforeCommit,beforeReject)=>{assertCurrent();const result=await run('admitMaterialCommand',[request],async()=>{assertCurrent();await beforeCommit?.();assertCurrent();},async()=>{assertCurrent();await beforeReject?.();assertCurrent();});assertCurrent();return result as Awaited<ReturnType<Exchange['admitMaterialCommand']>>;},
  readCurrent:async()=>{assertCurrent();return await run('readCurrent',[]) as Awaited<ReturnType<Exchange['readCurrent']>>;},
  deriveClearance:(request,beforeCommit)=>captureWildsClearanceAdmissionV128(request.attemptId,async()=>{assertCurrent();return await run('deriveClearance',[request],async()=>{assertCurrent();await beforeCommit?.();assertCurrent();}) as Awaited<ReturnType<Exchange['deriveClearance']>>;}),
  admitClearancePickup:(proposal,beforeCommit)=>captureWildsClearanceAdmissionV128(proposal.command.commandId,async()=>{assertCurrent();return await run('admitClearancePickup',[proposal],async()=>{assertCurrent();await beforeCommit?.();assertCurrent();}) as Awaited<ReturnType<Exchange['admitClearancePickup']>>;}),
  recoverClearance:async(attemptId,beforeCommit)=>{try{assertCurrent();return await run('recoverClearance',[attemptId],async()=>{assertCurrent();await beforeCommit?.();assertCurrent();}) as Awaited<ReturnType<Exchange['recoverClearance']>>;}catch(cause){return {status:'pending',attemptId,members:[],reason:cause instanceof Error?cause.message:'wilds_clearance_worker_failed'};}}
 };
 return {exchange,dispose:()=>client.dispose()};
}
