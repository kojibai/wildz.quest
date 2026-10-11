/** Explicit disposable root/source qualification. Never imported by the app/tests.
 * Candidate grant/actor coordinates below are fixture metadata, NOT hosted grants.
 * Run only after review: node scripts/qualify-clearance-native-source.mjs --enroll-disposable
 * Requires the normal test compilation so the actual application verifier is used.
 */
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {createReceizNodeOfflineSealer} from '@receiz/sdk/offline/node';
import {canonicalizeReceizV122, createReceizClient, readReceizIdentityArtifact,
 receizBase64UrlEncode, receizKaiNow, serializeReceizPortableAssetDocument, sha256ReceizBytes} from '@receiz/sdk';
import {prepareWildsResourceSourcePageV128, WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128} from '../.test-build/src/lib/receiz/wilds-resource-source-v128.js';
import {verifyWildsResourceSourceProofV128, verifyWildsResourceGameplayCardV128, wildsResourceSourceNamespaceV128} from '../.test-build/src/lib/receiz/wilds-resource-exchange-v128.js';
import {WILDS_RESOURCE_DOMAIN_V128, WILDS_RESOURCE_REGISTRY_DIGEST_V128, WILDS_RESOURCE_REDUCER_DIGEST_V128,
 WILDS_RESOURCE_GENESIS_HEAD_V128} from '../.test-build/src/lib/receiz/wilds-resource-journal-v128.js';
import {prepareWildsPortableDocumentV128} from '../.test-build/src/lib/receiz/wilds-portable-document-v128.js';
import {deriveWildsClearanceCommandV128,planWildsClearancePickupV128} from '../.test-build/src/lib/receiz/wilds-clearance-admission-v128.js';
import {projectWildsBuildingClearancePiles} from '../.test-build/src/features/play/wilds-building-clearance.js';
import {paidClearanceTrace} from '../.test-build/tests/support/clearance-source-fixture.js';
import {embedPortableVaultInPng} from '../.test-build/src/features/play/card-export.js';
import {createWildsPlayerVault} from '../.test-build/src/features/play/wilds-player-vault.js';
import {initialPlayState} from '../.test-build/src/features/play/game-state.js';
import {createWildzIdentityBoundPlayerVault} from '../.test-build/src/lib/receiz/wildz-identity-vault-binding.js';
import {packWildzCardSealPayload} from '../.test-build/src/lib/receiz/wildz-card-seal-payload.js';

