"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './WildzMarketSheet.module.css';
import {WILDZ_MARKET_PAGE_SIZE} from './wildz-market-warmup';

export function wildzMarketGalleryLookahead<T>(entries:readonly T[],visibleCount:number):readonly T[]{return entries.slice(visibleCount,visibleCount+2*WILDZ_MARKET_PAGE_SIZE);}

/** Keep scroll geometry, release distant image/flipper surfaces. The next
 * group mounts before it reaches the viewport, rather than on first sight. */
export function WildzMarketGalleryPage({children,active,index,columns,ready=true,onApproach,onNear}:{children:ReactNode;active:boolean;index:number;columns:1|2;ready?:boolean;onApproach?(index:number,near:boolean):void;onNear?(index:number,near:boolean):void}){
 const element=useRef<HTMLDivElement>(null),height=useRef(0);
 const [near,setNear]=useState(index===0);
 useEffect(()=>{
  const node=element.current;if(!node||!active||!onApproach)return;
  let live=true;
  const observer=new IntersectionObserver(entries=>{if(live)onApproach(index,entries.some(entry=>entry.isIntersecting));},{root:node.closest('[data-market-scroll]'),rootMargin:'2200px 0px'});
  observer.observe(node);return()=>{live=false;observer.disconnect();onApproach(index,false);};
 },[active,index,onApproach]);
 useEffect(()=>{
  const node=element.current;if(!node||!active)return;
  let live=true;
  const observer=new IntersectionObserver(entries=>{if(live){const next=entries.some(entry=>entry.isIntersecting);setNear(next);onNear?.(index,next);}},{root:node.closest('[data-market-scroll]'),rootMargin:'650px 0px'});
  observer.observe(node);return()=>{live=false;observer.disconnect();onNear?.(index,false);};
 },[active,index,onNear]);
 const rendered=active&&near&&ready;
 useEffect(()=>{
  const node=element.current;if(!node||!rendered)return;
  const observer=new ResizeObserver(()=>{height.current=node.getBoundingClientRect().height;});
  observer.observe(node);return()=>observer.disconnect();
 },[rendered,columns]);
 return <div ref={element} data-gallery-page={index} data-rendered={rendered||undefined} className={styles.galleryPage} style={!rendered?{height:height.current||900}:undefined} aria-hidden={!rendered||undefined}>
  {rendered?<div className={styles.listingGrid} data-mobile-columns={columns}>{children}</div>:null}
 </div>;
}
