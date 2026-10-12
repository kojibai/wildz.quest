import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {WildzMarketSheet} from '../src/features/market/WildzMarketSheet';
import type {WildzMarketPurchaseReviewV128,WildzMarketServiceV128,WildzMarketSnapshotV128} from '../src/features/market/wildz-market-service-v128';
import {createWildsWalletTradeAgreement,createWildsWalletTradeDraft} from '../src/features/play/wallet/wilds-wallet-trade';
import {retainWildzMarketListingUiAttempt} from '../src/features/market/wildz-market-presentation';
import {initialPlayState} from '../src/features/play/game-state';
import {MarketCardArtwork} from '../src/features/market/WildzMarketDiscovery';

const buyer='buyer.receiz.id',seller='seller.receiz.id',asset={kind:'creature' as const,assetId:'creature:ember'};
const agreement=createWildsWalletTradeAgreement(
 {senderHandle:seller,draft:createWildsWalletTradeDraft({attemptId:'market:sale',recipient:buyer,selfHandle:seller,phiMicro:'0',requestedPhiMicro:'1234567',requestNote:'Market sale',selections:[{selection:{id:'ember',label:'Ember Cub',quantity:1,asset},quantity:1}]})},
 {senderHandle:buyer,draft:createWildsWalletTradeDraft({attemptId:'market:buy',recipient:seller,selfHandle:buyer,phiMicro:'1234567',requestedPhiMicro:'0',requestNote:'Market purchase',selections:[]})}
);
function purchase(overrides:Partial<WildzMarketPurchaseReviewV128>={}):WildzMarketPurchaseReviewV128{return {purchaseId:'purchase:ember',listingId:'listing:ember',reservationId:'reservation:ember',title:'Ember Cub',kind:'creature',buyerHandle:buyer,sellerHandle:seller,priceUsdCents:'1234',amountPhiMicro:'1234567',usdPerPhiMicrocents:'1000000000',expiresAtKai:999,phase:'review',agreement,canApprove:true,canResume:false,canAccept:false,message:'Review this exact purchase.',...overrides};}
function fixture(input:Partial<WildzMarketSnapshotV128>={},ownerHandle=buyer){
 let calls=0;
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[{listingId:'listing:ember',title:'Ember Cub',kind:'creature',asset,sellerHandle:seller,priceUsdCents:'1234',status:'active',canBuy:true,canCancel:false}],purchases:[],sellables:[{id:'food-pack',title:'Trail provisions',kind:'package',asset:{kind:'package',packageId:`wildz:package:${'b'.repeat(64)}`},summary:'2 wild fruit · 1 timber · 1 Living Honey'}],...input};
 const result=async()=>{calls++;return {status:'pending' as const,message:'Checking the same purchase.'};};
 const service:WildzMarketServiceV128={binding:{ownerHandle,keyId:'a'.repeat(64)},snapshot:()=>snapshot,subscribe:()=>()=>{},read:async()=>{calls++;return snapshot;},list:result,cancel:result,previewPurchase:async()=>{calls++;return purchase();},approvePurchase:result,resume:result,accept:result,receive:result};
 return {service,calls:()=>calls};
}

test('Market omits creatures without their real card and paints cached resources without SDK work during render',()=>{
 const f=fixture(),html=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected/>);
 assert.doesNotMatch(html,/Ember Cub|View listing|creature-collection\.webp/);assert.equal(f.calls(),0);
 const resource=fixture({listings:[{listingId:'listing:provisions',title:'Trail provisions',kind:'package',asset:{kind:'package',packageId:`wildz:package:${'b'.repeat(64)}`},sellerHandle:seller,priceUsdCents:'1234',status:'active',canBuy:true,canCancel:false}]});
 const resources=renderToStaticMarkup(<WildzMarketSheet service={resource.service} connected/>);
 assert.match(resources,/Trail provisions/);assert.match(resources,/\$12\.34/);assert.match(resources,/View listing/);assert.match(resources,/resource-collection\.webp/);assert.equal(resource.calls(),0);
 const offline=renderToStaticMarkup(<WildzMarketSheet service={null} connected={false}/>);
 assert.match(offline,/Connect your Receiz ID/);assert.doesNotMatch(offline,/Approve purchase|Approve sale|Accept delivery/);
});

test('a cached owned creature waits for decoded artwork and value preparation before its tile is painted',()=>{
 const asset=initialPlayState.inventory[0]!;
 const f=fixture({listings:[],collection:[{assetId:asset.id,title:'Exact owned companion',proofDigest:asset.proof.digest,ownerHandle:seller,claimKaiUPulse:null,claimHead:null,asset}]});
 const html=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected/>);
 assert.match(html,/Loading Market/);assert.doesNotMatch(html,/Preparing cards|Checking listings/);assert.doesNotMatch(html,/View creature · Exact owned companion|Flip Exact owned companion|creature-collection\.webp|wilds-card-face-back/);assert.equal(f.calls(),0);
});

