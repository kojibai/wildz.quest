import type {WildzMarketServiceV128,WildzMarketSnapshotV128} from './wildz-market-service-v128';
import {createWildzMarketCardPreparer} from './wildz-market-card-preparation';
import {discoverWildzOwnedCards,initialMarketDiscovery} from './wildz-market-discovery';
import {sameWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';

export const WILDZ_MARKET_PAGE_SIZE=6;
const sessions=new WeakMap<WildzMarketServiceV128,ReturnType<typeof createWildzMarketWarmup>>();

function firstScreen(snapshot:WildzMarketSnapshotV128){
 const collection=snapshot.collection??[],byId=new Map(collection.map(card=>[card.assetId,card]));
 const active=snapshot.listings.filter(listing=>listing.status==='active');
 const listed=active.flatMap(listing=>{
  if(listing.asset.kind!=='creature')return [];
  const card=byId.get(listing.asset.assetId);return card&&sameWildzPlayerCoordinate(card.ownerHandle,listing.sellerHandle)?[card]:[];
 });
 const resources=active.filter(listing=>listing.kind!=='creature').map(()=>null);
 const unlisted=discoverWildzOwnedCards(collection,snapshot.listings,initialMarketDiscovery);
 const seen=new Set<string>();
 return [...listed,...resources,...unlisted].slice(0,WILDZ_MARKET_PAGE_SIZE).flatMap(card=>{if(!card||seen.has(card.assetId))return [];seen.add(card.assetId);return [card];});
}

/** One read and one small first-screen preparation per Explorer service.
 * Navigation reuses verified images; pulse updates never reload listings. */
export function createWildzMarketWarmup(service:WildzMarketServiceV128,preparer=createWildzMarketCardPreparer({readValue:id=>service.readValue?.(id)})){
 let pending:Promise<void>|null=null,loaded=false,controller:AbortController|null=null,cancellation=0;
 const update=()=>preparer.pin(firstScreen(service.snapshot()));
 const ready=(generation=cancellation):Promise<void>=>{
  if(generation!==cancellation)return Promise.reject(new DOMException('Market entry was cancelled.','AbortError'));
  if(loaded){update();return Promise.resolve();}
  if(pending)return controller?.signal.aborted?pending.catch(()=>undefined).then(()=>ready(generation)):pending;
  controller=new AbortController();const signal=controller.signal;
  const operation=(async()=>{
   const snapshot=await service.read();signal.throwIfAborted();
   const cards=firstScreen(snapshot);preparer.pin(cards);await preparer.prepare(cards,signal);
   loaded=true;
  })().finally(()=>{if(pending===operation)pending=null;});
  pending=operation;return operation;
 };
 return {preparer,update,cancel(){cancellation++;controller?.abort();},ready};
}
export function getWildzMarketWarmup(service:WildzMarketServiceV128){
 let session=sessions.get(service);if(!session){session=createWildzMarketWarmup(service);sessions.set(service,session);}return session;
}
