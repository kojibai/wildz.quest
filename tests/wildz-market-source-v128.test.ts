import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {WildzMarketSourceEventV128,WildzMarketSelectionV128} from '../src/lib/receiz/wildz-market-source-types-v128';
async function law(){const loaded=await import('../src/lib/receiz/wildz-market-source-journal-v128').catch(()=>null);assert.ok(loaded,'market source reducer must exist');return loaded;}
const selection:WildzMarketSelectionV128={asset:{kind:'inventory',foodItemIds:['apple:one'],materialLotIds:[],resourceLotIds:['honey:one']},semanticIds:['resource:apple:one','resource:honey:one'],sourceDigest:'a'.repeat(64),summary:'Apple and Living Honey',resourceUnits:4,creatureCount:0};
const list:WildzMarketSourceEventV128={schema:'wildz.market-source-command.v128',kind:'list',attemptId:'list:first',actorHandle:'alice.receiz.id',listingId:'listing:first',selection,priceUsdCents:500};
async function reserved(){const m=await law(),listed=m.reduceWildzMarketSourceV128(m.initialWildzMarketSourceV128(),list,'alice.receiz.id');const value=listed.listings[list.listingId]!;
 const reserve:WildzMarketSourceEventV128={schema:list.schema,kind:'reserve',attemptId:'reserve:bob',actorHandle:'bob.receiz.id',listingId:value.listingId,expectedListingHead:value.listingHead,reservationId:'reservation:bob'};
 return {m,listed,reserve,state:m.reduceWildzMarketSourceV128(listed,reserve,'bob.receiz.id')};}
test('actual finite semantic locks reject overlapping resource selection under another listing ID',async()=>{const {m,listed}=await reserved();
 assert.throws(()=>m.reduceWildzMarketSourceV128(listed,{...list,listingId:'listing:alias',attemptId:'list:alias'},list.actorHandle),/semantic_locked/);
 assert.throws(()=>m.reduceWildzMarketSourceV128(m.initialWildzMarketSourceV128(),{...list,selection:{...selection,semanticIds:['resource:invented']}},list.actorHandle),/semantic_ids/);
});
test('buyer reservations consume the exact active listing head and reject a conflicting second buyer',async()=>{const {m,reserve,state}=await reserved();
 assert.equal(state.listings[list.listingId]!.reservation!.buyerHandle,'bob.receiz.id');
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{...reserve,actorHandle:'carol.receiz.id',reservationId:'reservation:carol',attemptId:'reserve:carol'},'carol.receiz.id'),/listing_unavailable/);
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{...reserve,expectedListingHead:'b'.repeat(64)},'bob.receiz.id'),/listing_unavailable/);
});
test('source author must equal the actual SDK admitted device actor',async()=>{const m=await law();assert.throws(()=>m.reduceWildzMarketSourceV128(m.initialWildzMarketSourceV128(),list,'mallory.receiz.id'),/actor_mismatch/);});
test('an approved sale freezes USD cents exact Phi amount final asset descriptor and both approval digest',async()=>{const {m,state}=await reserved(),row=state.listings[list.listingId]!;
 const sourceHead={protocol:'wildz.resource-source.v128' as const,legId:'trade:asset',sourceArtifactSha256:'b'.repeat(64),sourcePayloadSha256:'c'.repeat(64),packageId:`wildz:package:${'d'.repeat(64)}`,packageHead:`sha256:${'e'.repeat(64)}`,memberIds:['apple:one','honey:one'],domainId:'world:wildz:resource-custody:v128' as const,custodyAppendId:'reserve:package',custodyHead:'f'.repeat(64),ownerHandle:'alice.receiz.id'};
 const event:WildzMarketSourceEventV128={schema:list.schema,kind:'approved',attemptId:'approve:one',actorHandle:'alice.receiz.id',listingId:row.listingId,reservationId:row.reservation!.reservationId,expectedReservationHead:row.reservation!.reservationHead,quoteDigest:'1'.repeat(64),planDigest:'2'.repeat(64),approvalDigest:'3'.repeat(64),amountPhiMicro:'4000000',sourceHead};
 const approved=m.reduceWildzMarketSourceV128(state,event,'alice.receiz.id');assert.equal(approved.listings[row.listingId]!.reservation!.amountPhiMicro,'4000000');
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{...event,sourceHead:{...sourceHead,memberIds:['apple:one']}},'alice.receiz.id'),/descriptor_selection/);
});
test('payment uncertainty prevents expiry release cancellation and relisting regardless of local clock',async()=>{const {m,state}=await reserved(),row=state.listings[list.listingId]!;
 const approved={...row.reservation!,phase:'approved' as const,approvalDigest:'1'.repeat(64),amountPhiMicro:'100',planDigest:'2'.repeat(64)};
 const before={...state,listings:{...state.listings,[row.listingId]:{...row,reservation:approved}}};
 const event:WildzMarketSourceEventV128={schema:list.schema,kind:'progress',attemptId:'payment:start',actorHandle:'bob.receiz.id',listingId:row.listingId,reservationId:approved.reservationId,expectedReservationHead:approved.reservationHead,phase:'payment-pending'};
 const pending=m.reduceWildzMarketSourceV128(before,event,'bob.receiz.id'),r=pending.listings[row.listingId]!.reservation!;
 assert.throws(()=>m.reduceWildzMarketSourceV128(pending,{schema:list.schema,kind:'release',attemptId:'release:late',actorHandle:'alice.receiz.id',listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead},'alice.receiz.id'),/payment_locked/);
 assert.throws(()=>m.reduceWildzMarketSourceV128(pending,{schema:list.schema,kind:'cancel',attemptId:'cancel:late',actorHandle:'alice.receiz.id',listingId:row.listingId,expectedListingHead:row.listingHead},'alice.receiz.id'),/listing_unavailable/);
 assert.equal(pending.semanticLocks['resource:honey:one'],row.listingId);
});
test('payment and asset receipt progress cannot skip stages or use the wrong peer',async()=>{const {m,state}=await reserved(),row=state.listings[list.listingId]!,r=row.reservation!;
 const event={schema:list.schema,kind:'progress',attemptId:'false:complete',actorHandle:'bob.receiz.id',listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead,phase:'completed',receiptDigest:'d'.repeat(64)};
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,event as never,'bob.receiz.id'),/dual_terminal_consent_required/);
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{...event,actorHandle:'mallory.receiz.id'} as never,'mallory.receiz.id'),/participant_required/);
});