test('a prepared card consumes its decoded exact artwork eagerly with an actor profile coordinate',()=>{
 const asset=initialPlayState.inventory[0]!;
 const html=renderToStaticMarkup(<MarketCardArtwork card={{assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'seller.receiz.id',claimKaiUPulse:null,claimHead:null,asset}}/>);
 assert.match(html,/loading="eager"/);assert.match(html,/profile=seller&amp;digest=/);assert.doesNotMatch(html,/loading="lazy"|profile=seller\.receiz\.id|creature-collection\.webp/);
});

test('buyer and named seller approval display the exact USD and Phi terms',()=>{
 const f=fixture({purchases:[purchase()]}),html=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="activity"/>);
 assert.match(html,/\$12\.34/);assert.match(html,/1\.234567 Phi/);assert.match(html,/@buyer/);assert.match(html,/@seller/);assert.match(html,/>Approve purchase<\/button>/);assert.doesNotMatch(html,/>Accept delivery<\/button>/);
 const s=fixture({purchases:[purchase()]},seller),sale=renderToStaticMarkup(<WildzMarketSheet service={s.service} connected initialTab="activity"/>);
 assert.match(sale,/Approve sale to @buyer/);assert.match(sale,/1\.234567 Phi/);assert.equal(f.calls()+s.calls(),0);
});

test('confirmed payment stays delivery pending until the source service authorizes acceptance',()=>{
 const f=fixture({purchases:[purchase({phase:'paid',canApprove:false,canResume:true,message:'Payment confirmed. Delivery is pending.'})]}),paid=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="activity"/>);
 assert.match(paid,/Payment confirmed/);assert.match(paid,/delivery pending/i);assert.match(paid,/>Resume purchase<\/button>/);assert.doesNotMatch(paid,/Purchase complete|>Accept delivery<\/button>/);
 const incoming=fixture({purchases:[purchase({phase:'awaiting-acceptance',canApprove:false,canResume:true,canAccept:true,message:'Accept the approved source.'})]}),delivery=renderToStaticMarkup(<WildzMarketSheet service={incoming.service} connected initialTab="activity"/>);
 assert.match(delivery,/>Accept delivery<\/button>/);assert.doesNotMatch(delivery,/Purchase complete/);
 const received=fixture({purchases:[purchase({phase:'received',canApprove:false,canResume:true,assetRecoveryRequired:true,message:'The source is accepted; refresh your Vault.'})]}),refresh=renderToStaticMarkup(<WildzMarketSheet service={received.service} connected initialTab="activity"/>);
 assert.match(refresh,/Asset received/);assert.match(refresh,/refresh pending/i);assert.doesNotMatch(refresh,/>Approve purchase<\/button>|Purchase complete/);
});

test('Sell displays the real package selection and keeps reserved own listings out of cancellation',()=>{
 const f=fixture({listings:[{listingId:'mine',title:'Reserved harvest',kind:'inventory',asset:{kind:'inventory',foodItemIds:['fruit:one'],materialLotIds:[],resourceLotIds:[]},sellerHandle:buyer,priceUsdCents:'200',status:'reserved',canBuy:false,canCancel:false}]}),sell=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="sell"/>);
 assert.match(sell,/Trail provisions/);assert.match(sell,/2 wild fruit/);assert.match(sell,/Living Honey/);assert.match(sell,/Price in USD/);
 const activity=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="activity"/>);
 assert.match(activity,/Reserved harvest/);assert.match(activity,/Reserved/);assert.doesNotMatch(activity,/>Cancel listing<\/button>/);
});

test('an active listing does not require publishing another proof to calculate its value',()=>{
 const f=fixture({listings:[{listingId:'mine',title:'Value pending cub',kind:'creature',asset,sellerHandle:buyer,priceUsdCents:'200',status:'active',canBuy:false,canActivate:false,canCancel:true}]});
 const service={...f.service,activateListing:async()=>({status:'listed' as const,message:'Recovered the same listing.'})};
 const html=renderToStaticMarkup(<WildzMarketSheet service={service} connected initialTab="activity"/>);
 assert.doesNotMatch(html,/>Enable value chart<\/button>/);assert.doesNotMatch(html,/>Enable purchases<\/button>/);assert.equal(f.calls(),0);
});

