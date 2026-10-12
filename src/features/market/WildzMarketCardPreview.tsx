"use client";

import {useEffect,useRef,useState} from 'react';
import {WildsCardScene} from '../play/WildsCardScene';
import type {PortableCardAsset} from '../play/portable-card';
import {verifyAnyWildsCard} from '../play/portable-card';
import {parsePublicWildsCardRecord} from '../play/public-card-record';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import {WILDZ_PRODUCT} from '../../lib/wildz/product';
import {profileVaultCardQrDataUrl} from '../profile/profile-vault-card';
import styles from './WildzMarketSheet.module.css';

const cards=new Map<string,Promise<PortableCardAsset>>();
async function readCard(card:WildzMarketOwnedCard){
 const key=`${card.assetId}:${card.proofDigest}:${card.ownerHandle}`;
 let held=cards.get(key);
 if(!held){held=(async()=>{
  if(card.asset&&card.asset.id===card.assetId&&card.asset.proof.digest===card.proofDigest&&verifyAnyWildsCard(card.asset).ok)return card.asset;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(`/api/cards/${encodeURIComponent(card.assetId)}?profile=${encodeURIComponent(card.ownerHandle)}`,{credentials:'omit',signal:controller.signal,cache:'no-store'});
   const text=await response.text();if(text.length>4000000)throw Error('The complete card could not be loaded.');const payload=JSON.parse(text),record=parsePublicWildsCardRecord(payload.record);
   if(!response.ok||payload.ok!==true||record?.assetId!==card.assetId||record.asset.proof.digest!==card.proofDigest)throw Error('This exact card revision could not be loaded. Refresh the collection.');return record.asset;
  }finally{clearTimeout(timer);}
 })();if(cards.size>=32)cards.delete(cards.keys().next().value!);cards.set(key,held);void held.catch(()=>{if(cards.get(key)===held)cards.delete(key);});}
 return held;
}

export function WildzMarketCardPreview({card,front,full=false}:{card:WildzMarketOwnedCard;front:React.ReactNode;full?:boolean}){
 const [asset,setAsset]=useState<PortableCardAsset|null>(null),[flipped,setFlipped]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [qr,setQr]=useState('');
 const live=useRef(true),generation=useRef(0),preview=useRef<HTMLDivElement>(null),focusFrom=useRef<HTMLElement|null>(null),lastGesture=useRef(-Infinity);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const load=async()=>{const token=++generation.current;setLoading(true);setError('');try{const result=await readCard(card);if(live.current&&token===generation.current){setAsset(result);return result;}}catch(cause){if(live.current&&token===generation.current)setError(cause instanceof Error?cause.message:'The card could not be loaded.');}finally{if(live.current&&token===generation.current)setLoading(false);}};
 const flip=async()=>{if(!asset&&!await load())return;setFlipped(v=>!v);};
 useEffect(()=>{
  if(!asset)return;
  const prior=focusFrom.current;focusFrom.current=null;
  if(prior&&!prior.isConnected&&document.activeElement===document.body)preview.current?.querySelector<HTMLElement>('.wilds-card-scene')?.focus({preventScroll:true});
  let active=true;void profileVaultCardQrDataUrl(asset.id,WILDZ_PRODUCT.origin).then(value=>{if(active)setQr(value);}).catch(()=>undefined);
  return()=>{active=false;};
 },[asset]);
 // The complete dossier loads only when the player opens or flips a card.
 useEffect(()=>{if(!full)return;let active=true;void readCard(card).then(result=>{if(active)setAsset(result);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'The card could not be loaded.');});return()=>{active=false;};},[full,card]);
 return <div ref={preview} className={styles.cardPreview} data-full={full||undefined} aria-busy={loading||undefined}>
  {asset?<WildsCardScene asset={asset} origin={WILDZ_PRODUCT.origin} qr={qr} front={front} tapToFlip flipped={flipped} onFlippedChange={setFlipped} interactive={full}/>:<div className={styles.previewFront} role="button" tabIndex={0} aria-label={`Flip ${card.title}`} onClick={event=>{if(event.detail===0&&performance.now()-lastGesture.current>=400){focusFrom.current=event.currentTarget;void flip();}}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();lastGesture.current=performance.now();focusFrom.current=event.currentTarget;void flip();}}} onPointerDown={event=>{event.currentTarget.dataset.startX=String(event.clientX);event.currentTarget.dataset.startY=String(event.clientY);}} onPointerUp={event=>{const dx=event.clientX-Number(event.currentTarget.dataset.startX),dy=event.clientY-Number(event.currentTarget.dataset.startY);if(Math.abs(dx)>=28&&Math.abs(dx)>Math.abs(dy)*1.2){event.preventDefault();lastGesture.current=performance.now();void flip();}else if(Math.hypot(dx,dy)<9){lastGesture.current=performance.now();void flip();}}}>{front}</div>}
  {error?<p className={styles.note} role="status">{error}</p>:null}
 </div>;
}
