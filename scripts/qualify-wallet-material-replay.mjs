import {assertWildsPaidPlacementFrontierV128} from '../.test-build/src/lib/receiz/wilds-clearance-admission-v128.js';
/** Read-only qualification using reviewed genuine retained source Originals.
 * No identity access, new signatures, sealing, publication or host CAS. */
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import ts from 'typescript';
import {createReceizClient,receizBase64UrlEncode,sha256ReceizBytes} from '@receiz/sdk';
import {verifyWildsResourceSourceProofV128,verifyWildsResourceGameplayCardV128} from '../.test-build/src/lib/receiz/wilds-resource-exchange-v128.js';
import {checkpointWildsWorld} from '../.test-build/src/features/play/wilds-world-state.js';
import {isWildsEdgeImmediateConstructionCommand} from '../.test-build/src/features/play/wilds-world-authority.js';
import {verifyWildsWorldAdmittedSource,persistWildsWorldCommandDurably,readWildsWorldOutbox} from '../.test-build/src/features/play/wilds-world-outbox.js';
import {reduceWildsResourceJournalV128,replayWildsResourceJournalOwnerV128} from '../.test-build/src/lib/receiz/wilds-resource-journal-v128.js';
import {wildsResourceGameplayCommandIdV128} from '../.test-build/src/lib/receiz/wilds-resource-gameplay-v128.js';
import {canonicalPortableCardJson} from '../.test-build/src/features/play/portable-card.js';
import {createReceizInMemoryOfflineProofQueueStorage} from '@receiz/sdk';
const directory=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--directory'||directory!=='/private/tmp/wildz-clearance-native-GpXcYj')throw Error('Use the reviewed retained qualification directory only.');
assert.equal((await stat(directory)).mode&0o777,0o700);
const readPrivate=async name=>{const path=join(directory,name);assert.equal((await stat(path)).mode&0o077,0);return new Uint8Array(await readFile(path));};
let network=0;const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('qualification_network_forbidden');};
try{
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch});
 const packet=JSON.parse(new TextDecoder().decode(await readPrivate('codec-v2-twelve-packet.private.json')));
 const filename='codec-v2-twelve-1-custody.receized.json',bytes=await readPrivate(filename),mimeType='application/octet-stream';
 const opened=await sdk.artifacts.verifyAndOpen(new File([bytes],filename,{type:mimeType}));assert.equal(opened.legacyCompatibility,'current-native');
 const proof={schema:'wildz.resource-source-proof.v128',sourceArtifacts:[packet.sourceArtifacts[0]],custodyArtifact:{schema:'receiz.sealed-artifact-bytes.v124',filename,mimeType,exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:opened.verifiedPayload.sha256}};
 const start=performance.now(),verified=await verifyWildsResourceSourceProofV128(createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch}),proof,{applicationId:'wildz',historical:true}),restoredMs=performance.now()-start;
 assert.equal(verified.events.length,1);const event=verified.events[0].event,last=event.commands.at(-1);
 assert.equal(event.kind,'replay');assert.equal(last.kind,'world');assert.equal(last.command.type,'creation.construct');
 const source=await readFile('src/lib/receiz/wilds-resource-exchange-v128.ts','utf8');
 const method=source.slice(source.indexOf('  async admitMaterialCommand('),source.indexOf('  async qualifyGameplay('));
 const code=ts.transpileModule('const operation={'+method+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 let recover=false,appends=0,fences=0,latest=null;
 const deps={assertWildsPaidPlacementFrontierV128,input:{sdk,database:{read:async()=>recover?{event}:null},locator:{read:async()=>null},gameplayOwnerId:event.gameplayOwnerId,authority:{keyFile:{keyId:'historical-already-verified'}}},owner:event.ownerReceizId,key:id=>id,current:async()=>latest,
  rejectUnpreparedWildsMaterialV128:async()=>false,reduceWildsResourceJournalV128,verifyWildsWorldAdmittedSource,wildsResourceGameplayCommandIdV128,checkpointWildsWorld,isWildsEdgeImmediateConstructionCommand,replayWildsResourceJournalOwnerV128,verifyWildsResourceGameplayCardV128,
  same:(a,b)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b),fail:reason=>{throw Error(reason);},resolveWildsResourceGameplayOriginalsV128:async()=>({commands:event.commands.slice(0,-1)}),
  append:async(candidate,beforeCommit,check)=>{appends++;assert.equal(canonicalPortableCardJson(candidate),canonicalPortableCardJson(event),'new operation must reproduce the exact genuine admitted event');await check(verified.state);await beforeCommit?.();return verified;}};
 const operation=new Function(...Object.keys(deps),code+'return operation;')(...Object.values(deps));
 const request={attemptId:event.attemptId,command:last},admitStart=performance.now();
 const first=await operation.admitMaterialCommand(request,async()=>{fences++;});recover=true;latest=verified;
 const recovered=await operation.admitMaterialCommand(structuredClone(request),async()=>{fences++;});
 assert.deepEqual(recovered,first);assert.equal(first.kind,'ordinary');assert.deepEqual(first.command,last);assert.ok(first.admittedSource);
 const entry={schema:'receiz.wilds_world_outbox_entry.v1',actorId:event.gameplayOwnerId,guestId:'retained-native-qualification',queuedAt:'2026-10-10T00:00:00.000Z',command:last.command,admittedSource:first.admittedSource,...(last.card?{card:last.card}:{})};
 const projected=verifyWildsWorldAdmittedSource(entry);assert.ok(projected.creations[last.command.instanceId]);assert.ok(first.projection.creations[last.command.instanceId]);
 const storage=createReceizInMemoryOfflineProofQueueStorage();await persistWildsWorldCommandDurably(entry,storage);await persistWildsWorldCommandDurably(structuredClone(entry),storage);
 assert.equal((await readWildsWorldOutbox(entry.actorId,storage)).length,1);
 const tampered=structuredClone(entry);tampered.command={...tampered.command,commandId:'qualification:substituted'};assert.throws(()=>verifyWildsWorldAdmittedSource(tampered),/mismatch/);
 assert.equal(network,0);assert.equal(appends,1);assert.equal(fences,1);
 const laterName='codec-v2-twelve-2-custody.receized.json',laterBytes=await readPrivate(laterName);
 const laterOpened=await sdk.artifacts.verifyAndOpen(new File([laterBytes],laterName,{type:mimeType}));
 latest=await verifyWildsResourceSourceProofV128(createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch}),{...proof,sourceArtifacts:packet.sourceArtifacts.slice(0,2),custodyArtifact:{...proof.custodyArtifact,filename:laterName,exactBytesB64u:receizBase64UrlEncode(laterBytes),artifactSha256:await sha256ReceizBytes(laterBytes),payloadSha256:laterOpened.verifiedPayload.sha256}},{applicationId:'wildz',historical:true});
 assert.equal(latest.events.length,2);assert.ok(Object.keys(latest.state.clearances).length);
 const advancedRecovery=await operation.admitMaterialCommand(structuredClone(request),async()=>{fences++;});
 assert.deepEqual(advancedRecovery.command,last);assert.deepEqual(advancedRecovery.events,first.events);assert.deepEqual(advancedRecovery.admittedSource,first.admittedSource);
 assert.deepEqual(advancedRecovery.projection.buildingClearances,latest.state.clearances);assert.deepEqual(advancedRecovery.projection.clearanceTaken,latest.state.clearanceTaken);
 assert.equal(appends,1);assert.equal(fences,1);assert.equal(network,0);
 console.log(JSON.stringify({status:'verified-retained-native-ordinary-replay',head:verified.predecessor.head.head,sourceArtifactSha256:verified.predecessor.artifact.artifactSha256,commands:event.commands.length,restoredMs,operationAndRecoveryMs:performance.now()-admitStart,exactEvent:true,exactRecovery:true,checkpointBinding:true,laterClearanceHead:latest.predecessor.head.head,laterClearancesRetained:Object.keys(latest.state.clearances).length,noRepeatedPublicationCallback:true,durableEntries:1,offlineNetworkCalls:network,identityAccess:false,signing:false,sealing:false,hostAuthority:false,hostPublication:false,hostCAS:false}));
}finally{globalThis.fetch=oldFetch;}
