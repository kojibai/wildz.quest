import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReceizIdIdentity} from '@receiz/sdk';
import * as ownership from '../src/lib/receiz/wildz-ownership-reconcile';
import {sealCollectedCard,canonicalPortableCardJson} from '../src/features/play/portable-card';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {createPublicWildzProfileRecord} from '../src/lib/receiz/wildz-profile-record';
import {projectWildzMarketCollection,projectWildzMarketTransfers} from '../src/lib/receiz/wildz-market-collection';

test('a successful foreign upload keeps one immutable card and records exact signed ownership across retries',async()=>{
 const record=(ownership as Record<string,unknown>).recordWildzUploadOwnershipClaims as ((input:any)=>Promise<any[]>)|undefined;
 const verify=(ownership as Record<string,unknown>).verifyWildzPublishedOwnershipClaims as ((claims:unknown[])=>Promise<unknown[]>)|undefined;
 assert.equal(typeof record,'function','explicit upload needs a separate signed claim');
 assert.equal(typeof verify,'function');
 const identity=await createReceizIdIdentity({username:'next_keeper',displayName:'Next'}),database=createMemoryWildzContinuityDatabase();
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'uploaded-once',capturedAt:'2026-09-09T11:00:00.000Z'}),before=canonicalPortableCardJson(card);
 const session={keyId:identity.keyFile.keyId,actorId:'next_keeper',localAuthority:'verified',remoteStatus:'offline'};
 const input={database,session,keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1,2,3]),attemptId:'upload-one',kaiUPulse:'123000001',uploadedAt:'2026-10-12T12:00:00.000Z'};
 const [claim]=await record!(input);assert.ok(claim);
 const [repeated]=await record!({...input,kaiUPulse:'123999999'});
 assert.deepEqual(repeated,claim);assert.equal(canonicalPortableCardJson(card),before);
 const [reasserted]=await record!({...input,attemptId:'upload-two',kaiUPulse:'123999999'});assert.notEqual(reasserted.claim.kaiUPulse,claim.claim.kaiUPulse);
 const verified=await verify!([claim]);assert.equal(verified.length,1);
 assert.equal(ownership.latestWildzOwnershipClaims(verified).heads.get(card.id)?.witnessedKaiUPulse,'123000001');
 const oldProfile=createPublicWildzProfileRecord({username:'first_keeper',vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]},'https://wildz.quest/u/first_keeper','2026-10-12T12:01:00.000Z');
 const newProfile=createPublicWildzProfileRecord({username:'next_keeper',vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]},'https://wildz.quest/u/next_keeper','2026-10-11T12:00:00.000Z');
 const cards=projectWildzMarketCollection([oldProfile,newProfile],verified);assert.equal(cards.length,1);assert.equal(cards[0]?.ownerHandle,'next_keeper.receiz.id');
 assert.equal(projectWildzMarketTransfers(verified,cards).length,1);
 assert.deepEqual(ownership.lostWildzOwnershipAssetIdsFromSync(verified,'first_keeper',[card.id]),[card.id]);
 const tampered=structuredClone(claim);tampered.claim.kaiUPulse='999999999';assert.deepEqual(await verify!([tampered]),[]);
 assert.equal(ownership.latestWildzOwnershipClaims([structuredClone(claim)]).heads.size,0,'unverified JSON is not an ownership claim');
});

test('an unresolved legacy duplicate retains one visible card without assigning upload order',()=>{
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'legacy-duplicate',capturedAt:'2026-09-09T11:00:00.000Z'});
 const profile=(username:string)=>createPublicWildzProfileRecord({username,vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]},`https://wildz.quest/u/${username}`);
 const first=profile('first_keeper'),second=profile('next_keeper');
 const cards=projectWildzMarketCollection([first,second],[]);assert.equal(cards.length,1);assert.equal(cards[0]?.ownerHandle,'');
 assert.equal(projectWildzMarketTransfers([],cards).length,0);
 assert.deepEqual(projectWildzMarketCollection([second,first],[]),cards);
});

