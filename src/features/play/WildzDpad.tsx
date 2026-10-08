"use client";

import { Icons } from "@/components/icons";
import type { WildsInput } from "./game-state";
import { cameraRelativeMovement, type WildsMovementMode } from "./wilds-movement";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export function WildzDpad({ cameraHeadingRef, movementMode, onInput, cancelSignal = 0, label }: {
  cameraHeadingRef: RefObject<number>;
  movementMode: WildsMovementMode;
  onInput: (input: WildsInput) => void;
  cancelSignal?: number;
  label?: string;
}) {
  const vector = useRef({ x: 0, z: 0 });
  const dragging = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<HTMLButtonElement | null>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastEmissionRef = useRef<number | null>(null);
  const gestureRevisionRef = useRef(0);
  const input = useRef(onInput);
  const mode = useRef(movementMode);
  const [active, setActive] = useState(false);
  const knobRef = useRef<HTMLElement>(null);

  input.current = onInput;
  mode.current = movementMode;

  const emitMovement = useCallback((next = vector.current, sampledAt = performance.now()) => {
    if (Math.hypot(next.x, next.z) < 0.08) return;
    const relative = cameraRelativeMovement(next, cameraHeadingRef.current);
    if (dragging.current) lastEmissionRef.current = sampledAt;
    input.current({ type: "move-vector", x: relative.x, z: relative.z, mode: mode.current });
  }, [cameraHeadingRef]);

  const reset = useCallback(() => {
    const pointerId = activePointerIdRef.current;
    const target = captureTargetRef.current;
    dragging.current = false;
    activePointerIdRef.current = null;
    captureTargetRef.current = null;
    boundsRef.current = null;
    gestureRevisionRef.current++;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastEmissionRef.current = null;
    vector.current = { x: 0, z: 0 };
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    setActive(false);
    try {
      if (pointerId !== null && target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    } catch { /* Ref cancellation also works when capture is unavailable. */ }
  }, []);

  useEffect(() => reset(), [cancelSignal, reset]);

  const startRepeat = useCallback(() => {
    const revision = gestureRevisionRef.current;
    const tick = (now: number) => {
      if (!dragging.current || revision !== gestureRevisionRef.current) return;
      frameRef.current = null;
      if (lastEmissionRef.current === null || now - lastEmissionRef.current >= 45) {
        emitMovement(vector.current, now);
      }
      if (dragging.current && revision === gestureRevisionRef.current) frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }, [emitMovement]);

  const update = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = boundsRef.current;
    if (!rect) return vector.current;
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.42);
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const magnitude = Math.hypot(rawX, rawY);
    const scale = magnitude > radius ? radius / magnitude : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const next = { x: x / radius, z: y / radius };
    vector.current = next;
    if (knobRef.current) knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
    return next;
  }, []);

  useEffect(() => {
    const stop = () => reset();
    const finishPointer = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) reset();
    };
    const movePointer = (event: PointerEvent) => {
      if (!dragging.current || activePointerIdRef.current !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) reset();
      else {
        const next = update(event);
        if (lastEmissionRef.current === null) emitMovement(next);
      }
    };
    // Capture-phase document listeners survive a failed pointer capture and an
    // outside release, even when another overlay consumes the event.
    document.addEventListener("pointerup", finishPointer, true);
    document.addEventListener("pointercancel", finishPointer, true);
    document.addEventListener("pointermove", movePointer, true);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      document.removeEventListener("pointerup", finishPointer, true);
      document.removeEventListener("pointercancel", finishPointer, true);
      document.removeEventListener("pointermove", movePointer, true);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
      reset();
    };
  }, [emitMovement, reset, update]);

  const release = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    if (event && activePointerIdRef.current !== event.pointerId) return;
    reset();
  };

  return (
    <button
      aria-label={label || `Movement trackpad. ${movementMode === "run" ? "Running" : "Walking"}. Hold and drag in any direction to travel.`}
      onKeyDown={event=>{const directions:Record<string,{x:number;z:number}>={ArrowUp:{x:0,z:-1},ArrowDown:{x:0,z:1},ArrowLeft:{x:-1,z:0},ArrowRight:{x:1,z:0}};if(directions[event.key]){event.preventDefault();event.stopPropagation();emitMovement(directions[event.key]);}}}
      aria-pressed={active}
      className="wildz-dpad"
      onLostPointerCapture={release}
      onPointerCancel={release}
      onPointerDown={(event) => {
        if (event.button !== 0 || activePointerIdRef.current !== null) return;
        event.preventDefault();
        activePointerIdRef.current = event.pointerId;
        captureTargetRef.current = event.currentTarget;
        boundsRef.current = event.currentTarget.getBoundingClientRect();
        dragging.current = true;
        const next = update(event);
        emitMovement(next);
        startRepeat();
        setActive(true);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
      }}
      onPointerMove={(event) => {
        if (!dragging.current || activePointerIdRef.current !== event.pointerId) return;
        const next = update(event);
        if (lastEmissionRef.current === null) emitMovement(next);
      }}
      onPointerUp={release}
      onContextMenu={(event) => { event.preventDefault(); reset(); }}
      type="button"
    >
      <span className="wildz-dpad-ring" aria-hidden="true" />
      <Icons.chevronUp className="wildz-dpad-north" aria-hidden="true" size={18} />
      <Icons.chevronRight className="wildz-dpad-east" aria-hidden="true" size={18} />
      <Icons.chevronDown className="wildz-dpad-south" aria-hidden="true" size={18} />
      <Icons.chevronLeft className="wildz-dpad-west" aria-hidden="true" size={18} />
      <i className="wildz-dpad-knob" aria-hidden="true" ref={knobRef} />
    </button>
  );
}
