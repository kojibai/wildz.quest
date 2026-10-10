'use client';

import {WILDZ_RECEIZ_APPLICATION_ID} from './wildz-application';
import {walletAuthorizationFailureCode} from '../../features/play/wallet/wilds-wallet-authorization-error';

type Configuration = Readonly<{applicationId:string;baseUrl:string}>;
export type WildsResourceSourceConfigurationDependenciesV128 = Readonly<{
 fetcher:typeof fetch;
 authorize(keyId:string):Promise<boolean>;
 reconnect(keyId:string):Promise<boolean>;
}>;
const defaults:WildsResourceSourceConfigurationDependenciesV128={
 fetcher:(...args)=>fetch(...args),
 async authorize(keyId){
  const {authorizeWildsWalletReadWithIdentity}=await import('../../features/play/wallet/wilds-wallet-read-authorization');
  return authorizeWildsWalletReadWithIdentity(keyId);
 },
 async reconnect(keyId){
  const {defaultIdentityRepository,connectWildzProofSession}=await import('./wildz-identity-adapter');
  const {wildzRemoteSessionMatchesIdentity}=await import('./wildz-session-bridge');
  const active=await defaultIdentityRepository.active();
  if(!active||active.keyId!==keyId||active.localAuthority!=='verified')return false;
  const remote=await connectWildzProofSession(active,{forceRemote:true});
  const current=await defaultIdentityRepository.active();
  return current?.keyId===keyId&&remote.status==='connected'&&wildzRemoteSessionMatchesIdentity(active,remote);
 },
};
const readGrantFailures=new Set(['receiz_wallet_read_scope_required','receiz_wallet_authority_revoked']);
const continuationFailures=new Set(['receiz_wallet_authority_required','receiz_wallet_profile_binding_invalid',
 'receiz_wallet_token_binding_invalid','receiz_wallet_connect_session_required','receiz_wallet_connect_session_binding_invalid']);

export class WildsResourceSourceConfigurationErrorV128 extends Error {
 constructor(readonly code:string){
  super(`The source connection could not finish. Retry the same Market or Wallet action. Reference: ${code}.`);
  this.name='WildsResourceSourceConfigurationErrorV128';
 }
}
function configuration(value:unknown):Configuration|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const item=value as Record<string,unknown>;
 if(Object.keys(item).sort().join()!=='applicationId,baseUrl'||item.applicationId!==WILDZ_RECEIZ_APPLICATION_ID||typeof item.baseUrl!=='string')return null;
 try{
  const url=new URL(item.baseUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.origin!==item.baseUrl)return null;
  return {applicationId:item.applicationId,baseUrl:item.baseUrl};
 }catch{return null;}
}

/** Only configuration is retried: no source/value command has started. Healthy
 * sessions perform no extra authorization. Renewal signs with the same Seal
 * through the existing v128 ports; the proxy still admits every actual edge. */
export async function loadWildsResourceSourceConfigurationV128(keyId:string,
 dependencies:WildsResourceSourceConfigurationDependenciesV128=defaults):Promise<Configuration>{
 let authorized=false,reconnected=false;
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{response=await dependencies.fetcher('/api/wilds/wallet/source-sdk',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10_000)});}
  catch{throw new WildsResourceSourceConfigurationErrorV128('SOURCE_CONNECTION_UNAVAILABLE');}
  const value:unknown=await response.json().catch(()=>null);
  if(response.ok){
   const result=configuration(value);
   if(result)return result;
   throw new WildsResourceSourceConfigurationErrorV128('SOURCE_CONFIGURATION_INVALID');
  }
  const code=walletAuthorizationFailureCode(value);
  if(continuationFailures.has(code)&&!reconnected){
   if(!await dependencies.reconnect(keyId))throw new WildsResourceSourceConfigurationErrorV128(code);
   reconnected=true;
   if(!authorized){
    if(!await dependencies.authorize(keyId))throw new WildsResourceSourceConfigurationErrorV128(code);
    authorized=true;
   }
   continue;
  }
  if(readGrantFailures.has(code)&&!authorized){
   if(!await dependencies.authorize(keyId))throw new WildsResourceSourceConfigurationErrorV128(code);
   authorized=true;
   continue;
  }
  throw new WildsResourceSourceConfigurationErrorV128(code);
 }
 throw new WildsResourceSourceConfigurationErrorV128('SOURCE_CONNECTION_UNAVAILABLE');
}
