/** Explicit reuse of one isolated qualification signer. Never enrolls, opens
 * default custody, publishes sources or sends financial/listing operations.
 * New private attempts preserve every old literal qualification artifact.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {createReceizNodeOfflineSealer} from '@receiz/sdk/offline/node';
import {createReceizClient,canonicalizeReceizV122,readReceizIdentityArtifact,receizBase64UrlEncode,receizBase64UrlDecode,receizKaiNow,serializeReceizPortableAssetDocument,sha256ReceizBytes} from '@receiz/sdk';
import {prepareWildsResourceSourcePageV128,WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128} from '../.test-build/src/lib/receiz/wilds-resource-source-v128.js';
import {verifyWildsResourceSourceProofV128,verifyWildsResourceGameplayCardV128,wildsResourceSourceNamespaceV128} from '../.test-build/src/lib/receiz/wilds-resource-exchange-v128.js';
import {WILDS_RESOURCE_DOMAIN_V128,WILDS_RESOURCE_REGISTRY_DIGEST_V128,WILDS_RESOURCE_REDUCER_DIGEST_V128,WILDS_RESOURCE_GENESIS_HEAD_V128} from '../.test-build/src/lib/receiz/wilds-resource-journal-v128.js';
import {prepareWildsPortableDocumentV128} from '../.test-build/src/lib/receiz/wilds-portable-document-v128.js';
import {deriveWildsClearanceCommandV128,planWildsClearancePickupV128} from '../.test-build/src/lib/receiz/wilds-clearance-admission-v128.js';
import {encodeWildsResourceEventV128,decodeWildsResourceEventV128,WILDS_RESOURCE_EVENT_CODEC_HEAD_V128} from '../.test-build/src/lib/receiz/wilds-resource-event-codec-v128.js';
import {assertWildsResourceSourceRequestCapacityV128,assertWildsResourceSourceArchiveCapacityV128} from '../.test-build/src/lib/receiz/wilds-resource-source-archive-v128.js';
import {projectWildsBuildingClearancePiles} from '../.test-build/src/features/play/wilds-building-clearance.js';
import {paidClearanceTrace} from '../.test-build/tests/support/clearance-source-fixture.js';

const directory=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--directory'||!/^\/private\/tmp\/wildz-clearance-native-[a-zA-Z0-9]+$/.test(directory??''))throw Error('Use --directory with the reviewed existing disposable native qualification directory.');
assert.equal((await stat(directory)).mode&0o777,0o700);
const encode=value=>new TextEncoder().encode(canonicalizeReceizV122(value));
const readPrivate=async name=>{const path=join(directory,name);assert.equal((await stat(path)).mode&0o077,0);return new Uint8Array(await readFile(path));};
const readOptional=async name=>{try{return await readPrivate(name);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const writePrivate=async(name,bytes)=>{const old=await readOptional(name);if(old){assert.deepEqual(old,new Uint8Array(bytes));return;}await writeFile(join(directory,name),bytes,{mode:0o600,flag:'wx'});};
let stage='existing-private-identity',network=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('qualification_network_forbidden');};
try{
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch});
 const completed=await Promise.all(['twelve','compound'].map(async name=>({name,bytes:await readOptional(`codec-v2-${name}-packet.private.json`)})));
 if(completed.every(row=>row.bytes)){
  const outcomes=[];
  for(const {name,bytes} of completed){
   const proof=JSON.parse(new TextDecoder().decode(bytes));stage=`${name}:retained-packet-restoration`;
   const restored=await verifyWildsResourceSourceProofV128(createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch}),proof,{applicationId:'wildz',historical:true});
   assert.equal(restored.events.length,3);const command=restored.events.at(-1).event.commands.at(-1).command;
   assert.equal(command.type,'construction.clearance.pickup');assert.equal(restored.state.clearanceTaken[command.pileId],1);assert.equal(Object.keys(restored.state.looseMembers).length,1);
   outcomes.push({case:name,head:restored.predecessor.head.head,sourceArtifactSha256:restored.predecessor.artifact.artifactSha256,sourceSegments:3,pickupMembers:1});
  }
  assert.equal(network,0);console.log(JSON.stringify({status:'verified-retained-native-codec-source',directory,outcomes,offlineNetworkCalls:network,identityAccess:false,sealing:false,hostAuthority:false,hostPublication:false,hostCAS:false}));
 }else{
 const identityName='identity.receized.receizkey',identity=await readPrivate(identityName);
 const opened=await sdk.artifacts.verifyAndOpen(new File([identity],identityName,{type:'application/json'}));
 const keyFile=await readReceizIdentityArtifact(opened.verifiedPayload.bytes),passphrase=new TextDecoder().decode(await readPrivate('identity-passphrase.private'));
 const ownerReceizId=`${keyFile.owner.username}.receiz.id`;
 const sealer=await createReceizNodeOfflineSealer({directory,identityArtifactPath:join(directory,identityName),identityPassphrase:passphrase});assert.equal(await sealer.ready(),true);
 const now=receizKaiNow(),grant={schema:'receiz.identity.proof-authority.v123',applicationId:'wildz',keyId:keyFile.keyId,artifactDigest:await sha256ReceizBytes(identity),grantedScopes:[...WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128],issuedAtKai:now.pulse-1,expiresAtKai:now.pulse+600,nonce:'disposable-codec-fixture',revocationHead:'b'.repeat(64),tokenType:'Bearer',expiresIn:300,refreshable:false,authority:{grantIsIdentityAuthority:false,strongerTruth:'receiz-identity-artifact'},authorityDigest:'c'.repeat(64),accessToken:'fixture-never-sent'};
 const authority={grant,keyFile,passphrase,ownerReceizId,actorSubjectId:`receiz:subject:${'d'.repeat(64)}`,actorSubjectHead:'e'.repeat(64)};
 const descriptor=async(bytes,filename,mimeType)=>{
  const result=await sdk.artifacts.verifyAndOpen(new File([bytes],filename,{type:mimeType}));assert.equal(result.legacyCompatibility,'current-native');
  return {schema:'receiz.sealed-artifact-bytes.v124',filename,mimeType,exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:result.verifiedPayload.sha256};
 };
 const worker=await descriptor(await readPrivate('disposable-worker.receized.png'),'disposable-worker.receized.png','image/png');
 const oldSource=await sdk.artifacts.verifyAndOpen(new File([await readPrivate('disposable-source-1.receized.json')],'disposable-source-1.receized.json',{type:'application/vnd.receiz.portable-asset.v1+json'}));
 const oldPortable=JSON.parse(new TextDecoder().decode(oldSource.verifiedPayload.bytes)),oldCarrier=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(oldPortable.payload.bytesBase64Url))),oldChild=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(oldCarrier.segment.exactSegmentBytesB64u)));
 const originalPaid=await decodeWildsResourceEventV128(JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(oldChild.replay.additions[0].exactEventBytesB64u))));
 const seal=async(bytes,name)=>{
  const filename=name.replace(/\.json$/,'.receized.json'),mimeType='application/vnd.receiz.portable-asset.v1+json';
  const held=await readOptional(filename),metadata=await readOptional(`${filename}.descriptor.private.json`);
  if(metadata){
   const result=JSON.parse(new TextDecoder().decode(metadata)),original=receizBase64UrlDecode(result.exactBytesB64u);
   assert.equal(result.filename,filename);if(held)assert.equal(result.exactBytesB64u,receizBase64UrlEncode(held));
   assert.deepEqual(await descriptor(original,result.filename,result.mimeType),result);assert.equal(result.payloadSha256,await sha256ReceizBytes(bytes));
   if(!held)await writePrivate(filename,original);return result;
  }
  if(held)throw Error('retained_exact_descriptor_required');
  const result=await sealer.seal({bytes,filename:name,mimeType});assert.equal(result.verification.ok,true);
  const retained=await descriptor(result.artifactBytes,result.filename,result.mimeType);
  // Returned MIME is part of exact custody. Never infer it from the input MIME
  // or filename when resuming a previously sealed Original.
  await writePrivate(`${result.filename}.descriptor.private.json`,encode(retained));await writePrivate(result.filename,result.artifactBytes);return retained;
 };
 const outcomes=[];
 for(const variant of [{name:'twelve',harvests:12,compound:false},{name:'compound',harvests:36,compound:true}]){
  stage=`${variant.name}:paid-trace`;
  const fixture=await paidClearanceTrace({...variant,owner:ownerReceizId,original:async()=>worker,verifyCard:(card,original)=>verifyWildsResourceGameplayCardV128(sdk,ownerReceizId,keyFile.keyId,card,original)});
  if(variant.name==='twelve')assert.deepEqual(fixture.commands,originalPaid.commands,'the complete original 12-harvest paid command prefix must remain exact');
  let current=null,proof=null;const measurements=[];
  async function append(event){
   const index=measurements.length+1,name=`codec-v2-${variant.name}-${index}`,cached=await readOptional(`${name}-preparation.private.json`);
   let prepared;
   if(cached){prepared=JSON.parse(new TextDecoder().decode(cached));assert.deepEqual(prepared.event,event);}
   else{
    stage=`${name}:prepare`;
    const generated=await prepareWildsResourceSourcePageV128({authority,page:{domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,genesisHead:WILDS_RESOURCE_GENESIS_HEAD_V128,appendId:`wildz:resource:${ownerReceizId}:${event.attemptId}`,event,...wildsResourceSourceNamespaceV128(),predecessor:current?.predecessor??null}});
    prepared={event,payloadB64u:receizBase64UrlEncode(generated.candidate.proofObject.payload.bytes),head:generated.candidate.carrier.head};
    await writePrivate(`${name}-preparation.private.json`,encode(prepared));
   }
   const candidateBytes=receizBase64UrlDecode(prepared.payloadB64u);
   stage=`${name}:seal-source`;
   const source=await seal(candidateBytes,`${name}-source.json`),head=prepared.head;
   assertWildsResourceSourceArchiveCapacityV128([source]);
   const custody={schema:'receiz.domain-replay-proof-custody.v124',proofObjectId:head.proofObjectId,applicationId:'wildz',domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,head:head.head,cursor:head.cursor,namespace:head.namespace,predecessorSourceArtifact:current?.predecessor.artifact??null,replaySourceArtifact:source,checkpointSourceArtifact:null,authority:{custodyIsProofAuthority:false,projectionIsProofAuthority:false,strongerTruth:'sealed-receiz-proof-object'}};
   const portable=await prepareWildsPortableDocumentV128({assetType:'proof_object',payload:{bytes:encode(custody),mimeType:'application/vnd.receiz.domain-replay-proof-carrier.v124+json'},ownership:{ownerReceizId,custody:'current',proofRef:'genesis'},provenance:{root:`profile:${keyFile.owner.username}`,appends:[]},settlement:{state:'none'}}),custodyBytes=serializeReceizPortableAssetDocument(portable);
   const request={applicationId:'wildz',authoritySessionHandle:'fixture-measurement-never-sent',sourceArtifact:source};
   stage=`${name}:production-capacity-preflight`;
   await assertWildsResourceSourceRequestCapacityV128(request,custodyBytes);
   const sourceRequestBytes=encode({path:'/api/sdk/v1/sources/publish',query:'applicationId=wildz',method:'POST',body:request}).length;
   const form=new FormData();form.set('file',new File([custodyBytes.slice().buffer],`wildz-resource-custody-${'0'.repeat(64)}.receizbundle`,{type:'application/vnd.receiz.portable-asset.v1+json'}));
   form.set('wildzSdkPath','/api/sdk/v1/assets/seal');form.set('wildzSdkQuery','');form.set('wildzSdkMethod','POST');
   const custodyRequestBytes=(await new Request('https://wildz.quest/api/wilds/wallet/source-sdk',{method:'POST',body:form}).arrayBuffer()).byteLength;
   stage=`${name}:seal-custody`;
   const custodyArtifact=await seal(custodyBytes,`${name}-custody.json`);
   proof={schema:'wildz.resource-source-proof.v128',custodyArtifact,sourceArtifacts:[...(proof?.sourceArtifacts??[]),source]};
   stage=`${name}:fresh-native-restoration`;
   current=await verifyWildsResourceSourceProofV128(createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch}),proof,{applicationId:'wildz',historical:true});
   assert.equal(current.predecessor.head.head,head.head);assert.deepEqual(current.state.traces[ownerReceizId].commands,event.commands);
   const delay=monitorEventLoopDelay({resolution:10});delay.enable();await new Promise(resolve=>setTimeout(resolve,15));delay.reset();
   const started=performance.now(),encoded=await encodeWildsResourceEventV128(event),encodedAt=performance.now(),decoded=await decodeWildsResourceEventV128(encoded),ended=performance.now();
   await new Promise(resolve=>setTimeout(resolve,15));delay.disable();assert.deepEqual(decoded,event);
   measurements.push({event:event.kind,commands:event.commands.length,decodedBytes:encode(event).length,encodedBytes:encode(encoded).length,candidatePayloadBytes:candidateBytes.length,sealedSourceBytes:receizBase64UrlDecode(source.exactBytesB64u).length,custodyPayloadBytes:custodyBytes.length,sealedCustodyBytes:receizBase64UrlDecode(custodyArtifact.exactBytesB64u).length,sourceRequestBytes,custodyRequestBytes,proofBytes:encode(proof).length,encodeMs:encodedAt-started,decodeMs:ended-encodedAt,nodeEventLoopMaxDelayMs:delay.max/1e6});
  }
  const attempt=`qualification:codec:v2:${variant.name}`,paid={schema:'wildz.resource-command.v128',kind:'replay',attemptId:`${attempt}:paid`,ownerReceizId,gameplayOwnerId:ownerReceizId,commands:fixture.commands};
  await append(paid);
  const derive=await deriveWildsClearanceCommandV128({state:current.state,ownerReceizId,gameplayOwnerId:ownerReceizId,commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:current.predecessor.head.head,kaiUPulse:fixture.kaiUPulse,commandId:`${attempt}:derive`});
  const cleared={...paid,attemptId:derive.commandId,commands:[...fixture.commands,{kind:'world',command:derive,kaiUPulse:fixture.kaiUPulse}]};await append(cleared);
  const pile=projectWildsBuildingClearancePiles([derive.payload.clearance],{}).find(row=>row.kind==='timber');assert.ok(pile);
  const proposal=planWildsClearancePickupV128({source:current,clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:current.predecessor.head.head,ownerReceizId,gameplayOwnerId:ownerReceizId,player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:fixture.kaiUPulse+1,commandId:`${attempt}:pickup`});
  await append({...cleared,kind:'use',attemptId:proposal.command.commandId,useCommandId:proposal.command.commandId,commands:[...cleared.commands,{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}]});
  assert.equal(current.state.clearanceTaken[pile.pileId],1);assert.equal(Object.keys(current.state.looseMembers).length,1);
  await writePrivate(`codec-v2-${variant.name}-packet.private.json`,encode(proof));
  outcomes.push({case:variant.name,harvests:variant.harvests,buildingNodes:fixture.commands.at(-1).command.definition.nodes.length,head:current.predecessor.head.head,sourceArtifactSha256:current.predecessor.artifact.artifactSha256,measurements});
 }
 assert.equal(network,0);
 console.log(JSON.stringify({status:'verified-local-native-codec-source',directory,codecHead:WILDS_RESOURCE_EVENT_CODEC_HEAD_V128,outcomes,productionCapacity:'all-existing-preflights-passed',offlineNetworkCalls:network,candidateAuthorGrant:'fixture-only',hostAuthority:false,hostPublication:false,hostCAS:false}));
 }
}catch(error){console.error(JSON.stringify({status:'qualification-failed',stage,directory,error:error instanceof Error?error.message:String(error),offlineNetworkCalls:network,hostAuthority:false,hostPublication:false,hostCAS:false}));process.exitCode=1;}finally{globalThis.fetch=originalFetch;}