test('terminal presentation pruning does not impose a lifetime listing cap',async()=>{const m=await law();let state=m.initialWildzMarketSourceV128();
 for(let n=0;n<520;n++){const event={...list,attemptId:`list:history:${n}`,listingId:`listing:history:${n}`};state=m.reduceWildzMarketSourceV128(state,event,event.actorHandle);const row=state.listings[event.listingId]!;
  state=m.reduceWildzMarketSourceV128(state,{schema:list.schema,kind:'cancel',attemptId:`cancel:history:${n}`,actorHandle:row.sellerHandle,listingId:row.listingId,expectedListingHead:row.listingHead},row.sellerHandle);}
 assert.equal(Object.keys(state.listings).length,64);assert.equal(state.terminalOrder.length,64);assert.deepEqual(state.semanticLocks,{});
 const next=m.reduceWildzMarketSourceV128(state,{...list,attemptId:'list:after-history',listingId:'listing:after-history'},list.actorHandle);assert.equal(next.listings['listing:after-history']!.status,'active');
});
test('closed public market commands reject accidentally carried private proof material',async()=>{const m=await law();assert.throws(()=>m.reduceWildzMarketSourceV128(m.initialWildzMarketSourceV128(),{...list,privateOriginal:'secret'} as never,list.actorHandle),/command_invalid/);});

