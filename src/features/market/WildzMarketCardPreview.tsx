"use client";

import {Component,useEffect,useRef,useState} from 'react';
import {WildsCardScene} from '../play/WildsCardScene';
import type {PortableCardAsset} from '../play/portable-card';
import type {WildzMarketOwnedCard} from '../../lib/receiz/wildz-market-collection';
import {WILDZ_PRODUCT} from '../../lib/wildz/product';
import {profileVaultCardQrDataUrl} from '../profile/profile-vault-card';
import styles from './WildzMarketSheet.module.css';
import {readWildzMarketCard,wildzMarketCardKey} from './wildz-market-card-preparation';

class MarketCardRenderBoundary extends Component<{children:React.ReactNode;onUnavailable?():void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onUnavailable?.();}
 render(){return this.state.failed?<p className={styles.note} role="status">This card could not be displayed.</p>:this.props.children;}
}

export function WildzMarketCardPreview({card,front,full=false,onUnavailable,openOnTap=false,onOpen,nearby=true,readCard=readWildzMarketCard}:{card:WildzMarketOwnedCard;front:React.ReactNode;full?:boolean;onUnavailable?():void;openOnTap?:boolean;onOpen?():void;nearby?:boolean;readCard?(card:WildzMarketOwnedCard,signal?:AbortSignal):Promise<PortableCardAsset>}){
 const [asset,setAsset]=useState<PortableCardAsset|null>(null),[flipped,setFlipped]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [qr,setQr]=useState('');
 const live=useRef(true),generation=useRef(0),preview=useRef<HTMLDivElement>(null),focusFrom=useRef<HTMLElement|null>(null),lastGesture=useRef(-Infinity),controller=useRef<AbortController|null>(null);
 const identity=wildzMarketCardKey(card),latestCard=useRef(card);latestCard.current=card;
 const latestReader=useRef(readCard);latestReader.current=readCard;
 // Cleanup invalidates the current numeric generation and controller, which
 // may have been replaced when a distant preview released its dossier.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{live.current=true;generation.current++;const work=new AbortController();controller.current=work;setAsset(null);setFlipped(false);setQr('');setError('');return()=>{live.current=false;generation.current++;work.abort();controller.current?.abort();};},[identity,openOnTap]);
 // Keep the small front painted, while distant flip dossiers/QRs are released.
 useEffect(()=>{if(!nearby){generation.current++;controller.current?.abort();controller.current=new AbortController();setAsset(null);setQr('');setFlipped(false);setLoading(false);}},[nearby]);
 const load=async()=>{const token=++generation.current;setLoading(true);setError('');try{const result=await latestReader.current(latestCard.current,controller.current?.signal);if(live.current&&token===generation.current){setAsset(result);return result;}}catch(cause){if(live.current&&token===generation.current)setError(cause instanceof Error?cause.message:'The card could not be loaded.');}finally{if(live.current&&token===generation.current)setLoading(false);}};
 const flip=async()=>{if(!asset&&!await load())return;setFlipped(v=>!v);};
 useEffect(()=>{
  if(!asset)return;
  const prior=focusFrom.current;focusFrom.current=null;
  if(prior&&!prior.isConnected&&document.activeElement===document.body)preview.current?.querySelector<HTMLElement>('.wilds-card-scene')?.focus({preventScroll:true});
  let active=true;void profileVaultCardQrDataUrl(asset.id,WILDZ_PRODUCT.origin).then(value=>{if(active)setQr(value);}).catch(()=>undefined);
  return()=>{active=false;};
 },[asset]);
 // The complete dossier loads only when the player opens or flips a card.
 useEffect(()=>{if(!full)return;const work=new AbortController();void readWildzMarketCard(latestCard.current,work.signal).then(result=>{if(!work.signal.aborted)setAsset(result);}).catch(cause=>{if(!work.signal.aborted)setError(cause instanceof Error?cause.message:'The card could not be loaded.');});return()=>work.abort();},[full,identity]);
 if(openOnTap)return <div className={styles.cardPreview}><MarketCardRenderBoundary key={identity} onUnavailable={onUnavailable}><button type="button" className={styles.previewOpen} aria-label={`Open ${card.title}`} onClick={onOpen}>{front}</button></MarketCardRenderBoundary></div>;
 return <div ref={preview} className={styles.cardPreview} data-full={full||undefined} aria-busy={loading||undefined}>
  <MarketCardRenderBoundary key={identity} onUnavailable={onUnavailable}>{asset?<WildsCardScene asset={asset} origin={WILDZ_PRODUCT.origin} qr={qr} front={front} tapToFlip flipped={flipped} onFlippedChange={setFlipped} interactive={full}/>:<div className={styles.previewFront} role="button" tabIndex={0} aria-label={`Flip ${card.title}`} onClick={event=>{if(event.detail===0&&performance.now()-lastGesture.current>=400){focusFrom.current=event.currentTarget;void flip();}}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();lastGesture.current=performance.now();focusFrom.current=event.currentTarget;void flip();}}} onPointerDown={event=>{event.currentTarget.dataset.startX=String(event.clientX);event.currentTarget.dataset.startY=String(event.clientY);}} onPointerUp={event=>{const dx=event.clientX-Number(event.currentTarget.dataset.startX),dy=event.clientY-Number(event.currentTarget.dataset.startY);if(Math.abs(dx)>=28&&Math.abs(dx)>Math.abs(dy)*1.2){event.preventDefault();lastGesture.current=performance.now();void flip();}else if(Math.hypot(dx,dy)<9){lastGesture.current=performance.now();void flip();}}}>{front}</div>}</MarketCardRenderBoundary>
  {error?<p className={styles.note} role="status">{error}</p>:null}
 </div>;
}