if (process.argv.length !== 3 || process.argv[2] !== '--enroll-disposable') {
 throw Error('Explicit opt-in required: --enroll-disposable. Creates fresh private /private/tmp custody only.');
}
const directory = await mkdtemp('/private/tmp/wildz-clearance-native-');
await chmod(directory, 0o700);
const encode = value => new TextEncoder().encode(canonicalizeReceizV122(value));
let stage = 'isolated-enrollment', offlineNetworkCalls = 0;
const originalFetch = globalThis.fetch;
try {
 const unbound = await createReceizNodeOfflineSealer({directory});
 assert.equal(await unbound.ready(), false);
 // Only this explicit line may contact the SDK's pinned canonical issuer.
 await unbound.enroll();
 globalThis.fetch = async () => {offlineNetworkCalls++; throw Error('qualification_network_forbidden');};
 stage = 'disposable-identity';
 const passphrase = randomBytes(48).toString('base64url');
 const identity = await unbound.createIdentity({passphrase});
 const identityPath = join(directory, identity.filename);
 await writeFile(identityPath, identity.artifactBytes, {mode:0o600, flag:'wx'});
 await writeFile(join(directory, 'identity-passphrase.private'), passphrase, {mode:0o600, flag:'wx'});
 const sdk = createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch});
 const openedIdentity = await sdk.artifacts.verifyAndOpen(new File([identity.artifactBytes], identity.filename, {type:identity.mimeType}));
 const keyFile = await readReceizIdentityArtifact(openedIdentity.verifiedPayload.bytes);
 const ownerReceizId = `${keyFile.owner.username}.receiz.id`;
 const sealer = await createReceizNodeOfflineSealer({directory,identityArtifactPath:identityPath,identityPassphrase:passphrase});
 const now = receizKaiNow();
 const grant = {schema:'receiz.identity.proof-authority.v123',applicationId:'wildz',keyId:keyFile.keyId,
  artifactDigest:await sha256ReceizBytes(identity.artifactBytes),grantedScopes:[...WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128],
  issuedAtKai:now.pulse-1,expiresAtKai:now.pulse+600,nonce:'disposable-candidate-author-fixture',revocationHead:'b'.repeat(64),
  tokenType:'Bearer',expiresIn:300,refreshable:false,authority:{grantIsIdentityAuthority:false,strongerTruth:'receiz-identity-artifact'},
  authorityDigest:'c'.repeat(64),accessToken:'fixture-never-sent'};
 const authority = {grant,keyFile,passphrase,ownerReceizId,actorSubjectId:`receiz:subject:${'d'.repeat(64)}`,actorSubjectHead:'e'.repeat(64)};
 const seal = async (bytes, filename, mimeType='application/vnd.receiz.portable-asset.v1+json') => {
  const sealed = await sealer.seal({bytes,filename,mimeType});
  assert.equal(sealed.verification.ok,true);
  await writeFile(join(directory,sealed.filename),sealed.artifactBytes,{mode:0o600,flag:'wx'});
  return {schema:'receiz.sealed-artifact-bytes.v124',filename:sealed.filename,mimeType:sealed.mimeType,
   exactBytesB64u:receizBase64UrlEncode(sealed.artifactBytes),artifactSha256:await sha256ReceizBytes(sealed.artifactBytes),payloadSha256:await sha256ReceizBytes(bytes)};
 };
 stage = 'genuine-worker-original';
 const fixture=await paidClearanceTrace({owner:ownerReceizId,verifyCard:(card,original)=>verifyWildsResourceGameplayCardV128(sdk,ownerReceizId,keyFile.keyId,card,original),original:async card=>{
  const player=createWildsPlayerVault({playerId:ownerReceizId,exportedAt:'2026-10-10T00:00:00.000Z',playState:{...initialPlayState,inventory:[card]},settings:{avatarStyle:null,movementMode:'walk',audio:{}},personalEvents:[],canonicalCursor:{worldId:'wilds:global:v3',revision:0,eventId:null},receipts:[]});
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
  const signed=await createWildzIdentityBoundPlayerVault({keyFile,passphrase,vaultBytes:embedPortableVaultInPng(png,[card],player)});
  return seal(await packWildzCardSealPayload(signed),'disposable-worker.png','image/png');
 }});
 let restored=null,proof=null;
 const fresh=createReceizClient({applicationId:'wildz',fetchImpl:globalThis.fetch});
 async function appendLocal(event){
  stage=`source-preparation:${event.attemptId}`;
  const previous=restored?.predecessor??null;
  const prepared=await prepareWildsResourceSourcePageV128({authority,page:{domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,genesisHead:WILDS_RESOURCE_GENESIS_HEAD_V128,appendId:`wildz:resource:${ownerReceizId}:${event.attemptId}`,event,...wildsResourceSourceNamespaceV128(),predecessor:previous}});
  const index=(proof?.sourceArtifacts.length??0)+1;
  stage=`source-sealing:${index}`;
  const source=await seal(prepared.candidate.proofObject.payload.bytes,`disposable-source-${index}.json`),head=prepared.candidate.carrier.head;
  const custody = {schema:'receiz.domain-replay-proof-custody.v124',proofObjectId:head.proofObjectId,applicationId:'wildz',
  domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,
  head:head.head,cursor:head.cursor,namespace:head.namespace,predecessorSourceArtifact:previous?.artifact??null,replaySourceArtifact:source,checkpointSourceArtifact:null,
  authority:{custodyIsProofAuthority:false,projectionIsProofAuthority:false,strongerTruth:'sealed-receiz-proof-object'}};
 const portable = await prepareWildsPortableDocumentV128({assetType:'proof_object',payload:{bytes:encode(custody),mimeType:'application/vnd.receiz.domain-replay-proof-carrier.v124+json'},
  ownership:{ownerReceizId,custody:'current',proofRef:'genesis'},provenance:{root:`profile:${keyFile.owner.username}`,appends:[]},settlement:{state:'none'}});
  stage=`custody-sealing:${index}`;
  const custodyArtifact=await seal(serializeReceizPortableAssetDocument(portable),`disposable-custody-${index}.json`);
  proof={schema:'wildz.resource-source-proof.v128',custodyArtifact,sourceArtifacts:[...(proof?.sourceArtifacts??[]),source]};
  stage=`fresh-native-application-restoration:${index}`;
  restored=await verifyWildsResourceSourceProofV128(fresh,proof,{applicationId:'wildz',historical:true});
  assert.equal(restored.predecessor.head.head,head.head);
  assert.deepEqual(restored.state.traces[ownerReceizId].commands,event.commands);
 }
 const paid={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'qualification:paid',ownerReceizId,gameplayOwnerId:ownerReceizId,commands:fixture.commands};
 await appendLocal(paid);
 const derive=await deriveWildsClearanceCommandV128({state:restored.state,ownerReceizId,gameplayOwnerId:ownerReceizId,commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:restored.predecessor.head.head,kaiUPulse:fixture.kaiUPulse,commandId:'qualification:clearance'});
 const cleared={...paid,attemptId:derive.commandId,commands:[...fixture.commands,{kind:'world',command:derive,kaiUPulse:fixture.kaiUPulse}]};
 await appendLocal(cleared);
 const pile=projectWildsBuildingClearancePiles([derive.payload.clearance],{}).find(row=>row.kind==='timber');assert.ok(pile);
 const proposal=planWildsClearancePickupV128({source:restored,clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:restored.predecessor.head.head,ownerReceizId,gameplayOwnerId:ownerReceizId,player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:fixture.kaiUPulse+1,commandId:'qualification:pickup'});
 await appendLocal({...cleared,kind:'use',attemptId:proposal.command.commandId,useCommandId:proposal.command.commandId,commands:[...cleared.commands,{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}]});
 assert.equal(restored.state.clearanceTaken[pile.pileId],1);assert.equal(Object.keys(restored.state.looseMembers).length,1);
 assert.equal(offlineNetworkCalls,0);
 const tampered = structuredClone(proof);tampered.sourceArtifacts[0].payloadSha256='0'.repeat(64);
 await assert.rejects(verifyWildsResourceSourceProofV128(fresh,tampered,{applicationId:'wildz',historical:true}));
 await writeFile(join(directory,'source-packet.private.json'),canonicalizeReceizV122(proof),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({status:'verified-local-native-source',directory,head:restored.predecessor.head.head,sourceArtifactSha256:restored.predecessor.artifact.artifactSha256,
  custodyArtifactSha256:proof.custodyArtifact.artifactSha256,offlineNetworkCalls,candidateAuthorGrant:'fixture-only',hostAuthority:false,hostPublication:false,hostCAS:false,clearanceSemantics:true,sourceSegments:3,pickupMembers:1}));
} catch(error) {
 console.error(JSON.stringify({status:'qualification-failed',stage,directory,error:error instanceof Error?error.message:String(error),offlineNetworkCalls,hostAuthority:false,hostPublication:false,hostCAS:false}));
 process.exitCode=1;
} finally {globalThis.fetch=originalFetch;}
