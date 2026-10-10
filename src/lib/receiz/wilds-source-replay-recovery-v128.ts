import type {ReceizClient} from '@receiz/sdk';
/** Rebuild SDK-held historical context through actual native reads when a cold
 * client knows only a later source. The SDK admits every linked Original; this
 * never imports a projection or treats an unknown publication as success. */
export async function readWildsSourceReplayAfterV128(sdk:ReceizClient,input:Readonly<{
 applicationId:string;domainId:string;afterHead:string|null;afterCursor:number;
 expectedRegistryDigest:string;expectedReducerDigest:string;
}>){
 const {afterCursor,...expected}=input;
 try{return await sdk.domains.verifiedReplayV124(expected);}catch(cause){
  if(input.afterHead===null||!(cause instanceof Error)||cause.message!=='V124_DOMAINS_PREVIOUS_REPLAY_REQUIRED')throw cause;
 }
 let afterHead:string|null=null,cursor=0;
 while(cursor<afterCursor){
  const actual=await sdk.domains.verifiedReplayV124({...expected,afterHead});
  if(actual.cursor<=cursor||actual.cursor>afterCursor||!actual.additions.length)throw Error('wilds_source_recovery_predecessor_mismatch');
  cursor=actual.cursor;afterHead=actual.head;
 }
 if(afterHead!==input.afterHead)throw Error('wilds_source_recovery_predecessor_mismatch');
 return sdk.domains.verifiedReplayV124(expected);
}
