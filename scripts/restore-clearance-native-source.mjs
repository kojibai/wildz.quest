/** Read-only resume of the exact isolated qualification artifacts. No enrollment,
 * identity access, signing, publication or network. Local byte-page transport
 * exercises the existing archive reader; every Original still opens natively.
 */
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createReceizClient,canonicalizeReceizV122,receizBase64UrlEncode,sha256ReceizBytes} from '@receiz/sdk';
import {compactWildsResourceSourceProofV128,assertWildsResourceSourceRequestCapacityV128} from '../.test-build/src/lib/receiz/wilds-resource-source-archive-v128.js';
import {verifyWildsResourceSourceProofV128} from '../.test-build/src/lib/receiz/wilds-resource-exchange-v128.js';

const directory=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--directory'||!/^\/private\/tmp\/wildz-clearance-native-[a-zA-Z0-9]+$/.test(directory??''))throw Error('Explicit existing disposable directory required: --directory /private/tmp/wildz-clearance-native-XXXXXX');
const directoryStat=await stat(directory);assert.equal(directoryStat.isDirectory(),true);assert.equal(directoryStat.mode&0o777,0o700);
let network=0,stage='root-opening-retained-originals';
const sdk=createReceizClient({applicationId:'wildz',fetchImpl:async()=>{network++;throw Error('qualification_network_forbidden');}});
const encode=value=>new TextEncoder().encode(canonicalizeReceizV122(value));
try{
 const payloads=new Map();
 const artifact=async filename=>{
  const path=join(directory,filename),info=await stat(path);assert.equal(info.mode&0o077,0);
  // offlineSeal's JSON output preserves the original input MIME (Vc/json).
  const bytes=new Uint8Array(await readFile(path)),mimeType='application/vnd.receiz.portable-asset.v1+json';
  const opened=await sdk.artifacts.verifyAndOpen(new File([bytes],filename,{type:mimeType}));
  assert.equal(opened.sealedArtifact.verification.ok,true);
  payloads.set(filename,opened.verifiedPayload.bytes);
  return {schema:'receiz.sealed-artifact-bytes.v124',filename,mimeType,exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:await sha256ReceizBytes(opened.verifiedPayload.bytes)};
 };
 const sources=[];for(let index=1;index<=3;index++)sources.push(await artifact(`disposable-source-${index}.receized.json`));
 const custody=await artifact('disposable-custody-3.receized.json');
 const inline={schema:'wildz.resource-source-proof.v128',custodyArtifact:custody,sourceArtifacts:sources};
 const inlineBytes=encode(inline).length;
 const requestMeasurement={applicationId:'wildz',authoritySessionHandle:'fixture-measurement-never-sent',sourceArtifact:sources.at(-1)};
 const custodyPayload=payloads.get('disposable-custody-3.receized.json');
 const hostCapacity={};
 for(const [name,request] of [['source',requestMeasurement],['custody',null]]){
  try{await assertWildsResourceSourceRequestCapacityV128(request,custodyPayload);hostCapacity[name]='within-existing-budget';}
  catch(error){hostCapacity[name]=error instanceof Error?error.message:String(error);}
 }
 stage='existing-byte-archive-compaction';
 const pages=new Map();
 const save=async(page,reference)=>{pages.set(reference.digest,page);};
 const proof=await compactWildsResourceSourceProofV128(inline,save,save);
 // This fixture port transports exact local bytes only. It does not replace
 // artifacts, domains, candidate verification, source replay or native roots.
 const localTransport={...sdk,publicStore:{...sdk.publicStore,async restoreLatest({url}){
  const prefix='https://wildz.quest/receiz/resource-source-v128/pages/';
  if(!url.startsWith(prefix))throw Error('unexpected_fixture_transport_url');
  const page=pages.get(url.slice(prefix.length));if(!page)throw Error('local_original_page_missing');
  return {storeStateRecord:{schema:'wildz.resource-source-page-locator.v128',page}};
 }}};
 stage='fresh-native-application-restoration';
 const restored=await verifyWildsResourceSourceProofV128(localTransport,proof,{applicationId:'wildz',historical:true});
 assert.equal(restored.events.length,3);
 const event=restored.events.at(-1).event,command=event.commands.at(-1).command;
 assert.equal(command.type,'construction.clearance.pickup');
 assert.equal(restored.state.clearanceTaken[command.pileId],1);
 const members=Object.values(restored.state.looseMembers);assert.equal(members.length,1);assert.equal(members[0].member.kind,'material');assert.equal(members[0].member.materialLot.quantity,1);
 const changed=structuredClone(proof);changed.sourceArtifacts[0].payloadSha256='0'.repeat(64);
 await assert.rejects(verifyWildsResourceSourceProofV128(localTransport,changed,{applicationId:'wildz',historical:true}));
 assert.equal(network,0);
 await writeFile(join(directory,'restored-source-packet.private.json'),canonicalizeReceizV122({proof,pages:[...pages]}),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({status:'verified-local-native-source',directory,head:restored.predecessor.head.head,sourceArtifactSha256:restored.predecessor.artifact.artifactSha256,custodyArtifactSha256:custody.artifactSha256,sourceSegments:3,pickupMembers:1,inlineBytes,compactedBytes:encode(proof).length,localBytePages:pages.size,offlineNetworkCalls:network,clearanceSemantics:true,candidateAuthorGrant:'fixture-only',transport:'existing-archive-reader-with-local-byte-pages',hostCapacity,hostAuthority:false,hostPublication:false,hostCAS:false}));
}catch(error){console.error(JSON.stringify({status:'qualification-failed',stage,directory,error:error instanceof Error?error.message:String(error),offlineNetworkCalls:network,hostAuthority:false,hostPublication:false,hostCAS:false}));process.exitCode=1;}
