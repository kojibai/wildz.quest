import {admitWildzMarketOfferMessage,type WildzMarketOffer} from './wildz-market-offers';
import {canonicalPortableCardJson} from '../play/portable-card';

export type WildzMarketOfferAttemptStore=Readonly<{load():readonly WildzMarketOffer[];write(values:readonly WildzMarketOffer[]):void}>;
/** Private retry terms only; local JSON cannot authorize payment or custody. */
export function createWildzMarketOfferAttemptStore(binding:Readonly<{ownerHandle:string;keyId:string}>):WildzMarketOfferAttemptStore{
 const key=`wildz:market:offer-attempts:v1:${binding.ownerHandle}:${binding.keyId}`;
 const read=()=>{if(typeof window==='undefined')throw Error('Offer storage is unavailable.');const raw=window.localStorage.getItem(key);if(!raw)return [];if(raw.length>100000)throw Error('Saved offers are invalid.');const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data)||data.length>32)throw Error('Saved offers are invalid.');
  const admitted=data.map((offer:WildzMarketOffer)=>admitWildzMarketOfferMessage({kind:'market-offer',offer},binding.ownerHandle,offer.ownerHandle).offer);
  if(new Set(admitted.map(v=>v.offerId)).size!==admitted.length)throw Error('Saved offer attempts conflict.');return admitted;
 };
 return {load:read,write(values){if(typeof window==='undefined')throw Error('Offer storage is unavailable.');const bytes=canonicalPortableCardJson(values);window.localStorage.setItem(key,bytes);if(canonicalPortableCardJson(read())!==bytes)throw Error('The exact offer could not be saved.');}};
}