test('creator can reassert a new explicit upload without knowing a remote holder',async()=>{
 const record=(ownership as Record<string,unknown>).recordWildzUploadOwnershipClaims as (input:any)=>Promise<any[]>;
 const identity=await createReceizIdIdentity({username:'first_keeper',displayName:'First'}),database=createMemoryWildzContinuityDatabase();
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'creator-reclaim',capturedAt:'2026-09-09T11:00:00.000Z'});
 const [claim]=await record({database,session:{keyId:identity.keyFile.keyId,actorId:'first_keeper',localAuthority:'verified',remoteStatus:'offline'},keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'explicit-creator-upload',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 assert.ok(claim);assert.equal(claim.claim.ownerReceizId,'first_keeper.receiz.id');
});

test('verified upload claims grant local gameplay custody without issuing a native bearer source',async()=>{
 const codec=await import('../src/lib/receiz/wildz-artifact-codec');
 const admit=(codec as Record<string,unknown>).admitWildzUploadClaimCrewCustody as ((input:any)=>Promise<any>)|undefined;
 assert.equal(typeof admit,'function');
 const record=(ownership as Record<string,unknown>).recordWildzUploadOwnershipClaims as (input:any)=>Promise<any[]>;
 const identity=await createReceizIdIdentity({username:'crew_keeper',displayName:'Crew'}),database=createMemoryWildzContinuityDatabase();
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'upload-crew',capturedAt:'2026-09-09T11:00:00.000Z'});
 const session={keyId:identity.keyFile.keyId,actorId:'crew_keeper',localAuthority:'verified',remoteStatus:'offline'};
 const claims=await record({database,session,keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'local-crew-upload',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const token=await admit!({session,cards:[card],claims});assert.equal(codec.canOperateWildzCrewCard(card,session.actorId,token),true);
 assert.deepEqual(codec.wildzCrewOwnershipWitnesses(token,[card]),[]);
 assert.equal(await admit!({session:{...session,keyId:'f'.repeat(64)},cards:[card],claims}),null);
 const other=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'other-root',capturedAt:'2026-09-09T11:00:00.000Z'});
 assert.equal(await admit!({session,cards:[other],claims}),null);
 assert.equal(codec.canOperateWildzCrewCard(other,session.actorId,token),false);
});

test('a restored signed receipt preserves the newest exact claim without stamping import time',async()=>{
 const upload=await import('../src/lib/receiz/wildz-upload-ownership');
 const retain=(upload as Record<string,unknown>).retainVerifiedWildzUploadOwnershipClaims as ((database:any,values:unknown[])=>Promise<unknown[]>)|undefined;
 assert.equal(typeof retain,'function');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'restored-claim',capturedAt:'2026-09-09T11:00:00.000Z'}),db=createMemoryWildzContinuityDatabase(),cold=createMemoryWildzContinuityDatabase();
 const identity=await createReceizIdIdentity({username:'receipt_keeper',displayName:'Receipt'});
 const input={database:db,session:{keyId:identity.keyFile.keyId,actorId:'receipt_keeper',localAuthority:'verified' as const,remoteStatus:'offline' as const},keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'receipt-one',kaiUPulse:'123000001',uploadedAt:'2026-10-12T12:00:00.000Z'};
 const claims=await upload.recordWildzUploadOwnershipClaims(input),newer=await upload.recordWildzUploadOwnershipClaims({...input,attemptId:'receipt-two',kaiUPulse:'123999999'});
 await retain!(cold,newer);await retain!(cold,claims);
 const recovered=await upload.readWildzUploadOwnershipHeads(cold,[card.id]);assert.equal(recovered[0]?.claim.kaiUPulse,'123999999');
 assert.ok(Object.isFrozen(recovered[0]));assert.ok(Object.isFrozen(recovered[0]?.claim.cardRoot));
 const forged={...newer[0]!,claim:{...newer[0]!.claim,ownerReceizId:'forged_keeper.receiz.id'}};assert.deepEqual(await retain!(cold,[forged]),[]);
});

