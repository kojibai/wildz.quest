"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './WildzMarketSheet.module.css';
import {WILDZ_MARKET_PAGE_SIZE} from './wildz-market-warmup';

export function wildzMarketGalleryLookahead<T>(entries:readonly T[],visibleCount:number):readonly T[]{return entries.slice(visibleCount,visibleCount+2*WILDZ_MARKET_PAGE_SIZE);}

/** Keep scroll geometry, release distant image/flipper surfaces. The next
 * group mounts before it reaches the viewport, rather than on first sight. */
export function WildzMarketGalleryPage({children,active,index,columns}:{children:ReactNode;active:boolean;index:number;columns:1|2}){
 const element=useRef<HTMLDivElement>(null),height=useRef(0);
 const [near,setNear]=useState(index===0);
 useEffect(()=>{
  const node=element.current;if(!node||!active)return;
  const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{root:node.closest('[data-market-scroll]'),rootMargin:'650px 0px'});
  observer.observe(node);return()=>observer.disconnect();
 },[active]);
 const rendered=active&&near;
 useEffect(()=>{
  const node=element.current;if(!node||!rendered)return;
  const observer=new ResizeObserver(()=>{height.current=node.getBoundingClientRect().height;});
  observer.observe(node);return()=>observer.disconnect();
 },[rendered,columns]);
 return <div ref={element} data-gallery-page={index} data-rendered={rendered||undefined} className={styles.galleryPage} style={!rendered?{height:height.current||900}:undefined} aria-hidden={!rendered||undefined}>
  {rendered?<div className={styles.listingGrid} data-mobile-columns={columns}>{children}</div>:null}
 </div>;
}
