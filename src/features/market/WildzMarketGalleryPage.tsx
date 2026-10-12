"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './WildzMarketSheet.module.css';

/** Keep compact decoded fronts in the document. Observers prioritize work;
 * they never remove painted cards during momentum or reverse scrolling. */
export function WildzMarketGalleryPage({children,active,index,columns,ready=true,eager=false,estimatedHeight=450,estimatedWidth=0,onApproach,onNear,onHeight}:{children:ReactNode|((nearby:boolean)=>ReactNode);active:boolean;index:number;columns:1|2;ready?:boolean;eager?:boolean;estimatedHeight?:number;estimatedWidth?:number;onApproach?(index:number,near:boolean):void;onNear?(index:number,near:boolean):void;onHeight?(index:number,height:number,width:number):void}){
 const element=useRef<HTMLDivElement>(null),measured=useRef<{height:number;width:number}|null>(null);
 const [near,setNear]=useState(index===0||eager);
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
 const rendered=ready;
 useEffect(()=>{
  const node=element.current;if(!node||!rendered||!active)return;
  const observer=new ResizeObserver(()=>{const rect=node.getBoundingClientRect();measured.current={height:rect.height,width:rect.width};onHeight?.(index,rect.height,rect.width);});
  observer.observe(node);return()=>observer.disconnect();
 },[rendered,active,columns,index,onHeight]);
 const held=measured.current;
 return <div ref={element} data-gallery-page={index} data-rendered={rendered||undefined} className={styles.galleryPage} style={!rendered?{height:held&&Math.abs(held.width-estimatedWidth)<1?held.height:estimatedHeight}:undefined} aria-hidden={!rendered||undefined}>
  {rendered?<div className={styles.listingGrid} data-mobile-columns={columns}>{typeof children==='function'?children(active&&near):children}</div>:null}
 </div>;
}