test('signed public receivers bind the upload claim to the publisher key and exact card root',async()=>{
 const {createReceizClient}=await import('@receiz/sdk');
 const {publishWildzProfileWithIdentityProof}=await import('../src/lib/receiz/wildz-profile-identity-publication');
 const {parseSignedWildzProfilePublication}=await import('../src/lib/receiz/wildz-profile-publication-envelope');
 const {parseSignedWildzCardPublication}=await import('../src/lib/receiz/wildz-card-publication-envelope');
 const {publishWildzCardWithIdentityProof}=await import('../src/lib/receiz/wildz-card-identity-publication');
 const {sanitizePublicWildzProfile}=await import('../src/features/profile/public-profile');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'receiver-key-binding',capturedAt:'2026-09-09T11:00:00.000Z'}),database=createMemoryWildzContinuityDatabase();
 const identity=await createReceizIdIdentity({username:'bound_keeper',displayName:'Bound'});
 const session={schema:'receiz.wildz.identity_session.v1',keyId:identity.keyFile.keyId,actorId:'bound_keeper',username:'bound_keeper',localAuthority:'verified',remoteStatus:'offline',portableStateStatus:'verified'} as import('../src/lib/receiz/wildz-identity-repository').WildzIdentitySession;
 const claims=await ownership.recordWildzUploadOwnershipClaims({database,session,keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'receiver-upload',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const profile=sanitizePublicWildzProfile({username:session.actorId,vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]});
 const repository={active:async()=>session,withKeyFile:async <T>(_id:string,action:(key:typeof identity.keyFile)=>Promise<T>)=>action(identity.keyFile)};
 await publishWildzProfileWithIdentityProof(profile,{repository,assets:[card],ownershipClaims:claims,fetcher:(async (_url,init)=>{
  const signed=JSON.parse(String(init?.body)).signedPublication,parsed=parseSignedWildzProfilePublication(signed,profile);
  assert.equal((parsed.record as any).publisherKeyId,session.keyId);assert.equal((parsed.record as any).vaultCardRoots[card.id],claims[0]!.claim.cardRootDigest);
  const forged=await createReceizClient().publicStore.signPublish({tenantHost:'wildz.quest',merchantReceizId:'bound_keeper.receiz.id',title:`${profile.displayName} on Wildz`,sourceUrl:parsed.record.sourceUrl,namespace:'wildz-profile:bound_keeper',projectionState:'published',platform:signed.feed.records[0].platform,storeStateRecord:{...parsed.record,publisherKeyId:'f'.repeat(64)} as any,keyFile:identity.keyFile});
  assert.throws(()=>parseSignedWildzProfilePublication(forged,profile),/signed_publication_invalid/);
  return Response.json({ok:true,profile});
 }) as typeof fetch});
 await publishWildzCardWithIdentityProof(card,{repository,ownershipClaims:claims,fetcher:(async (_url,init)=>{
  const signed=JSON.parse(String(init?.body)).signedPublication,parsed=parseSignedWildzCardPublication(signed,card);
  assert.equal((parsed.record as any).publisherKeyId,session.keyId);
  const tampered=structuredClone(signed);tampered.identityProof.keyId='f'.repeat(64);assert.throws(()=>parseSignedWildzCardPublication(tampered,card),/signed_publication_invalid/);
  return Response.json({ok:true,record:parsed.record});
 }) as typeof fetch});
});

