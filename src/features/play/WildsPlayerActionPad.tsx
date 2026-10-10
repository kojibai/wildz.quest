"use client";

import { useEffect, useRef } from "react";
import {wildsPlayerActionKey} from "./player-action-key";

export type WildsPlayerHand = "left" | "right";
export type WildsPlayerHandIntent = "strike" | "grab";

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
export function WildsPlayerActionPad({enabled, cancelSignal, onJump, onHandAction}: {
  enabled: boolean;
  cancelSignal: number;
  onJump?: () => void;
  onHandAction?: (hand: WildsPlayerHand, intent: WildsPlayerHandIntent) => void;
}) {
  const presses = useRef<Record<WildsPlayerHand, {pointerId: number; startedAt: number} | null>>({left: null, right: null});
  const pointerClick = useRef<Record<WildsPlayerHand,boolean>>({left:false,right:false});
  useEffect(() => {
    presses.current.left = null; presses.current.right = null;
  }, [enabled, cancelSignal]);
  useEffect(() => {
    const cancel = () => {presses.current.left = null; presses.current.right = null;};
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    return () => {window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel);};
  }, []);
  useEffect(() => {
    const keydown=(event:KeyboardEvent)=>{
      if(!enabled)return;
      const action=wildsPlayerActionKey(event,event.target instanceof HTMLElement?event.target:null);
      if(!action)return;
      if(action.kind==="jump"&&onJump){event.preventDefault();onJump();}
      if(action.kind==="hand"&&onHandAction){event.preventDefault();onHandAction(action.hand,action.intent);}
    };
    window.addEventListener("keydown",keydown);
    return ()=>window.removeEventListener("keydown",keydown);
  },[enabled,onJump,onHandAction]);
  return <div className="wildz-player-action-pad" role="group" aria-label="Jump and hand controls">
    <button className="wildz-player-jump" aria-label="Jump" title="Jump · Space" disabled={!enabled || !onJump}
      onPointerDown={event => {if (event.button === 0) {event.preventDefault(); onJump?.();}}}
      onClick={event => {if (event.detail === 0) onJump?.();}} type="button">
      <JumpIcon />
    </button>
    {(["left", "right"] as const).map(hand => <button key={hand} className={`wildz-player-hand is-${hand}`} aria-label={`${hand === "left" ? "Left" : "Right"} hand. Tap to strike; hold to grab`} title={`${hand === "left" ? "Left" : "Right"} hand · tap to strike, hold to grab`} disabled={!enabled || !onHandAction}
      onPointerDown={event => {
        if (!enabled || event.button !== 0) return;
        event.preventDefault(); pointerClick.current[hand]=true; presses.current[hand] = {pointerId: event.pointerId, startedAt: performance.now()};
        try {event.currentTarget.setPointerCapture(event.pointerId);} catch { /* Release still binds the same pointer. */ }
      }}
      onPointerUp={event => {
        const press = presses.current[hand]; presses.current[hand] = null;
        if (!enabled || !press || press.pointerId !== event.pointerId) return;
        onHandAction?.(hand, performance.now() - press.startedAt >= 350 ? "grab" : "strike");
      }}
      onPointerCancel={() => {presses.current[hand] = null;}}
      onLostPointerCapture={() => {presses.current[hand] = null;}}
      onBlur={() => {presses.current[hand] = null;}}
      onKeyDown={()=>{pointerClick.current[hand]=false;}}
      onClick={event => {if(pointerClick.current[hand]){pointerClick.current[hand]=false;return;}if (enabled && event.detail === 0) onHandAction?.(hand, event.shiftKey ? "grab" : "strike");}}
      type="button"><HandIcon side={hand}/><small aria-hidden="true">{hand === "left" ? "L" : "R"}</small></button>)}
  </div>;
}
