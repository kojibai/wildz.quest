import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import {parseWildzPlayerCoordinate} from '../../lib/receiz/wildz-player-coordinate';
import {parsePublicWildsCardRecord} from '../play/public-card-record';
import {verifyAnyWildsCard,type PortableCardAsset} from '../play/portable-card';
import {renderWildsCardSvg} from '../play/card-svg';
import {createWildzMarketGalleryImage} from './wildz-market-gallery-image';

const CACHE_LIMIT=48;
// Generated artwork lives only as long as a prepared view. Original inventory
// objects may live for the entire game session and must not retain every URI.
const objectArtwork=new WeakMap<WildzMarketOwnedCard,{digest:string;url:string}>();
const abortError=()=>new DOMException('Card preparation was cancelled.','AbortError');
const assertActive=(signal?:AbortSignal)=>{if(signal?.aborted)throw abortError();};

export function wildzMarketCardKey(card:WildzMarketOwnedCard){
 const owner=parseWildzPlayerCoordinate(card.ownerHandle || card.artworkOwnerHandle || "");
 return `${card.assetId}:${card.proofDigest}:${owner?.actorId??card.ownerHandle}`;
}

export function wildzMarketCardImageUrl(card:WildzMarketOwnedCard){
 const local=objectArtwork.get(card);
 if(local?.digest===card.proofDigest)return local.url;
 if(process.env.NODE_ENV==='development'&&card.artworkUrl?.startsWith('/test-fixtures/market/cards/'))return card.artworkUrl;
 const owner=parseWildzPlayerCoordinate(card.ownerHandle || card.artworkOwnerHandle || "");
 if(!owner)throw Error('The card owner could not be resolved.');
 return `/api/cards/${encodeURIComponent(card.assetId)}/image?profile=${encodeURIComponent(owner.actorId)}&digest=${encodeURIComponent(card.proofDigest)}`;
}

/** Share exact revisions while allowing an abandoned page to release its work.
 * A second reader keeps a pending task alive; completed tasks retain at most 48 cards. */
