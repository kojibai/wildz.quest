import {createReceizClient} from '@receiz/sdk';
import {initialWildzMarketSourceV128,WILDZ_MARKET_SOURCE_DOMAIN_V128} from './wildz-market-source-journal-v128';
import {readWildzMarketPublicSourceProofV128,verifyWildzMarketSourceProofV128} from './wildz-market-source-repository-v128';
import type {WildzMarketSourceRepositoryV128,WildzMarketSourceResultV128} from './wildz-market-source-types-v128';
import {WILDZ_RECEIZ_APPLICATION_ID} from './wildz-application';

const sourceUrl='https://wildz.quest/receiz/market-source-v128';
export const isWildzMarketPublicSourceUrlV128=(url:string)=>url===sourceUrl||/^https:\/\/wildz\.quest\/receiz\/market-source-v128\/pages\/[a-f0-9]{64}$/.test(url);

/** Public byte reads use no application grant. Exact sealed source verification
 * below still checks its application, sequence, namespace and reducer. */
export function createWildzMarketPublicSdkV128(fetcher:typeof fetch=fetch){
 return createReceizClient({baseUrl:'https://receiz.com',fetchImpl:async(request,init)=>{
  const url=new URL(String(request)),source=url.searchParams.get('url')??'';
  if(url.origin!=='https://receiz.com'||url.pathname!=='/api/public-proof/by-url'||(init?.method??'GET')!=='GET'
   ||url.searchParams.size!==1||!isWildzMarketPublicSourceUrlV128(source))throw Error('wildz_market_public_path_invalid');
  return fetcher(`/api/wilds/market/source?url=${encodeURIComponent(source)}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error'});
 }});
}

/** Locally verified listing/review history. Browsing never opens a remote
 * write session. Explicit actions use the separate current native repository. */
export function createWildzMarketPublicReadSourceV128(fetcher:typeof fetch=fetch):Pick<WildzMarketSourceRepositoryV128,'load'|'observe'|'verifyReservation'>{
 const sdk=createWildzMarketPublicSdkV128(fetcher);
 let opened:Awaited<ReturnType<typeof verifyWildzMarketSourceProofV128>>|null=null,loaded=false;
 const snapshot=()=>({state:opened?.state??initialWildzMarketSourceV128(),head:opened?.predecessor.head.head??null,proof:opened?.proof??null});
 async function load(){
  const proof=await readWildzMarketPublicSourceProofV128(sdk);
  opened=proof?await verifyWildzMarketSourceProofV128(sdk,proof,{applicationId:WILDZ_RECEIZ_APPLICATION_ID,historical:true}):null;
  loaded=true;return snapshot();
 }
 async function observe(request:Readonly<{listingId:string;reservationId?:string}>):Promise<WildzMarketSourceResultV128>{
  if(!loaded)await load();
  const listing=opened?.state.listings[request.listingId]??opened?.historicalListings.get(request.listingId);
  if(!opened||!listing)throw Error('wildz_market_source_listing_missing');
  if(request.reservationId&&listing.reservation?.reservationId!==request.reservationId)throw Error('wildz_market_source_reservation_changed');
  const event=[...opened.events].reverse().find(item=>item.event.listingId===request.listingId);
  if(!event)throw Error('wildz_market_source_receipt_missing');
  return {snapshot:snapshot(),listing,receiptLocator:{schema:'wildz.market-source-locator.v128',domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,
   head:event.head,sourceArtifactSha256:opened.predecessor.artifact.artifactSha256,appendId:event.appendId}};
 }
 return {load,observe,async verifyReservation(request){
  const actual=await observe(request),reservation=actual.listing.reservation;
  if(!reservation||reservation.buyerHandle!==request.buyerHandle||reservation.sellerHandle!==request.sellerHandle
   ||reservation.priceUsdCents!==request.priceUsdCents||reservation.listingHead!==request.listingHead)throw Error('wildz_market_source_reservation_changed');
  return actual;
 }};
}
