import {createReceizClient} from '@receiz/sdk';
import {WILDS_RESOURCE_SOURCE_PUBLISHER_PATH_V128,isWildsResourceSourceOwnerUrlV128} from './wildz-owned-source-locator-v128';
import {readWildsResourceLocatedProofV128,WILDS_RESOURCE_SOURCE_URL_V128} from './wilds-resource-source-archive-v128';
import {verifyWildsResourceSourceProofV128,assertWildsResourceSourceCoordinateV128} from './wilds-resource-exchange-v128';
import {freezeConstructionProof} from '../../features/play/wilds-construction-project';
import type {WildsWorldProjection} from '../../features/play/wilds-world-state';
export const isWildsClearancePublicUrlV128=(value:string)=>value===WILDS_RESOURCE_SOURCE_URL_V128||isWildsResourceSourceOwnerUrlV128(value)||/^https:\/\/wildz\.quest\/receiz\/resource-source-v128\/pages\/[a-f0-9]{64}$/.test(value);
export function createWildsClearancePublicSdkV128(input:{applicationId:string;fetcher?:typeof fetch;signal?:AbortSignal}){
 return createReceizClient({baseUrl:'https://receiz.com',fetchImpl:async(request,init)=>{
  const url=new URL(String(request)),source=url.searchParams.get('url')??'';
  if(url.origin!=='https://receiz.com'||(init?.method??'GET')!=='GET')throw Error('wilds_clearance_public_path_invalid');
  const directory=url.pathname===WILDS_RESOURCE_SOURCE_PUBLISHER_PATH_V128&&url.searchParams.size===0;
  if(!directory&&(url.pathname!=='/api/public-proof/by-url'||url.searchParams.size!==1||!isWildsClearancePublicUrlV128(source)))throw Error('wilds_clearance_public_path_invalid');
  return (input.fetcher??fetch)(directory?'/api/wilds/clearance/source?directory=1':`/api/wilds/clearance/source?url=${encodeURIComponent(source)}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:input.signal});
 }});
}
export type WildsClearanceDisplayHistory=Readonly<Pick<WildsWorldProjection,'buildingClearances'|'clearanceTaken'>>;
/** One compact projection, no retained decoded event/Original/image history.
 * A public locator supplies historical display only. Explicit pickup opens a
 * different authenticated runtime and checks actual current source admission. */
export function createWildsClearancePublicReaderV128(fetcher:typeof fetch=fetch){
 let cached:WildsClearanceDisplayHistory|null=null,sha:string|null=null,cursor=0,lastSource:{index:number;sha:string}|null=null;
 let running:Promise<WildsClearanceDisplayHistory|null>|null=null;
 return {read(signal?:AbortSignal){
  if(running)return running;
  const operation=(async()=>{
   const configResponse=await fetcher('/api/wilds/clearance/source',{method:'GET',credentials:'omit',cache:'no-store',signal});
   if(!configResponse.ok)throw Error('wilds_clearance_public_unavailable');
   const config=await configResponse.json() as {applicationId?:string};if(!config.applicationId)throw Error('wilds_clearance_public_application_required');
   const sdk=createWildsClearancePublicSdkV128({applicationId:config.applicationId,fetcher,signal});
   try{await readWildsResourceLocatedProofV128(sdk,WILDS_RESOURCE_SOURCE_URL_V128,async(proof,coordinate)=>{
    const identity=proof.custodyArtifact.artifactSha256;
    if(sha===identity&&(!coordinate||coordinate.cursor===cursor))return;
    const verified=await verifyWildsResourceSourceProofV128(sdk,proof,{applicationId:config.applicationId!,historical:true});
    assertWildsResourceSourceCoordinateV128(verified,coordinate);
    if(verified.predecessor.head.cursor<cursor)return;
    const next=verified.predecessor.sourceArtifactShas;
    if(lastSource&&next[lastSource.index]!==lastSource.sha)throw Error('wilds_clearance_public_history_diverged');
    if(signal?.aborted)throw Error('wilds_clearance_public_cancelled');
    lastSource={index:next.length-1,sha:next[next.length-1]};sha=identity;cursor=verified.predecessor.head.cursor;
    cached=freezeConstructionProof({buildingClearances:{...verified.state.clearances},clearanceTaken:{...verified.state.clearanceTaken}});
   });}catch(cause){if(!cached||signal?.aborted)throw cause;}
   return cached;
  })();running=operation;void operation.finally(()=>{if(running===operation)running=null;}).catch(()=>undefined);return operation;
 }};
}
