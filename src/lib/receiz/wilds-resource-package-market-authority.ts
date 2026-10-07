import type {ResourcePackageMarketState} from "../../features/market/resource-package-market";
import type {WildsResourcePackageRecord} from "../../features/play/wilds-resource-package-world";
import {canonicalPortableCardJson} from "../../features/play/portable-card";
import {sameWildzPlayerCoordinate} from "./wildz-player-coordinate";

type Source = Readonly<{record:WildsResourcePackageRecord;packageId:string;listingId:string;subjectId:string}>;
function exactListing(state:ResourcePackageMarketState,input:Source){
  const listing=state.listings[input.listingId],record=input.record,plan=record.transferPlan;
  if(!listing || !plan || listing.id!==input.listingId || listing.packageId!==input.packageId || listing.packageHead!==record.package.head
    || listing.subjectId!==input.subjectId || record.subjectId!==input.subjectId || record.listingId!==input.listingId
    || canonicalPortableCardJson(listing.package)!==canonicalPortableCardJson(record.package)
    || !sameWildzPlayerCoordinate(listing.sellerHandle,record.ownerReceizId)
    || listing.sellerReceizUserId!==plan.currentOwnerReceizId
    || plan.subjectId!==input.subjectId || record.offer?.transferId!==plan.transferId
    || plan.policy.openBearer!==true || plan.policy.recipientReceizId!==null)throw Error("wilds_resource_package_market_payment_required");
  return listing;
}

/** Call only with the latest state returned by the proof-verifying conditional
 * market repository. A local/public projection never supplies this authority. */
export function assertWildsResourcePackagePayingTrade(state:ResourcePackageMarketState,input:Source & Readonly<{tradeId:string;buyerReceizId:string;buyerHandle:string}>){
  const listing=exactListing(state,input),trade=state.trades[input.tradeId];
  if(listing.status!=="reserved" || !trade || trade.id!==input.tradeId || trade.status!=="paying" || trade.listingId!==listing.id
    || trade.packageId!==input.packageId || trade.buyerReceizUserId!==input.buyerReceizId
    || !sameWildzPlayerCoordinate(trade.buyerHandle,input.buyerHandle) || listing.sellerReceizUserId===input.buyerReceizId
    || !(input.record.status==="reserved" || input.record.status==="settling" && input.record.tradeId===trade.id
      && sameWildzPlayerCoordinate(input.record.buyerReceizId??"",input.buyerHandle)))throw Error("wilds_resource_package_market_payment_required");
  return listing;
}

export function assertWildsResourcePackageCancelledListing(state:ResourcePackageMarketState,input:Source & Readonly<{sellerReceizId:string;sellerHandle:string}>){
  const listing=exactListing(state,input);
  if(listing.status!=="cancelled" || listing.sellerReceizUserId!==input.sellerReceizId
    || !sameWildzPlayerCoordinate(listing.sellerHandle,input.sellerHandle)
    || Object.values(state.trades).some(trade=>trade.listingId===listing.id && trade.status!=="released")
    || !["listed","reserved"].includes(input.record.status))throw Error("wilds_resource_package_market_cancellation_unavailable");
  return listing;
}

/** A durable released tombstone authorizes clearing only its own reservation.
 * Later reservations/payment stages are retained unchanged on cleanup replay. */
export function assertWildsResourcePackageReleasedTrade(state:ResourcePackageMarketState,input:Source & Readonly<{tradeId:string;buyerReceizId:string;buyerHandle:string}>){
  const listing=exactListing(state,input),trade=state.trades[input.tradeId],record=input.record;
  if(!trade || trade.id!==input.tradeId || trade.status!=="released" || trade.listingId!==listing.id || trade.packageId!==input.packageId
    || trade.buyerReceizUserId!==input.buyerReceizId || !sameWildzPlayerCoordinate(trade.buyerHandle,input.buyerHandle)
    || listing.sellerReceizUserId===input.buyerReceizId
    || !(record.status==="listed" || record.status==="reserved" && (record.tradeId!==trade.id || sameWildzPlayerCoordinate(record.buyerReceizId??"",input.buyerHandle))
      || record.status==="settling" && record.tradeId!==trade.id))throw Error("wilds_resource_package_market_release_unconfirmed");
  return listing;
}
