import type {CreatureRarity} from '../play/creature-catalog';
import {verifyAnyWildsCard,type PortableCardAsset} from '../play/portable-card';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import {readWildzMarketCard,wildzMarketCardKey} from './wildz-market-card-preparation';
import {wildzMarketCardRarity} from './wildz-market-discovery';

export type WildzMarketRaritySnapshot=Readonly<{complete:boolean;rarities:ReadonlyMap<string,CreatureRarity|null>}>;
const cancelled=()=>new DOMException('Catalogue indexing was cancelled.','AbortError');
const sealedRarity=(card:WildzMarketOwnedCard,asset:PortableCardAsset):CreatureRarity|null=>{
 if(asset.id!==card.assetId||asset.proof.digest!==card.proofDigest)return null;
 return wildzMarketCardRarity({...card,asset});
};

/** Index every exact catalogue revision independently of image preparation.
 * Only rarity scalars survive a scan; shared card reads retain their existing
 * bounded cache, and no image or value work is started here. */
export function createWildzMarketRarityIndex({readCard=readWildzMarketCard,yieldToBrowser=()=>new Promise<void>(resolve=>setTimeout(resolve,0))}:{
 /** Return an already-verified exact source, as the shared public reader does. */
 readCard?(card:WildzMarketOwnedCard,signal?:AbortSignal):Promise<PortableCardAsset>;
 yieldToBrowser?():Promise<void>;
}={}){
 const rarities=new Map<string,CreatureRarity|null>();let identity='',generation=0;
 const snapshot=(cards:readonly WildzMarketOwnedCard[]):WildzMarketRaritySnapshot=>{
  const keys=new Set(cards.map(wildzMarketCardKey)),nextIdentity=[...keys].join('|');
  if(identity!==nextIdentity){identity=nextIdentity;generation++;for(const key of rarities.keys())if(!keys.has(key))rarities.delete(key);}
  return {complete:[...keys].every(key=>rarities.has(key)),rarities:new Map(rarities)};
 };
 return {snapshot,async scan(cards:readonly WildzMarketOwnedCard[],signal?:AbortSignal):Promise<WildzMarketRaritySnapshot>{
  snapshot(cards);const started=generation;
  const assertActive=()=>{if(signal?.aborted||started!==generation)throw cancelled();};
  const pending=[...new Map(cards.filter(card=>!rarities.has(wildzMarketCardKey(card))).map(card=>[wildzMarketCardKey(card),card])).values()];let next=0;
  assertActive();
  while(next<pending.length){
   // Yield before the first batch too, allowing the prepared first screen to
   // paint. Keep hashing out of render and release the thread every four cards.
   await yieldToBrowser();assertActive();
   const batch=pending.slice(next,next+4);next+=batch.length;
   await Promise.all(batch.map(async card=>{
    assertActive();let rarity:CreatureRarity|null=null;
    try{
     if(card.asset){if(verifyAnyWildsCard(card.asset,{useContentCache:false}).ok)rarity=sealedRarity(card,card.asset);}
     else{const asset=await readCard(card,signal);assertActive();rarity=sealedRarity(card,asset);}
    }catch(cause){assertActive();if(cause instanceof DOMException&&cause.name==='AbortError')throw cause;}
    assertActive();rarities.set(wildzMarketCardKey(card),rarity);
   }));
  }
  assertActive();return snapshot(cards);
 }};
}