test('pruned publisher history survives a later offline reclaim and derives adjacent real owners',async()=>{
 const upload=await import('../src/lib/receiz/wildz-upload-ownership');
 const {verifiedWildzProfileOwnershipRecords}=await import('../src/lib/receiz/wildz-published-ownership');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'full-owner-history',capturedAt:'2026-09-09T11:00:00.000Z'});
 const collector=await createReceizIdIdentity({username:'next_keeper',displayName:'Next'}),creator=await createReceizIdIdentity({username:'first_keeper',displayName:'First'});
 const make=async(identity:typeof collector,owner:string,kaiUPulse:string)=>upload.recordWildzUploadOwnershipClaims({database:createMemoryWildzContinuityDatabase(),session:{keyId:identity.keyFile.keyId,actorId:owner,localAuthority:'verified',remoteStatus:'offline'},keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:`claim:${owner}`,kaiUPulse,uploadedAt:'2026-10-12T12:00:00.000Z'});
 const first=await make(collector,'next_keeper','123000001'),back=await make(creator,'first_keeper','123999999');
 const pruned={...createPublicWildzProfileRecord({username:'next_keeper',vault:[]},'https://wildz.quest/u/next_keeper'),publisherKeyId:collector.keyFile.keyId,ownershipHistory:first};
 const active={...createPublicWildzProfileRecord({username:'first_keeper',vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]},'https://wildz.quest/u/first_keeper'),publisherKeyId:creator.keyFile.keyId,ownershipClaims:back,vaultCardRoots:{[card.id]:back[0]!.claim.cardRootDigest}};
 const claims=await verifiedWildzProfileOwnershipRecords([pruned,active]),cards=projectWildzMarketCollection([pruned,active],claims);
 assert.equal(cards.length,1);assert.equal(cards[0]!.ownerHandle,'first_keeper.receiz.id');
 const transfers=projectWildzMarketTransfers(claims,cards);assert.equal(transfers.length,2);assert.equal(transfers[0]!.fromHandle,'next_keeper.receiz.id');assert.equal(transfers[0]!.toHandle,'first_keeper.receiz.id');
 assert.equal(transfers[1]!.fromHandle,'first_keeper.receiz.id');
 assert.deepEqual(await verifiedWildzProfileOwnershipRecords([{...active,publisherKeyId:collector.keyFile.keyId}]),[]);
 assert.deepEqual(projectWildzMarketCollection([{...active,vaultCardRoots:{[card.id]:'sha256:'+'f'.repeat(64)}}],claims),[]);
});

