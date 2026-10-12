"use client";

import React, { useRef, useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import { WildsCard } from "./WildsCard";
import { WildsCardBack } from "./WildsCardBack";
import type { AdventureCardCondition } from "./adventure/card-condition";

export function WildsCardScene({ asset, origin, qr, condition, onSaveProof, tapToFlip = false, speaking = false, flipped:controlledFlipped,onFlippedChange,interactive=true,front }: { asset: PortableCardAsset; origin: string; qr: string; condition?: AdventureCardCondition | null; tapToFlip?: boolean; speaking?: boolean; onSaveProof?: () => Promise<void>;flipped?:boolean;onFlippedChange?(flipped:boolean):void;interactive?:boolean;front?:React.ReactNode }) {
  const scene = useRef<HTMLDivElement>(null);
  const lastGesture = useRef(-Infinity);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number; startedAt: number; interactive: boolean } | null>(null);
  const [localFlipped, setFlipped] = useState(false);
  const flipped=controlledFlipped??localFlipped;
  const flip = () => {if(onFlippedChange)onFlippedChange(!flipped);else setFlipped(value=>!value);};
  return (
    <div
      aria-label={`Two-sided ${asset.manifest.name} card. Swipe horizontally to flip.`}
      className={`wilds-card-scene${speaking ? " is-speaking" : ""}`}
      onClick={(event) => {
        // Screen readers activate through a click without pointer events.
        // Ordinary pointer clicks are already handled by the gesture below.
        if (!tapToFlip || event.detail !== 0 || performance.now() - lastGesture.current < 400) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("button, a, input, select, textarea, summary, [role='button']")) return;
        flip();
      }}
      onKeyDown={(event) => {
        if (event.target===event.currentTarget&&(event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          lastGesture.current = performance.now();
          flip();
        }
      }}
      onPointerCancel={() => { swipeStart.current = null; }}
      onPointerDown={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        swipeStart.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
          startedAt: performance.now(),
          interactive: Boolean(target?.closest("button, a, input, select, textarea, summary, [role='button']"))
        };
      }}
      onPointerLeave={() => {
        scene.current?.style.setProperty("--tilt-x", "0deg");
        scene.current?.style.setProperty("--tilt-y", "0deg");
        scene.current?.style.setProperty("--creature-gaze-x", "0px");
        scene.current?.style.setProperty("--creature-gaze-y", "0px");
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        const maximum = Math.max(1, ...Object.values(asset.manifest.stats));
        const gazeRange = 2.5 + asset.manifest.stats.speed / maximum * 4.5;
        scene.current?.style.setProperty("--tilt-y", `${x * 12}deg`);
        scene.current?.style.setProperty("--tilt-x", `${y * -9}deg`);
        scene.current?.style.setProperty("--creature-gaze-x", `${x * gazeRange}px`);
        scene.current?.style.setProperty("--creature-gaze-y", `${y * gazeRange}px`);
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || start.pointerId !== event.pointerId || start.interactive) return;
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) >= 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          lastGesture.current = performance.now();
          flip();
          return;
        }
        if (tapToFlip && !start.interactive && performance.now() - start.startedAt <= 360 && Math.hypot(deltaX, deltaY) <= 9) {
          lastGesture.current = performance.now();
          flip();
        }
      }}
      ref={scene}
      role="group"
      tabIndex={0}
    >
      <div className="wilds-card-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div className="wilds-card-float">
        <div className={`wilds-card-flipper${flipped ? " is-flipped" : ""}`}>
          <div aria-hidden={flipped} className="wilds-card-face wilds-card-face-front" inert={flipped ? true : undefined}>{front??<WildsCard asset={asset} condition={condition} speaking={speaking} interactive={interactive}/>}</div>
          <div aria-hidden={!flipped} className="wilds-card-face wilds-card-face-back" inert={!flipped ? true : undefined}><WildsCardBack onSaveProof={onSaveProof} asset={asset} condition={condition} origin={origin} qr={qr} /></div>
        </div>
      </div>
    </div>
  );
}
