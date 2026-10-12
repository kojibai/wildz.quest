import type {WildzMarketServiceV128,WildzMarketSnapshotV128,WildzMarketResultV128} from './wildz-market-service-v128';
import type {WildzMarketSourceSnapshotV128} from '../../lib/receiz/wildz-market-source-types-v128';
import type {WildzMarketOwnedCard,WildzMarketTransfer} from '../../lib/receiz/wildz-market-collection';
import {createWildzMarketPublicReadSourceV128} from '../../lib/receiz/wildz-market-public-read-v128';
import {createWildzMarketPublicationSdkV128,readWildzMarketPublicationsV128,projectWildzMarketPublicationsV128} from '../../lib/receiz/wildz-market-publication-v128';
import {readWildzMarketCollection} from './wildz-market-community-service';
import {createWildzMarketValueBrowserPortV129} from './wildz-market-value-browser-v129';
import {readWildzMarketCard} from './wildz-market-card-preparation';
import {wildzMarketValueChange,type WildzMarketValuePort} from './wildz-market-value';

/** Public display is independent of account recovery. This service has no
 * signer, private storage, approval or financial write port. The existing
 * identity-bound Wallet controller replaces it when local recovery finishes. */
export function createWildzMarketPublicBrowseService(input:Readonly<{
 readNative?():Promise<WildzMarketSourceSnapshotV128>;
 readAdvertisements?():Promise<WildzMarketSourceSnapshotV128>;
 readCollection?():Promise<Readonly<{cards:readonly WildzMarketOwnedCard[];transfers:readonly WildzMarketTransfer[]}>>;
 /** Optional exact rate from the active Explorer's already admitted Wallet
  * observation. Browsing never opens a Wallet or requests a new quote. */
 usdPerPhiMicrocents?():string|null;
 value?:WildzMarketValuePort;
}>={}):WildzMarketServiceV128{
 const listeners=new Set<(snapshot:WildzMarketSnapshotV128)=>void>();
 let snapshot:WildzMarketSnapshotV128={status:'loading',message:'',listings:[],purchases:[],sellables:[],collection:[]};
 let pending:Promise<WildzMarketSnapshotV128>|null=null;
 const value=input.value??createWildzMarketValueBrowserPortV129({usdPerPhiMicrocents:input.usdPerPhiMicrocents,card:id=>{
  const card=snapshot.collection?.find(card=>card.assetId===id);return card?readWildzMarketCard(card):null;
 }});
 const emit=()=>{for(const listener of listeners)listener(snapshot);return snapshot;};
 const unavailable=async():Promise<WildzMarketResultV128>=>({status:'failed',message:'Your local identity is opening. Try this action again in a moment.'});
 return {binding:{keyId:'',ownerHandle:''},snapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
  read(){
   if(pending)return pending;
   const operation=(async()=>{
    const results=await Promise.allSettled([
     input.readNative?.()??createWildzMarketPublicReadSourceV128().load(),
     input.readAdvertisements?.()??readWildzMarketPublicationsV128(createWildzMarketPublicationSdkV128()).then(projectWildzMarketPublicationsV128),
     input.readCollection?.()??readWildzMarketCollection()
    ]);
    const native=results[0].status==='fulfilled'?results[0].value:null;
    const ads=results[1].status==='fulfilled'?results[1].value:null;
    const collection=results[2].status==='fulfilled'?results[2].value:null;
    const listings={...ads?.state.listings,...native?.state.listings};
    snapshot={...snapshot,status:collection||native||ads?'ready':'unavailable',
     message:results.some(result=>result.status==='rejected')?'Some public listings could not refresh. Available cards remain browsable.':'',
     listings:Object.values(listings).map(listing=>({listingId:listing.listingId,title:listing.selection.summary,
      kind:listing.selection.asset.kind,asset:listing.selection.asset,sellerHandle:listing.sellerHandle,
      priceUsdCents:String(listing.priceUsdCents),status:listing.status,canCancel:false,
      canBuy:listing.status==='active'&&Boolean(native?.state.listings[listing.listingId])&&ads?.state.listings[listing.listingId]?.status!=='cancelled'})),
     ...(collection?{collection:collection.cards,transfers:collection.transfers}:{})};
    return emit();
   })().finally(()=>{if(pending===operation)pending=null;});
   pending=operation;return operation;
  },
  async readValue(id){
   const result=await value.read(id);
   if(result.status==='ready'){
    const projection=result.value;
    snapshot={...snapshot,collection:snapshot.collection?.map(card=>card.assetId===id&&card.proofDigest===projection.proofDigest?{...card,value:{
     proofValuePhiMicro:projection.proofValuePhiMicro,displayUsdCents:projection.displayUsdCents,valuationKaiUPulse:projection.valuationKaiUPulse,
     algorithm:projection.algorithm,changeBps:wildzMarketValueChange(projection.samples,projection.displayUsdCents===null?'phi':'usd')
    }}:card)};emit();
   }
   return result;
  },releaseValue:()=>value.release?.(),
  list:unavailable,cancel:unavailable,approvePurchase:unavailable,resume:unavailable,accept:unavailable,receive:unavailable,
  async previewPurchase(){throw Error('Your local identity is opening. Try this purchase again in a moment.');}
 };
}