test('opened native custody retains its original exact witness beside local upload custody',async()=>{
 const {createWildzArtifactCodec,readWildzArtifactCrewCustody,wildzCrewOwnershipWitnesses,admitWildzUploadClaimCrewCustody,mergeWildzCrewCustody,wildzCrewCustodySources,retainWildzCrewCustodyMemory,restoreWildzCrewCustodyMemory,canOperateWildzCrewCard}=await import('../src/lib/receiz/wildz-artifact-codec');
 const {verifyAndAdmitWildsCard}=await import('../src/features/play/admitted-inventory');
 const {createWildzIdentityRepository}=await import('../src/lib/receiz/wildz-identity-repository');
 const {embedPortableVaultInPng}=await import('../src/features/play/card-export');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'retained-native-claim',capturedAt:'2026-09-09T11:00:00.000Z'});
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
 const witness={artifactId:'a'.repeat(64),namespace:'wildz-native',genesisOwnerReceizId:'first_keeper.receiz.id',previousOwnerReceizId:'first_keeper.receiz.id',ownerReceizId:'next_keeper.receiz.id',headReference:'native-actual-head',historyDigestSha256:'b'.repeat(64),appendCount:1,witnessedKaiPulse:'123',witnessedKaiUPulse:'123000001',witnessedAt:'2026-10-12T12:00:00.000Z'};
 const bytes=new TextEncoder().encode('{"kind":"receiz.bundle.v1"}'),payload=embedPortableVaultInPng(png,[card]);
 const inspection=await createWildzArtifactCodec({identityRepository:createWildzIdentityRepository({database:createMemoryWildzContinuityDatabase()}),commerceVaultReader:{inspect:async()=>null},artifactOpener:{open:async()=>({artifactBytes:bytes,artifactSha256:'c'.repeat(64),payloadBytes:payload,payloadSha256:'d'.repeat(64),filename:'native.receized',mimeType:'image/png',ownerReceizId:'next_keeper.receiz.id',claimId:witness.headReference,verifyPath:'/v/native-actual-head',recordId:'native-record',compatibility:'current-native',ownershipWitness:witness})}}).inspect({bytes,mimeType:'application/json'});
 assert.equal(inspection.kind,'card-vault');
 const token=readWildzArtifactCrewCustody(inspection),[held]=wildzCrewOwnershipWitnesses(token,[card]);assert.deepEqual(held?.witness,witness);
 const upload=await import('../src/lib/receiz/wildz-upload-ownership');
 const {sha256PortableBasis,verifyAnyWildsCard}=await import('../src/features/play/portable-card');
 const identity=await createReceizIdIdentity({username:'next_keeper',displayName:'Next'}),database=createMemoryWildzContinuityDatabase();
 const session={keyId:identity.keyFile.keyId,actorId:'next_keeper',localAuthority:'verified' as const,remoteStatus:'offline' as const};
 const claims=await upload.recordWildzUploadOwnershipClaims({database,session,keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'native-plus-local-upload',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const local=await admitWildzUploadClaimCrewCustody({session,cards:[card],claims});
 assert.equal(verifyAndAdmitWildsCard(card),true);
 for(const tokens of [[token,local],[local,token]]){
  const merged=mergeWildzCrewCustody(session.actorId,tokens,[card]);
  assert.deepEqual(wildzCrewOwnershipWitnesses(merged,[card])[0]?.witness,witness);
  assert.deepEqual(wildzCrewCustodySources(merged).map(source=>source.artifactSha256).sort(),['c'.repeat(64),claims[0]!.claim.sourceArtifactSha256].sort());
  await retainWildzCrewCustodyMemory(database,session,merged,[card]);
  const restored=await restoreWildzCrewCustodyMemory(database,session,[card]);
  assert.ok(restored,'the full native witness and local source must survive authenticated memory');
  assert.equal(canOperateWildzCrewCard(card,session.actorId,restored),true);
  assert.deepEqual(wildzCrewOwnershipWitnesses(restored,[card])[0]?.witness,witness);
  assert.deepEqual(wildzCrewCustodySources(restored),wildzCrewCustodySources(merged));
 }
 const later=await upload.recordWildzUploadOwnershipClaims({database,session,keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([9]),attemptId:'second-source-upload',kaiUPulse:'124000001',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const laterLocal=await admitWildzUploadClaimCrewCustody({session,cards:[card],claims:later});
 for(const tokens of [[token,local,laterLocal],[laterLocal,local,token]]){
  const merged=mergeWildzCrewCustody(session.actorId,tokens,[card]);
  assert.deepEqual(wildzCrewCustodySources(merged).map(source=>source.artifactSha256).sort(),['c'.repeat(64),later[0]!.claim.sourceArtifactSha256].sort());
  await retainWildzCrewCustodyMemory(database,session,merged,[card]);
  const restored=await restoreWildzCrewCustodyMemory(database,session,[card]);
  assert.ok(restored,'a later upload from different bytes must reopen with its original native witness');
  assert.deepEqual(wildzCrewOwnershipWitnesses(restored,[card])[0]?.witness,witness);
  assert.equal(canOperateWildzCrewCard(card,session.actorId,restored),true);
 }
 const other=structuredClone(sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'distinct-root-same-id',capturedAt:'2026-09-09T11:00:00.000Z'}));
 other.id=card.id;other.manifest.assetId=card.id;other.manifest.lineage.rootAssetId=card.id;other.proof.digest=sha256PortableBasis(canonicalPortableCardJson(other.manifest));assert.equal(verifyAnyWildsCard(other).ok,true);
 const otherClaims=await upload.recordWildzUploadOwnershipClaims({database:createMemoryWildzContinuityDatabase(),session,keyFile:identity.keyFile,assets:[other],sourceBytes:new Uint8Array([2]),attemptId:'different-root-upload',kaiUPulse:'124000001',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const otherLocal=await admitWildzUploadClaimCrewCustody({session,cards:[other],claims:otherClaims});
 for(const tokens of [[token,otherLocal],[otherLocal,token]])assert.deepEqual(wildzCrewOwnershipWitnesses(mergeWildzCrewCustody(session.actorId,tokens,[other]),[other]),[]);
 const foreignNative=await createWildzArtifactCodec({identityRepository:createWildzIdentityRepository({database:createMemoryWildzContinuityDatabase()}),commerceVaultReader:{inspect:async()=>null},artifactOpener:{open:async()=>({artifactBytes:bytes,artifactSha256:'e'.repeat(64),payloadBytes:payload,payloadSha256:'d'.repeat(64),filename:'native.receized',mimeType:'image/png',ownerReceizId:'other_keeper.receiz.id',claimId:'foreign-native-head',verifyPath:'/v/foreign-native-head',recordId:'native-record',compatibility:'current-native',ownershipWitness:{...witness,ownerReceizId:'other_keeper.receiz.id',headReference:'foreign-native-head'}})}}).inspect({bytes,mimeType:'application/json'});
 const foreignToken=readWildzArtifactCrewCustody(foreignNative);
 for(const tokens of [[foreignToken,local],[local,foreignToken]])assert.deepEqual(wildzCrewOwnershipWitnesses(mergeWildzCrewCustody(session.actorId,tokens,[card]),[card]),[]);
 witness.headReference='mutated-projection';assert.equal(wildzCrewOwnershipWitnesses(token,[card])[0]?.witness.headReference,'native-actual-head');assert.equal(wildzCrewOwnershipWitnesses(token,[card])[0]?.witness.witnessedKaiUPulse,'123000001');
});

test('native refresh compares exact coordinates against the latest verified local reclaim',async()=>{
 const reconcile=(ownership as Record<string,unknown>).reconciledWildzLostOwnershipAssetIds as ((input:{nativeResult:unknown;verifiedClaims:readonly unknown[];actorId:string;assetIds:readonly string[]})=>string[])|undefined;
 assert.equal(typeof reconcile,'function','a native lost-ID verdict must not bypass the exact claim comparison');
 const upload=await import('../src/lib/receiz/wildz-upload-ownership');
 const identity=await createReceizIdIdentity({username:'reclaimed_keeper',displayName:'Reclaimed'}),database=createMemoryWildzContinuityDatabase();
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'native-after-reclaim',capturedAt:'2026-09-09T11:00:00.000Z'});
 const local=await upload.recordWildzUploadOwnershipClaims({database,session:{keyId:identity.keyFile.keyId,actorId:'reclaimed_keeper',localAuthority:'verified',remoteStatus:'offline'},keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'actual-local-reclaim',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const native=(kaiUPulse:string)=>({namespace:ownership.WILDZ_OWNERSHIP_SYNC_NAMESPACE,schema:ownership.WILDZ_OWNERSHIP_SYNC_SCHEMA,state:'published',data:{schema:ownership.WILDZ_OWNERSHIP_SYNC_SCHEMA,assetId:card.id,artifactId:'a'.repeat(64),previousOwnerReceizId:'reclaimed_keeper.receiz.id',ownerReceizId:'other_keeper.receiz.id',headReference:`native:${kaiUPulse}`,historyDigestSha256:'b'.repeat(64),appendCount:99,witnessedKaiPulse:String(BigInt(kaiUPulse)/1000000n),witnessedKaiUPulse:kaiUPulse,witnessedAt:'2026-10-12T11:00:00.000Z',authority:{claim:'witnessed-kai-pulse-in-sealed-artifact',server:'synchronization-projection-only'}}});
 const input={verifiedClaims:local,actorId:'reclaimed_keeper',assetIds:[card.id]};
 assert.deepEqual(reconcile!({...input,nativeResult:{status:'ready',lostAssetIds:[card.id],ownershipClaims:[native('123000001')]}}),[]);
 assert.deepEqual(reconcile!({...input,nativeResult:{status:'ready',lostAssetIds:[],ownershipClaims:[native('124000001')]}}),[card.id]);
 assert.deepEqual(reconcile!({...input,nativeResult:{status:'ready',lostAssetIds:[card.id]}}),[],'old coordinate-free results cannot override a signed local claim');
 const bounded=(ownership as Record<string,unknown>).requestedWildzNativeOwnershipRecords as ((records:readonly unknown[],ids:readonly string[])=>readonly unknown[])|undefined;
 assert.equal(typeof bounded,'function');
 const foreign={...native('125000001'),data:{...native('125000001').data,assetId:'wilds:'+'f'.repeat(24)}};
 const records=bounded!([native('123000001'),native('124000001'),foreign],[card.id]);assert.equal(records.length,1);
 assert.equal(ownership.ownershipSyncProjection(records[0])?.witnessedKaiUPulse,'124000001');
});

test('verified foreign Commerce uploads without a native bearer envelope restore locally',async()=>{
 const {wildzVaultUploadDisposition}=await import('../src/features/identity/wildz-restore');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'portable-commerce-upload',capturedAt:'2026-09-09T11:00:00.000Z'});
 const inspection={kind:'commerce-vault',identity:null,assets:[card],sourceSchemas:[],unrelatedDomainSchemas:[],projection:{},player:null,playerBinding:null} as unknown as import('../src/lib/receiz/wildz-artifact-codec').WildzArtifactInspection;
 assert.equal(wildzVaultUploadDisposition(inspection,'next_keeper'),'restore-portable');
 assert.equal(wildzVaultUploadDisposition(inspection,'first_keeper'),'merge-owned');
 const native={...inspection,proofObject:{ownerReceizId:'first_keeper.receiz.id'}} as unknown as import('../src/lib/receiz/wildz-artifact-codec').WildzArtifactInspection;
 assert.equal(wildzVaultUploadDisposition(native,'next_keeper'),'claim-bearer');
 assert.equal(wildzVaultUploadDisposition(native,'first_keeper'),'merge-owned');
});


