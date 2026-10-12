import type {WildzMarketServiceV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {createWildzMarketCardPreparer} from './wildz-market-card-preparation';
import {discoverWildzOwnedCards,initialMarketDiscovery} from './wildz-market-discovery';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import {wildzMarketGalleryRows} from './wildz-market-gallery-layout';

export const WILDZ_MARKET_PAGE_SIZE=6;
const sessions=new WeakMap<WildzMarketServiceV128,ReturnType<typeof createWildzMarketWarmup>>();

function browseCards(snapshot:WildzMarketSnapshotV128,from=0,to=3){
 const collection=snapshot.collection??[],byId=new Map(collection.map(card=>[card.assetId,card]));
 const active=snapshot.listings.filter(listing=>listing.status==='active');
 const listed=active.flatMap(listing=>{
  if(listing.asset.kind!=='creature')return [];
  const card=byId.get(listing.asset.assetId);return card&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle)?[card]:[];
 });
 const resources=active.filter(listing=>listing.kind!=='creature').map(()=>null);
 const unlisted=discoverWildzOwnedCards(collection,snapshot.listings,initialMarketDiscovery);
 const seen=new Set<string>();
 const columns=typeof window==='undefined'||window.matchMedia('(max-width:759px)').matches?2:3;
 return wildzMarketGalleryRows([...listed,...resources,...unlisted],columns,card=>columns===2&&card===null).slice(from,to).flat().flatMap(card=>{if(!card||seen.has(card.assetId))return [];seen.add(card.assetId);return [card];});
}

/** One read and one small first-screen preparation per Explorer service.
 * Navigation reuses verified images; pulse updates never reload listings. */
export function createWildzMarketWarmup(service:WildzMarketServiceV128,preparer=createWildzMarketCardPreparer({readValue:id=>service.readValue?.(id)})){
 let pending:Promise<void>|null=null,loaded=false,controller:AbortController|null=null,cancellation=0;
 let ahead:Promise<unknown>|null=null,aheadController:AbortController|null=null,aheadIdentity='';
 const update=()=>preparer.pin(browseCards(service.snapshot()));
 const prefetch=(snapshot:WildzMarketSnapshotV128,generation:number)=>{
  const cards=browseCards(snapshot,3,15),identity=cards.map(card=>`${card.assetId}:${card.proofDigest}:${card.ownerHandle}`).join('|');
  if(!cards.length||generation!==cancellation||ahead&&aheadIdentity===identity)return;
  aheadController?.abort();aheadController=new AbortController();aheadIdentity=identity;
  const operation=preparer.prepare(cards,aheadController.signal).catch(()=>undefined).finally(()=>{if(ahead===operation)ahead=null;});ahead=operation;
 };
 const ready=(generation=cancellation):Promise<void>=>{
  if(generation!==cancellation)return Promise.reject(new DOMException('Market entry was cancelled.','AbortError'));
  if(pending)return controller?.signal.aborted?pending.catch(()=>undefined).then(()=>ready(generation)):pending;
  const held=loaded?service.snapshot():null;
  if(held&&preparer.peek(browseCards(held)).size===browseCards(held).length){update();prefetch(held,generation);return Promise.resolve();}
  controller=new AbortController();const signal=controller.signal;
  const operation=(async()=>{
   const snapshot=held??await service.read();signal.throwIfAborted();
   const cards=browseCards(snapshot);preparer.pin(cards);await preparer.prepare(cards,signal);
   loaded=true;
   prefetch(snapshot,generation);
  })().finally(()=>{if(pending===operation)pending=null;});
  pending=operation;return operation;
 };
 return {preparer,update,cancel(){cancellation++;controller?.abort();aheadController?.abort();},ready};
}
export function getWildzMarketWarmup(service:WildzMarketServiceV128){
 let session=sessions.get(service);if(!session){session=createWildzMarketWarmup(service);sessions.set(service,session);}return session;
}
