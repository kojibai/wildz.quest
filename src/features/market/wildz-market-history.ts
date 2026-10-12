import type {WildzMarketSourceSnapshotV128} from '../../lib/receiz/wildz-market-source-types-v128';
import type {WildsWalletAssetSendAsset} from '../play/wallet/wilds-wallet-asset-send';
import type {WildzMarketArchivedPurchaseV128} from './wildz-market-archive-v128';
import {canonicalPortableCardJson,sha256PortableBasis} from '../play/portable-card';

export type WildzMarketSale=Readonly<{id:string;listingId:string;asset:WildsWalletAssetSendAsset;title:string;buyerHandle:string;sellerHandle:string;priceUsdCents:string;amountPhiMicro:string;paymentReceiptDigest:string;assetReceiptDigest:string}>;
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);

/** Display conversion after the controller independently verifies both device
 * approvals, the native payment and complete accepted-delivery source. Local
 * hashes and completion flags alone never admit this input to Market history. */
export function projectWildzMarketVerifiedArchivedSale(value:WildzMarketArchivedPurchaseV128):WildzMarketSale|null{
 const terms=value.checkpoint.agreement.market;
 if(!terms||value.checkpoint.assetRecoveryRequired||value.entry.approvals.length!==2||value.entry.legs.length!==2||value.entry.legs[0]?.status!=='committed'||value.entry.legs[1]?.status!=='accepted'||value.entry.legs.some(leg=>leg.projectionPending)||value.entry.legs.some(leg=>leg.receipt===undefined))return null;
 return {id:terms.reservationId,listingId:terms.listingId,asset:terms.asset,title:'Creature & resource trade',buyerHandle:terms.buyerHandle,sellerHandle:terms.sellerHandle,priceUsdCents:terms.quote.priceUsdCents,amountPhiMicro:terms.quote.amountPhiMicro,paymentReceiptDigest:digest(value.entry.legs[0]!.receipt),assetReceiptDigest:digest(value.entry.legs[1]!.receipt)};
}

/** Price history uses admitted source sales and independently verified archived
 * sale projections. No raw private recovery rows enter this projection. */
export function projectWildzMarketSales(source:WildzMarketSourceSnapshotV128|null,archive:readonly WildzMarketSale[]):readonly WildzMarketSale[]{
 const result=new Map<string,WildzMarketSale>(archive.map(sale=>[sale.id,sale]));
 for(const id of source?.state.terminalOrder??[]){const listing=source!.state.listings[id],r=listing?.reservation;
  if(!listing||listing.status!=='sold'||!r||r.phase!=='completed'||r.terminalConsent?.outcome!=='completed'||!r.paymentReceiptDigest||!r.assetReceiptDigest||!r.amountPhiMicro)continue;
  result.set(r.reservationId,{id:r.reservationId,listingId:id,asset:listing.selection.asset,title:listing.selection.summary,buyerHandle:r.buyerHandle,sellerHandle:r.sellerHandle,priceUsdCents:String(listing.priceUsdCents),amountPhiMicro:r.amountPhiMicro,paymentReceiptDigest:r.paymentReceiptDigest,assetReceiptDigest:r.assetReceiptDigest});
 }
 return [...result.values()];
}
