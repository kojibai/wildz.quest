/** Read-only qualification against retained genuine local Originals. The domain
 * currentness callback is explicitly a fixture, never authenticated host evidence. */
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createReceizClient,receizBase64UrlEncode,sha256ReceizBytes} from '@receiz/sdk';
import {createWildsResourcePackageExchangeV128,verifyWildsResourceSourceProofV128} from '../.test-build/src/lib/receiz/wilds-resource-exchange-v128.js';
import {planWildsClearancePickupV128} from '../.test-build/src/lib/receiz/wilds-clearance-admission-v128.js';
import {reduceWildsResourceJournalV128} from '../.test-build/src/lib/receiz/wilds-resource-journal-v128.js';
import {projectWildsBuildingClearancePiles} from '../.test-build/src/features/play/wilds-building-clearance.js';
import {createMemoryWildzContinuityDatabase} from '../.test-build/tests/support/memory-wildz-continuity-database.js';
const directory=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--directory'||!/^\/private\/tmp\/wildz-clearance-native-[a-zA-Z0-9]+$/.test(directory??''))throw Error('Use --directory with the reviewed existing disposable qualification directory.');
assert.equal((await stat(directory)).mode&0o777,0o700);
const read=async name=>{const path=join(directory,name);assert.equal((await stat(path)).mode&0o077,0);return new Uint8Array(await readFile(path));};
let network=0,roots=0,currentReads=0,writes=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('qualification_network_forbidden');};
try{
 const native=createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch});
 const proof=JSON.parse(new TextDecoder().decode(await read('codec-v2-twelve-packet.private.json')));
 const latest=await verifyWildsResourceSourceProofV128(native,proof,{applicationId:'wildz',historical:true});
 const filename='codec-v2-twelve-2-custody.receized.json',bytes=await read(filename),opened=await native.artifacts.verifyAndOpen(new File([bytes],filename,{type:'application/octet-stream'}));
 const before={...proof,sourceArtifacts:proof.sourceArtifacts.slice(0,2),custodyArtifact:{schema:'receiz.sealed-artifact-bytes.v124',filename,mimeType:'application/octet-stream',exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:opened.verifiedPayload.sha256}};
 const prior=await verifyWildsResourceSourceProofV128(native,before,{applicationId:'wildz',historical:true});
 const winner=latest.events.at(-1).event,pile=projectWildsBuildingClearancePiles(Object.values(prior.state.clearances),prior.state.clearanceTaken??{}).find(row=>row.pileId===winner.commands.at(-1).command.pileId);
 const loserProposal=planWildsClearancePickupV128({source:prior,clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:prior.predecessor.head.head,ownerReceizId:'recovery-loser.receiz.id',gameplayOwnerId:'recovery-loser',player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:winner.commands.at(-1).kaiUPulse,commandId:'recovery:stale-loser'});
 const loser={schema:'wildz.resource-command.v128',kind:'use',attemptId:loserProposal.command.commandId,ownerReceizId:loserProposal.ownerReceizId,gameplayOwnerId:loserProposal.gameplayOwnerId,commands:[{kind:'world',command:loserProposal.command,kaiUPulse:loserProposal.kaiUPulse}],useCommandId:loserProposal.command.commandId};
 await reduceWildsResourceJournalV128(prior.state,loser,{ownerReceizId:loser.ownerReceizId,expectedNativeHead:prior.predecessor.head.head});
 await assert.rejects(reduceWildsResourceJournalV128(latest.state,loser,{ownerReceizId:loser.ownerReceizId,expectedNativeHead:latest.predecessor.head.head}),/native_head_stale|pile_stale/);
 async function recover(event,mode){
  const database=createMemoryWildzContinuityDatabase(),key=JSON.stringify(['wildz.resource-exchange-attempt.v128',event.ownerReceizId,event.attemptId]);
  const retained={schema:'wildz.resource-exchange-attempt.v128',event,before};
  await database.transaction(['meta'],'readwrite',tx=>tx.put('meta',retained,key));
  const sdk={artifacts:native.artifacts,assets:{createProofObject:async()=>{writes++;throw Error('no_sealing');}},domains:{...native.domains,
   restoreVerifiedReplayProofObjectV124:async input=>{roots++;return native.domains.restoreVerifiedReplayProofObjectV124(input);},
   verifiedReplayV124:async input=>{currentReads++;assert.ok(roots>0);assert.equal(input.afterHead,latest.predecessor.head.head);if(mode==='unavailable')throw Error('fixture_native_currentness_unavailable');return {head:mode==='stale'?'f'.repeat(64):latest.predecessor.head.head,additions:[]};}}};
  const exchange=createWildsResourcePackageExchangeV128({sdk,database,authority:{grant:{applicationId:'wildz'},ownerReceizId:event.ownerReceizId,keyFile:{keyId:'unused-no-signing'}},session:{},gameplayOwnerId:event.gameplayOwnerId,locator:{read:async()=>proof,publish:async()=>{writes++;throw Error('no_publication');}}});
  const result=await exchange.recoverClearance(event.attemptId);
  assert.deepEqual(await database.read('meta',key),retained,'exact retained attempt and before Original remain unchanged');
  return result;
 }
 const rejected=await recover(loser,'current');assert.equal(rejected.status,'rejected');assert.equal(rejected.reason,'source_advanced_without_attempt');assert.deepEqual(rejected.members,[]);
 const accepted=await recover(winner,'current');assert.equal(accepted.status,'admitted');assert.equal(accepted.members.length,1);assert.equal(accepted.members[0].id,Object.values(latest.state.looseMembers)[0].member.id);
 for(const mode of ['unavailable','stale']){const outcome=await recover(loser,mode);assert.equal(outcome.status,'pending');assert.deepEqual(outcome.members,[]);}
 assert.equal(writes,0);assert.equal(network,0);
 console.log(JSON.stringify({status:'verified-exchange-recovery',staleLoser:'rejected',acceptedLostReply:'admitted-exact-member',unavailableCurrentness:'pending',staleLocator:'pending',nativeRootRestorations:roots,fixtureCurrentnessReads:currentReads,network,writes,identityAccess:false,sealing:false,hostCurrentness:false,hostCAS:false}));
}finally{globalThis.fetch=oldFetch;}