test('an unavailable local value shows its retry state instead of a silent empty price',async()=>{
 const {CardValue}=await import('../src/features/market/WildzMarketDiscovery');
 const html=renderToStaticMarkup(<CardValue card={{assetId:'wilds:'+ 'a'.repeat(24),title:'Companion',proofDigest:'sha256:'+ 'b'.repeat(64),ownerHandle:seller,claimKaiUPulse:null,claimHead:null,valueUnavailable:'Open the chart to retry.'}}/>);
 assert.match(html,/Value unavailable/);assert.match(html,/Open the chart to retry/);
});

test('mobile Explore offers two columns by default and a single-column view without loading the service',()=>{
 const f=fixture(),html=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected/>);
 const two=html.match(/<button[^>]+aria-label="Two-column view"[^>]*>/)?.[0]??'';
 const one=html.match(/<button[^>]+aria-label="Single-column view"[^>]*>/)?.[0]??'';
 assert.match(two,/aria-pressed="true"/);assert.match(one,/aria-pressed="false"/);
 assert.equal(f.calls(),0);
});

test('compact card taps open the full view while the larger preview keeps its flip gesture',async()=>{
 const {WildzMarketCardPreview}=await import('../src/features/market/WildzMarketCardPreview');
 const card={assetId:'wilds:'+ 'a'.repeat(24),title:'Companion',proofDigest:'sha256:'+ 'b'.repeat(64),ownerHandle:seller,claimKaiUPulse:null,claimHead:null};
 let opens=0;
 const compact=renderToStaticMarkup(<WildzMarketCardPreview card={card} front={<span>Complete card</span>} openOnTap onOpen={()=>{opens++;}}/>);
 assert.match(compact,/aria-label="Open Companion"/);assert.doesNotMatch(compact,/aria-label="Flip Companion"/);assert.equal(opens,0);
 const expanded=renderToStaticMarkup(<WildzMarketCardPreview card={card} front={<span>Complete card</span>}/>);
 assert.match(expanded,/aria-label="Flip Companion"/);
});

test('reopened pending listing remains visible with the original asset and price even after holdings refresh',()=>{
 const f=fixture({sellables:[]});
 retainWildzMarketListingUiAttempt(f.service,{request:{attemptId:'listing:same',asset:{kind:'inventory',foodItemIds:['fruit:one'],materialLotIds:[],resourceLotIds:[]},priceUsdCents:'1234'},title:'Saved harvest',summary:'One exact wild fruit'});
 const browse=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected/>);
 assert.match(browse,/Check pending listing · Saved harvest/);
 const sell=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="sell"/>);
 assert.match(sell,/Saved harvest/);assert.match(sell,/One exact wild fruit/);
 const priceInput=sell.match(/<input[^>]+aria-label="Price in USD"[^>]+>/)?.[0]??'';
 assert.match(priceInput,/value="12\.34"/);assert.match(priceInput,/disabled/);assert.match(sell,/>Check listing<\/button>/);
 assert.equal(f.calls(),0);
});

test('a cold service exposes its saved exact listing continuation without authorizing publication during render',()=>{
 const f=fixture({sellables:[],pendingListings:[{asset:{kind:'package',packageId:`wildz:package:${'c'.repeat(64)}`},priceUsdCents:'701',attemptId:'listing:cold-saved',listingId:'saved:listing',title:'Cold saved package',summary:'The same sealed harvest package'}]});
 const browse=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected/>);
 assert.match(browse,/Check pending listing · Cold saved package/);
 const sell=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="sell"/>);
 assert.match(sell,/value="listing:cold-saved" selected/);assert.match(sell,/value="7\.01"/);assert.match(sell,/The same sealed harvest package/);assert.match(sell,/>Check listing<\/button>/);
 assert.equal(f.calls(),0);
});

test('prepayment reviews offer withdrawal and refreshed quotes only when the source service permits them',()=>{
 const f=fixture({purchases:[purchase({phase:'review-required',canApprove:false,canCancel:true})]});
 const before=renderToStaticMarkup(<WildzMarketSheet service={f.service} connected initialTab="activity"/>);
 assert.match(before,/>Review current quote<\/button>/);assert.match(before,/>Cancel purchase<\/button>/);assert.equal(f.calls(),0);
 const paid=fixture({purchases:[purchase({phase:'payment-pending',canApprove:false,canCancel:false,canResume:true})]});
 const uncertain=renderToStaticMarkup(<WildzMarketSheet service={paid.service} connected initialTab="activity"/>);
 assert.doesNotMatch(uncertain,/>Cancel purchase<\/button>|>Review current quote<\/button>/);assert.match(uncertain,/>Resume purchase<\/button>/);
});