test('unchanged profile waits for exact directory claims and history without repeating an accepted write',async()=>{
 const {publishCurrentWildzProfile}=await import('../src/lib/receiz/wildz-profile-adapter');
 const {sanitizePublicWildzProfile}=await import('../src/features/profile/public-profile');
 const upload=await import('../src/lib/receiz/wildz-upload-ownership');
 const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'first_keeper',encounterId:'delayed-directory-claim',capturedAt:'2026-09-09T11:00:00.000Z'}),identity=await createReceizIdIdentity({username:'delayed_keeper',displayName:'Delayed'});
 const claims=await upload.recordWildzUploadOwnershipClaims({database:createMemoryWildzContinuityDatabase(),session:{keyId:identity.keyFile.keyId,actorId:'delayed_keeper',localAuthority:'verified',remoteStatus:'offline'},keyFile:identity.keyFile,assets:[card],sourceBytes:new Uint8Array([1]),attemptId:'delayed-upload',kaiUPulse:'123999999',uploadedAt:'2026-10-12T12:00:00.000Z'});
 const profile=sanitizePublicWildzProfile({username:'delayed_keeper',vault:[{id:card.id,name:card.manifest.name,proofDigest:card.proof.digest,visibility:'public'}]});
 let version=0,writes=0;
 const fetcher=(async url=>String(url).includes('/market/collection?owner=')?Response.json({ok:true,profile,ownershipClaims:version>=1?claims:[],ownershipHistory:version>=2?claims:[]}):Response.json({ok:true,profile})) as typeof fetch;
 const options={ownershipClaims:claims,ownershipHistory:claims,confirmExisting:true,confirmMarketCollection:true,publishSourceProfile:async()=>{writes++;return profile;}};
 await assert.rejects(publishCurrentWildzProfile(profile,[card],fetcher,options),/publication_unconfirmed/);assert.equal(writes,1);
 await assert.rejects(publishCurrentWildzProfile(profile,[card],fetcher,options),/publication_unconfirmed/);assert.equal(writes,1);
 version=1;await assert.rejects(publishCurrentWildzProfile(profile,[card],fetcher,options),/publication_unconfirmed/);assert.equal(writes,1);
 version=2;assert.deepEqual(await publishCurrentWildzProfile(profile,[card],fetcher,options),profile);assert.equal(writes,1);
 const empty=sanitizePublicWildzProfile({username:'delayed_keeper',vault:[]});let historyReady=false,historyWrites=0;
 const historyFetcher=(async url=>String(url).includes('/market/collection?owner=')?Response.json({ok:true,profile:empty,ownershipClaims:[],ownershipHistory:historyReady?claims:[]}):Response.json({ok:true,profile:empty})) as typeof fetch;
 const historyOptions={ownershipClaims:[],ownershipHistory:claims,confirmExisting:true,confirmMarketCollection:true,publishSourceProfile:async()=>{historyWrites++;return empty;}};
 await assert.rejects(publishCurrentWildzProfile(empty,[],historyFetcher,historyOptions),/publication_unconfirmed/);assert.equal(historyWrites,1);
 historyReady=true;assert.deepEqual(await publishCurrentWildzProfile(empty,[],historyFetcher,historyOptions),empty);assert.equal(historyWrites,1);
});