function taskCache<T>(pinned:(key:string)=>boolean=()=>false){
 type Entry={promise:Promise<T>;controller:AbortController;users:number;settled:boolean};
 const entries=new Map<string,Entry>();
 return (key:string,task:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>=>{
  assertActive(signal);
  let entry=entries.get(key);
  if(!entry){
   const controller=new AbortController();
   entry={controller,users:0,settled:false,promise:Promise.resolve().then(()=>task(controller.signal))};
   const held=entry;
   void held.promise.then(()=>{held.settled=true;},()=>{held.settled=true;if(entries.get(key)===held)entries.delete(key);});
   if(entries.size>=CACHE_LIMIT){const oldest=[...entries.keys()].find(key=>!pinned(key));if(oldest)entries.delete(oldest);}
   entries.set(key,entry);
  }else{entries.delete(key);entries.set(key,entry);}
  const held=entry;held.users++;
  return new Promise<T>((resolve,reject)=>{
   let finished=false;
   const finish=()=>{
    if(finished)return false;finished=true;signal?.removeEventListener('abort',cancel);held.users--;
    if(!held.users&&!held.settled){held.controller.abort();if(entries.get(key)===held)entries.delete(key);}
    return true;
   };
   const cancel=()=>{if(finish())reject(abortError());};
   signal?.addEventListener('abort',cancel,{once:true});
   held.promise.then(value=>{if(finish())resolve(value);},cause=>{if(finish())reject(cause);});
   if(signal?.aborted)cancel();
  });
 };
}

const readCache=taskCache<PortableCardAsset>();
export function readWildzMarketCard(card:WildzMarketOwnedCard,signal?:AbortSignal):Promise<PortableCardAsset>{
 return readCache(wildzMarketCardKey(card),async workSignal=>{
  assertActive(workSignal);
  if(card.asset){
   if(card.asset.id!==card.assetId||card.asset.proof.digest!==card.proofDigest||!verifyAnyWildsCard(card.asset).ok)throw Error('This exact card revision could not be verified.');
   return card.asset;
  }
  const owner=parseWildzPlayerCoordinate(card.ownerHandle || card.artworkOwnerHandle || "");
  if(!owner)throw Error('The card owner could not be resolved.');
  const path=`/api/cards/${encodeURIComponent(card.assetId)}`;
  const options={credentials:'omit',signal:AbortSignal.any([workSignal,AbortSignal.timeout(15000)]),cache:'no-store'} as const;
  let response=await fetch(`${path}?profile=${encodeURIComponent(owner.actorId)}`,options);
  // Read the immutable complete object for display; a current-owner claim is
  // independently carried by the collection and is never inferred from art.
  if(response.status===404)response=await fetch(path,options);
  if(!response.ok)throw Error('This exact card revision could not be loaded.');
  const text=await response.text();assertActive(workSignal);
  if(text.length>4000000)throw Error('The complete card could not be loaded.');
  const payload=JSON.parse(text),record=parsePublicWildsCardRecord(payload.record);
  if(payload.ok!==true||record?.assetId!==card.assetId||record.asset.proof.digest!==card.proofDigest)throw Error('This exact card revision could not be loaded. Refresh the collection.');
  return record.asset;
 },signal);
}

export function decodeWildzMarketCardImage(src:string,signal?:AbortSignal):Promise<void>{
 assertActive(signal);
 return new Promise((resolve,reject)=>{
  const image=new window.Image();let finished=false;
  const finish=(cause?:unknown)=>{
   if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;
   if(cause){image.src='';reject(cause);}else resolve();
  };
  const cancel=()=>finish(abortError());
  const timer=setTimeout(()=>finish(Error('The card image could not be loaded.')),15000);
  signal?.addEventListener('abort',cancel,{once:true});
  image.onerror=()=>finish(Error('The card image could not be loaded.'));
  image.onload=()=>{void (async()=>{try{if(image.decode)await image.decode();assertActive(signal);if(!image.naturalWidth||!image.naturalHeight)throw Error('The card image is unavailable.');finish();}catch(cause){finish(cause);}})();};
  image.decoding='async';image.src=src;
  if(signal?.aborted)cancel();
 });
}

export type PreparedWildzMarketGalleryCard=Readonly<{key:string;card:WildzMarketOwnedCard;imageUrl:string}>;
export type PreparedWildzMarketCard=Readonly<{key:string;card:WildzMarketOwnedCard&{asset:PortableCardAsset};imageUrl:string;galleryImageUrl:string}>;

const withoutAsset=(card:WildzMarketOwnedCard)=>{const {asset,...metadata}=card;void asset;return metadata;};

export function wildzMarketPreparedCardView(prepared:PreparedWildzMarketCard,current:WildzMarketOwnedCard){
 if(prepared.key!==wildzMarketCardKey(current))throw Error('The prepared card revision does not match.');
 const card={...prepared.card,...current,asset:prepared.card.asset};
 objectArtwork.set(card,{digest:card.proofDigest,url:prepared.imageUrl});
 return card;
}

/** Publish a whole visible page only after its real images and local values are ready. */
export function createWildzMarketCardPreparer({readCard=readWildzMarketCard,decodeImage=decodeWildzMarketCardImage,readValue,createGalleryImage=createWildzMarketGalleryImage}:{
 readCard?(card:WildzMarketOwnedCard,signal?:AbortSignal):Promise<PortableCardAsset>;
 decodeImage?(url:string,signal?:AbortSignal):Promise<void>;
 readValue?(assetId:string):void|Promise<unknown>;
 createGalleryImage?(url:string,signal?:AbortSignal):Promise<string>;
}={}){
 const pinned=new Set<string>(),nearby=new Set<string>();
 const retained=(key:string)=>pinned.has(key)||nearby.has(key);
 const preparedCache=taskCache<PreparedWildzMarketCard>(retained);
 const completed=new Map<string,PreparedWildzMarketCard>();
 const gallery=new Map<string,PreparedWildzMarketGalleryCard>();let galleryKeys:Set<string>|null=null;
 const api={retainGallery(cards:readonly WildzMarketOwnedCard[]){galleryKeys=new Set(cards.map(wildzMarketCardKey));for(const key of gallery.keys())if(!galleryKeys.has(key))gallery.delete(key);},peekGallery(cards:readonly WildzMarketOwnedCard[]){
  return new Map(cards.flatMap(current=>{const key=wildzMarketCardKey(current),held=gallery.get(key);if(!held)return [];
   const card={...held.card,...withoutAsset(current)};objectArtwork.set(card,{digest:card.proofDigest,url:held.imageUrl});return [[key,{...held,card}] as const];
  }));
 },async read(card:WildzMarketOwnedCard,signal?:AbortSignal){assertActive(signal);return completed.get(wildzMarketCardKey(card))?.card.asset??await readCard(card,signal);},pin(cards:readonly WildzMarketOwnedCard[]){pinned.clear();cards.slice(0,6).forEach(card=>pinned.add(wildzMarketCardKey(card)));},protect(cards:readonly WildzMarketOwnedCard[]){nearby.clear();cards.slice(0,36).forEach(card=>nearby.add(wildzMarketCardKey(card)));},peek(cards:readonly WildzMarketOwnedCard[]){
  return new Map(cards.flatMap(card=>{const key=wildzMarketCardKey(card),ready=completed.get(key);return ready?[[key,ready] as const]:[];}));
 },async prepare(cards:readonly WildzMarketOwnedCard[],signal?:AbortSignal,onReady?:(card:PreparedWildzMarketCard)=>void):Promise<readonly PreparedWildzMarketCard[]>{
  const unique=[...new Map(cards.map(card=>[wildzMarketCardKey(card),card])).values()];
  const ready:(PreparedWildzMarketCard|null)[]=Array(unique.length).fill(null);let next=0;
  await Promise.all(Array.from({length:Math.min(4,unique.length)},async()=>{
   while(next<unique.length){
    assertActive(signal);const index=next++,card=unique[index]!;
    try{ready[index]=await preparedCache(wildzMarketCardKey(card),async workSignal=>{
     const asset=await readCard(card,workSignal);assertActive(workSignal);
     if(asset.id!==card.assetId||asset.proof.digest!==card.proofDigest)throw Error('The complete card revision does not match.');
     let svg:string|undefined;
     try{const result=await readValue?.(card.assetId);if(result&&typeof result==='object'&&'artworkAssetId' in result&&result.artworkAssetId===asset.id&&'artworkProofDigest' in result&&result.artworkProofDigest===asset.proof.digest&&'artworkSvg' in result&&typeof result.artworkSvg==='string'&&result.artworkSvg.startsWith('<svg')&&result.artworkSvg.length<1_000_000)svg=result.artworkSvg;}catch{/* A display calculation does not invalidate a complete proof. */}
     assertActive(workSignal);
     const imageUrl=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg??renderWildsCardSvg(asset))}`;
     const galleryImageUrl=await createGalleryImage(imageUrl,workSignal);assertActive(workSignal);
     await decodeImage(decodeImage===decodeWildzMarketCardImage?galleryImageUrl:imageUrl,workSignal);assertActive(workSignal);
     const view={...card,asset};objectArtwork.set(view,{digest:card.proofDigest,url:imageUrl});
     return {key:wildzMarketCardKey(card),card:view,imageUrl,galleryImageUrl};
    },signal);assertActive(signal);
     const prepared=ready[index]!;completed.delete(prepared.key);completed.set(prepared.key,prepared);
     while(completed.size>CACHE_LIMIT){const oldest=[...completed.keys()].find(key=>!retained(key));if(!oldest)break;completed.delete(oldest);}
     if(!galleryKeys||galleryKeys.has(prepared.key)){
      const card=withoutAsset(prepared.card);objectArtwork.set(card,{digest:card.proofDigest,url:prepared.galleryImageUrl});
      gallery.set(prepared.key,{key:prepared.key,card,imageUrl:prepared.galleryImageUrl});
     }
     onReady?.(prepared);
    }catch(cause){assertActive(signal);if(cause instanceof DOMException&&cause.name==='AbortError')throw cause;}
   }
  }));
  assertActive(signal);return ready.filter((card):card is PreparedWildzMarketCard=>card!==null);
 },async prepareGallery(cards:readonly WildzMarketOwnedCard[],signal?:AbortSignal,onReady?:(card:PreparedWildzMarketCard)=>void){
  // Release each pair's complete results before working on the next pair.
  // Yield between pairs so catalogue warming cannot monopolize input frames.
  for(let index=0;index<cards.length;index+=2){assertActive(signal);await api.prepare(cards.slice(index,index+2),signal,onReady);await new Promise<void>(resolve=>setTimeout(resolve,0));}
 }};return api;
}