async function readyForClosing(phase:'payment-pending'|'asset-accepted'){
 const value=await reserved(),row=value.state.listings[list.listingId]!,reservation={...row.reservation!,phase,planDigest:'2'.repeat(64),approvalDigest:'3'.repeat(64),...(phase==='asset-accepted'?{paymentReceiptDigest:'4'.repeat(64),assetReceiptDigest:'5'.repeat(64)}:{})};
 return {...value,state:{...value.state,listings:{...value.state.listings,[row.listingId]:{...row,reservation}}}};
}
test('one public digest or one native device closing consent cannot release a possibly-paid source',async()=>{
 const {m,state}=await readyForClosing('asset-accepted'),row=state.listings[list.listingId]!,r=row.reservation!;
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{schema:list.schema,kind:'progress',attemptId:'complete:false',actorHandle:r.buyerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead,phase:'completed',receiptDigest:'f'.repeat(64)} as never,r.buyerHandle),/dual_terminal_consent_required/);
 const event:WildzMarketSourceEventV128={schema:list.schema,kind:'terminal-consent',attemptId:'close:buyer',actorHandle:r.buyerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead,outcome:'completed',planDigest:r.planDigest!,approvalDigest:r.approvalDigest!,paymentReceiptDigest:r.paymentReceiptDigest!,assetReceiptDigest:r.assetReceiptDigest!,zeroWriteReceiptDigest:null};
 const first=m.reduceWildzMarketSourceV128(state,event,r.buyerHandle),held=first.listings[row.listingId]!.reservation!;
 assert.equal(first.listings[row.listingId]!.status,'reserved');assert.equal(first.semanticLocks['resource:honey:one'],row.listingId);
 assert.throws(()=>m.reduceWildzMarketSourceV128(first,{...event,attemptId:'close:again',expectedReservationHead:held.reservationHead},r.buyerHandle),/terminal_consent_mismatch/);
 assert.throws(()=>m.reduceWildzMarketSourceV128(first,{...event,attemptId:'close:wrong',actorHandle:r.sellerHandle,expectedReservationHead:held.reservationHead,assetReceiptDigest:'6'.repeat(64)},r.sellerHandle),/terminal_receipts_required/);
 const closed=m.reduceWildzMarketSourceV128(first,{...event,attemptId:'close:seller',actorHandle:r.sellerHandle,expectedReservationHead:held.reservationHead},r.sellerHandle);
 assert.equal(closed.listings[row.listingId]!.status,'sold');assert.equal(closed.listings[row.listingId]!.reservation!.phase,'completed');assert.deepEqual(closed.semanticLocks,{});
});
test('known no-payment resolution requires matching consent from both named peers; unknown does not unlock',async()=>{
 const {m,state}=await readyForClosing('payment-pending'),row=state.listings[list.listingId]!,r=row.reservation!;
 const event:WildzMarketSourceEventV128={schema:list.schema,kind:'terminal-consent',attemptId:'zero:buyer',actorHandle:r.buyerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead,outcome:'zero-write',planDigest:r.planDigest!,approvalDigest:r.approvalDigest!,paymentReceiptDigest:null,assetReceiptDigest:null,zeroWriteReceiptDigest:'7'.repeat(64)};
 assert.throws(()=>m.reduceWildzMarketSourceV128(state,{...event,zeroWriteReceiptDigest:null},r.buyerHandle),/terminal_receipts_required/);
 const first=m.reduceWildzMarketSourceV128(state,event,r.buyerHandle),held=first.listings[row.listingId]!.reservation!;
 assert.equal(first.listings[row.listingId]!.status,'reserved');
 assert.throws(()=>m.reduceWildzMarketSourceV128(first,{...event,attemptId:'zero:other',actorHandle:r.sellerHandle,expectedReservationHead:held.reservationHead,zeroWriteReceiptDigest:'8'.repeat(64)},r.sellerHandle),/terminal_consent_mismatch/);
 const closed=m.reduceWildzMarketSourceV128(first,{...event,attemptId:'zero:seller',actorHandle:r.sellerHandle,expectedReservationHead:held.reservationHead},r.sellerHandle);
 assert.equal(closed.listings[row.listingId]!.status,'cancelled');assert.equal(closed.listings[row.listingId]!.reservation!.phase,'cancelled');assert.deepEqual(closed.semanticLocks,{});
});
test('a later canonical paid progression supersedes one no-payment consent while keeping the sale locked',async()=>{
 const {m,state}=await readyForClosing('payment-pending'),row=state.listings[list.listingId]!,r=row.reservation!;
 const first=m.reduceWildzMarketSourceV128(state,{schema:list.schema,kind:'terminal-consent',attemptId:'zero:race:buyer',actorHandle:r.buyerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:r.reservationHead,outcome:'zero-write',planDigest:r.planDigest!,approvalDigest:r.approvalDigest!,paymentReceiptDigest:null,assetReceiptDigest:null,zeroWriteReceiptDigest:'7'.repeat(64)},r.buyerHandle);
 const held=first.listings[row.listingId]!.reservation!,paid:WildzMarketSourceEventV128={schema:list.schema,kind:'progress',attemptId:'paid:late:canonical',actorHandle:r.sellerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:held.reservationHead,phase:'paid',receiptDigest:'4'.repeat(64)};
 assert.throws(()=>m.reduceWildzMarketSourceV128(first,{...paid,receiptDigest:undefined} as never,r.sellerHandle),/command_invalid|terminal_consent_locked|phase_invalid/);
 const actual=m.reduceWildzMarketSourceV128(first,paid,r.sellerHandle),next=actual.listings[row.listingId]!.reservation!;
 assert.equal(next.phase,'paid');assert.equal(next.paymentReceiptDigest,'4'.repeat(64));assert.equal(next.terminalConsent,undefined);
 assert.equal(actual.listings[row.listingId]!.status,'reserved');assert.equal(actual.semanticLocks['resource:honey:one'],row.listingId);
 assert.throws(()=>m.reduceWildzMarketSourceV128(actual,{schema:list.schema,kind:'terminal-consent',attemptId:'zero:race:seller',actorHandle:r.sellerHandle,listingId:row.listingId,reservationId:r.reservationId,expectedReservationHead:next.reservationHead,outcome:'zero-write',planDigest:r.planDigest!,approvalDigest:r.approvalDigest!,paymentReceiptDigest:null,assetReceiptDigest:null,zeroWriteReceiptDigest:'7'.repeat(64)},r.sellerHandle),/terminal_receipts_required/);
});
