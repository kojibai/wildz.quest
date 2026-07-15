"use client";

import { useRef, useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import { WildsCard } from "./WildsCard";
import { WildsCardBack } from "./WildsCardBack";

export function WildsCardScene({ asset, origin, qr }: { asset: PortableCardAsset; origin: string; qr: string }) {
  const scene = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const flip = () => setFlipped((value) => !value);
  return (
    <div
      aria-label={`Two-sided ${asset.manifest.name} card. Swipe horizontally to flip.`}
      className="wilds-card-scene"
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          flip();
        }
      }}
      onPointerCancel={() => { swipeStart.current = null; }}
      onPointerDown={(event) => {
        swipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      }}
      onPointerLeave={() => {
        scene.current?.style.setProperty("--tilt-x", "0deg");
        scene.current?.style.setProperty("--tilt-y", "0deg");
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        scene.current?.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - 0.5) * 12}deg`);
        scene.current?.style.setProperty("--tilt-x", `${((event.clientY - rect.top) / rect.height - 0.5) * -9}deg`);
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) >= 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) flip();
      }}
      ref={scene}
      role="group"
      tabIndex={0}
    >
      <div className="wilds-card-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div className="wilds-card-float">
        <div className={`wilds-card-flipper${flipped ? " is-flipped" : ""}`}>
          <div aria-hidden={flipped} className="wilds-card-face wilds-card-face-front" inert={flipped ? true : undefined}><WildsCard asset={asset} /></div>
          <div aria-hidden={!flipped} className="wilds-card-face wilds-card-face-back" inert={!flipped ? true : undefined}><WildsCardBack asset={asset} origin={origin} qr={qr} /></div>
        </div>
      </div>
    </div>
  );
}
