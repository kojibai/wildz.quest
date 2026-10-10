"use client";

import { useEffect, useRef } from "react";
import { Crosshair, Target, Hammer } from 'lucide-react';
import {wildsEquipmentHandLabel,type WildsEquipmentControls} from './wilds-equipment-controls';
import {wildsPlayerActionKey} from "./player-action-key";

export type WildsPlayerHand = "left" | "right";
export type WildsPlayerHandIntent = "strike" | "grab" | "aim" | "release-aim" | "draw" | "shoot" | "use" | "cancel";

function HandIcon({side}: {side: WildsPlayerHand}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={side === "left" ? {transform: "scaleX(-1)"} : undefined}>
    <path d="M6 12V6a2 2 0 0 1 4 0v5M10 6a2 2 0 0 1 4 0v5M14 7a2 2 0 0 1 4 0v5M18 9a2 2 0 0 1 3 1.7V15c0 3-2 5-5 5H10c-2 0-3-1-4-3l-3-4a1.8 1.8 0 0 1 2.5-2.5L8 13" />
  </svg>;
}

function JumpIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 11 5-5 5 5M7 18l5-5 5 5" />
  </svg>;
}

/** One controller housing; pointer cancellation never becomes an action. */
export function WildsPlayerActionPad({enabled, cancelSignal, equipment, onJump, onHandAction}: {
  enabled: boolean;
  cancelSignal: number;
  onJump?: () => void;
  onHandAction?: (hand: WildsPlayerHand, intent: WildsPlayerHandIntent) => void;
  equipment?:WildsEquipmentControls;
}) {
  const presses = useRef<Record<WildsPlayerHand, {pointerId: number; startedAt: number} | null>>({left: null, right: null});
  const pointerClick = useRef<Record<WildsPlayerHand,boolean>>({left:false,right:false});
  const repeatFire=useRef<ReturnType<typeof setInterval>|null>(null);
  const currentAction=useRef(onHandAction);currentAction.current=onHandAction;
  const heldKeys=useRef(new Set<string>());
  const gearHolders=useRef({left:new Set<string>(),right:new Set<string>()});
  const ranged=equipment?.mode==='bow'||equipment?.mode==='rifle';
  const stop=()=>{if(repeatFire.current!==null)clearInterval(repeatFire.current);repeatFire.current=null;heldKeys.current.clear();gearHolders.current.left.clear();gearHolders.current.right.clear();presses.current.left=null;presses.current.right=null;currentAction.current?.('left','cancel');};
  const pressGear=(hand:WildsPlayerHand,holder:string)=>{
    if(!ranged)return false;
    const holders=gearHolders.current[hand];if(holders.has(holder))return true;const first=holders.size===0;holders.add(holder);if(!first)return true;
    if(hand==='left')onHandAction?.(hand,'aim');
    else if(equipment?.mode==='bow')onHandAction?.(hand,'draw');
    else {onHandAction?.(hand,'shoot');if(repeatFire.current===null)repeatFire.current=setInterval(()=>currentAction.current?.('right','shoot'),450);}
    return true;
  };
  const releaseGear=(hand:WildsPlayerHand,holder:string)=>{
    if(!ranged)return false;
    const holders=gearHolders.current[hand];if(!holders.delete(holder)||holders.size)return true;
    if(hand==='left')onHandAction?.(hand,'release-aim');
    else {if(repeatFire.current!==null)clearInterval(repeatFire.current);repeatFire.current=null;if(equipment?.mode==='bow')onHandAction?.(hand,'shoot');}
    return true;
  };
  useEffect(() => {
    stop();
    return stop;
    // Input cleanup must use the latest callback without cancelling on every game render.
  }, [enabled, cancelSignal,equipment?.mode,equipment?.hand,equipment?.id]);
  useEffect(() => {
    const cancel = () => stop();
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    return () => {stop();window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel);};
  }, []);
  useEffect(() => {
    const keydown=(event:KeyboardEvent)=>{
      if(!enabled)return;
      const action=wildsPlayerActionKey(event,event.target instanceof HTMLElement?event.target:null);
      if(!action)return;
      if(action.kind==="jump"&&onJump){event.preventDefault();onJump();}
      if(action.kind==="hand"&&onHandAction){event.preventDefault();heldKeys.current.add(event.code);if(!pressGear(action.hand,`key:${event.code}`))onHandAction(action.hand,equipment?.mode==='tool'&&equipment.hand===action.hand&&!event.shiftKey?'use':action.intent);}
    };
    const keyup=(event:KeyboardEvent)=>{if(!heldKeys.current.delete(event.code))return;if(event.code==='KeyQ'||event.code==='KeyE')releaseGear(event.code==='KeyQ'?'left':'right',`key:${event.code}`);};
    window.addEventListener("keydown",keydown);
    window.addEventListener('keyup',keyup);
    return ()=>{window.removeEventListener("keydown",keydown);window.removeEventListener('keyup',keyup);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enabled,onJump,onHandAction,equipment?.mode,equipment?.hand,equipment?.id]);
  return <div className="wildz-player-action-pad" role="group" aria-label="Jump and hand controls">
    <button className="wildz-player-jump" aria-label="Jump" title="Jump · Space" disabled={!enabled || !onJump}
      onPointerDown={event => {if (event.button === 0) {event.preventDefault(); onJump?.();}}}
      onClick={event => {if (event.detail === 0) onJump?.();}} type="button">
      <JumpIcon />
    </button>
    {(["left", "right"] as const).map(hand => <button key={hand} className={`wildz-player-hand is-${hand}`} aria-label={wildsEquipmentHandLabel(hand,equipment)} title={`${wildsEquipmentHandLabel(hand,equipment)} · ${hand==='left'?'Q':'E'}`} disabled={!enabled || !onHandAction}
      onPointerDown={event => {
        if (!enabled || event.button !== 0) return;
        event.preventDefault(); pointerClick.current[hand]=true; presses.current[hand] = {pointerId: event.pointerId, startedAt: performance.now()};
        try {event.currentTarget.setPointerCapture(event.pointerId);} catch { /* Release still binds the same pointer. */ }
        pressGear(hand,`pointer:${event.pointerId}`);
      }}
      onPointerUp={event => {
        const press = presses.current[hand]; presses.current[hand] = null;
        if (!enabled || !press || press.pointerId !== event.pointerId) return;
        if(releaseGear(hand,`pointer:${event.pointerId}`))return;
        onHandAction?.(hand, performance.now() - press.startedAt >= 350 ? "grab" : equipment?.mode==='tool'&&equipment.hand===hand?'use':"strike");
      }}
      onPointerCancel={stop}
      onLostPointerCapture={() => {if(presses.current[hand])stop();}}
      onBlur={stop}
      onKeyDown={()=>{pointerClick.current[hand]=false;}}
      onClick={event => {if(pointerClick.current[hand]){pointerClick.current[hand]=false;return;}if(enabled&&event.detail===0){if(ranged){onHandAction?.(hand,hand==='left'?'aim':'shoot');if(hand==='left')onHandAction?.(hand,'release-aim');}else onHandAction?.(hand,event.shiftKey?'grab':equipment?.mode==='tool'&&equipment.hand===hand?'use':'strike');}}}
      type="button">{ranged?hand==='left'?<Crosshair size={22}/>:<Target size={22}/>:equipment?.mode==='tool'&&equipment.hand===hand?<Hammer size={22}/>:<HandIcon side={hand}/>}<small aria-hidden="true">{hand === "left" ? "L" : "R"}</small></button>)}
    {equipment?<span className="wildz-player-equipment-readout" role="status">{equipment.label} · {equipment.durability}/{equipment.capacity}</span>:null}
  </div>;
}
