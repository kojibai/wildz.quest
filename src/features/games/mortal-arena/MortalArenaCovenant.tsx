"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icons } from "@/components/icons";
import type { PortableCardAsset } from "../../play/portable-card";

export function MortalArenaCovenant({ card, onConfirm, onExit }: {
  card: PortableCardAsset;
  onConfirm: () => void;
  onExit: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(0);

  const stop = () => {
    if (timerRef.current !== null) window.cancelAnimationFrame(timerRef.current);
    timerRef.current = null;
    setHolding(false);
    setProgress(0);
  };

  const begin = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (event) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    }
    if (timerRef.current !== null) return;
    setHolding(true);
    startedRef.current = performance.now();
    const frame = (now: number) => {
      const next = Math.min(1, (now - startedRef.current) / 1_100);
      setProgress(next);
      if (next >= 1) {
        timerRef.current = null;
        setHolding(false);
        onConfirm();
        return;
      }
      timerRef.current = window.requestAnimationFrame(frame);
    };
    timerRef.current = window.requestAnimationFrame(frame);
  };

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Releasing still cancels the hold when pointer capture is unavailable.
    }
    stop();
  };

  useEffect(() => () => {
    if (timerRef.current !== null) window.cancelAnimationFrame(timerRef.current);
  }, []);

  return (
    <div className="mortal-arena-covenant" role="document">
      <div className="mortal-arena-covenant-mark" aria-hidden="true"><Icons.trophy size={36} /><i /></div>
      <span>Mortal covenant · {card.manifest.name}</span>
      <h3>Every life in this ring is real.</h3>
      <p>This covenant applies to one exact match, its pinned cards, ruleset, and Kai uPulse. If a creature reaches zero Vitality, it retires permanently and its complete history remains honored in your Vault.</p>
      <div className="mortal-arena-covenant-choices" aria-label="Survival choices available during every match">
        <span><Icons.seal size={17} /><b>Guard</b></span>
        <span><Icons.users size={17} /><b>Tag</b></span>
        <span><Icons.door size={17} /><b>Withdraw</b></span>
      </div>
      <button
        className="mortal-arena-covenant-hold"
        onKeyDown={(event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) begin(); }}
        onKeyUp={stop}
        onPointerCancel={stop}
        onPointerDown={begin}
        onPointerUp={release}
        style={{ "--covenant-progress": progress } as React.CSSProperties}
        type="button"
      >
        <i aria-hidden="true" />
        <strong>{holding ? "Keep holding" : "Hold to enter"}</strong>
        <small>Zero Vitality is permanent</small>
      </button>
      <button className="mortal-arena-covenant-return" onClick={onExit} type="button">Return to the Wilds</button>
    </div>
  );
}
