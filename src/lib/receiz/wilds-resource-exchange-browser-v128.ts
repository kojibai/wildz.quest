'use client';

import {canonicalizeReceizV122,createReceizProofAuthorityChallenge,digestReceizCanonicalV122,signReceizIdentityLoginProof,
 type ReceizKeyFile,type ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import type {PortableCardAsset} from '../../features/play/portable-card';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import {createWildsWalletSourceSdkClientV128,WILDS_WALLET_RESOURCE_SOURCE_URL_V128} from '../../features/play/wallet/wilds-wallet-source-sdk-v128';
import {createWildzIdentityAuthorizationArtifact} from './wildz-identity-authorization-artifact';
import {openWildsResourceSourceAuthorityV128} from './wilds-resource-source-client-v128';
import {WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128} from './wilds-resource-source-v128';
import {createWildsResourcePackageExchangeV128,createWildsResourcePublicStoreLocatorV128} from './wilds-resource-exchange-v128';
import {WILDS_RESOURCE_DOMAIN_V128,WILDS_RESOURCE_REDUCER_DIGEST_V128} from './wilds-resource-journal-v128';

export type WildsResourceExchangeBrowserDependenciesV128=Readonly<{
 configuration():Promise<Readonly<{applicationId:string;baseUrl:string}>>;
 loadIdentity(keyId:string):Promise<ReceizKeyFile>;
 database():Promise<WildzContinuityDatabase>;
 createSdk:typeof createWildsWalletSourceSdkClientV128;
}>;
const defaults:WildsResourceExchangeBrowserDependenciesV128={
 async configuration(){
  const response=await fetch('/api/wilds/wallet/source-sdk',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10_000)});
  const value=await response.json();
  if(!response.ok||!value||Object.keys(value).sort().join()!=='applicationId,baseUrl'||typeof value.applicationId!=='string'||!value.applicationId.trim()
   ||typeof value.baseUrl!=='string'||new URL(value.baseUrl).protocol!=='https:')throw Error('wilds_resource_source_configuration_unavailable');
  return value;
 },
 async loadIdentity(keyId){return (await import('./wildz-identity-signing-read')).readWildzIdentityForSigning(keyId);},
 async database(){return (await import('./wildz-active-identity')).defaultContinuityDatabase;},
 createSdk:createWildsWalletSourceSdkClientV128,
};

/** Invoke on an explicit wallet action. This uses the actual held identity,
 * registered application ID, device grant, native actor/source admission and
 * sealed source session. It never changes startup or collection latency. */
export async function openWildsResourcePackageExchangeBrowserV128(input:Readonly<{
 keyId:string;gameplayOwnerId:string;
 resolveOriginal?:(card:PortableCardAsset)=>Promise<ReceizPortableSealedArtifactV124|null>;
}>,dependencies:WildsResourceExchangeBrowserDependenciesV128=defaults){
 const [keyFile,configuration,database]=await Promise.all([dependencies.loadIdentity(input.keyId),dependencies.configuration(),dependencies.database()]);
 if(keyFile.keyId!==input.keyId||!keyFile.owner.username)throw Error('wilds_resource_source_identity_mismatch');
 const transport=await createWildzIdentityAuthorizationArtifact(keyFile);
 const statementDigest=await digestReceizCanonicalV122({schema:'wildz.resource-source-consent.v128',applicationId:configuration.applicationId,keyId:input.keyId,
  domainId:WILDS_RESOURCE_DOMAIN_V128,lawDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,gameplayOwnerId:input.gameplayOwnerId,
  permission:'Qualify retained admitted food, materials and Living Honey; reserve exact packages, accept private offers, reoffer and irreversibly unpack using source custody.'});
 const challenge=createReceizProofAuthorityChallenge({applicationId:configuration.applicationId,artifactDigest:transport.artifactDigest,
  scopes:WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128,consentStatementDigest:statementDigest,ttlPulses:60});
 const proof=await signReceizIdentityLoginProof({keyFile,challengeB64Url:challenge.challengeB64Url});
 const signedGrantChallenge={...challenge.challenge,proof};
 const initial=dependencies.createSdk(configuration);
 const grant=await initial.identity.exchangeProofAuthority({artifact:transport.artifact,challenge:signedGrantChallenge,applicationId:configuration.applicationId,scopes:WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128});
 const sdk=dependencies.createSdk({...configuration,accessToken:grant.accessToken});
 const opened=await openWildsResourceSourceAuthorityV128({sdk,keyFile,grant,identityArtifact:transport.artifact,signedGrantChallenge});
 const locator=createWildsResourcePublicStoreLocatorV128({sdk,authority:opened.author,sourceUrl:WILDS_WALLET_RESOURCE_SOURCE_URL_V128});
 const exchange=createWildsResourcePackageExchangeV128({sdk,database,authority:opened.author,session:opened.session,gameplayOwnerId:input.gameplayOwnerId,locator,
  ...(input.resolveOriginal?{resolveOriginal:input.resolveOriginal}:{})});
 // Exact grant/session live only in this operation's SDK closure. Recovery
 // stores public source bytes; it never stores an access token or signing key.
 return {sdk,exchange,database,session:opened.session,applicationId:configuration.applicationId,ownerReceizId:opened.author.ownerReceizId,keyId:keyFile.keyId,
  identityArtifactDigest:transport.artifactDigest,consentStatement:canonicalizeReceizV122({statementDigest})};
}
