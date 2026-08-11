"use client";

import { Icons } from "@/components/icons";
import type { WildsInput } from "./game-state";
import { advanceMovementEmissionDeadline, cameraRelativeMovement, type WildsMovementMode } from "./wilds-movement";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export function WildzDpad({ cameraHeadingRef, movementMode, onInput, cancelSignal = 0 }: {
  cameraHeadingRef: RefObject<number>;
  movementMode: WildsMovementMode;
  onInput: (input: WildsInput) => void;
  cancelSignal?: number;
}) {
  const vector = useRef({ x: 0, z: 0 });
  const dragging = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const input = useRef(onInput);
  const mode = useRef(movementMode);
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  input.current = onInput;
  mode.current = movementMode;

  const emitMovement = useCallback((next = vector.current) => {
    if (Math.hypot(next.x, next.z) < 0.08) return;
    const relative = cameraRelativeMovement(next, cameraHeadingRef.current);
    input.current({ type: "move-vector", x: relative.x, z: relative.z, mode: mode.current });
  }, [cameraHeadingRef]);

  const reset = useCallback(() => {
    dragging.current = false;
    activePointerIdRef.current = null;
    vector.current = { x: 0, z: 0 };
    setKnob({ x: 0, y: 0 });
    setActive(false);
  }, []);

  useEffect(() => reset(), [cancelSignal, reset]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let nextEmission = performance.now() + 45;
    const tick = (now: number) => {
      const cadence = advanceMovementEmissionDeadline(nextEmission, now);
      nextEmission = cadence.nextAt;
      if (cadence.emit) emitMovement();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, emitMovement]);

  useEffect(() => {
    const stop = () => reset();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [reset]);

  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.42);
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const magnitude = Math.hypot(rawX, rawY);
    const scale = magnitude > radius ? radius / magnitude : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const next = { x: x / radius, z: y / radius };
    vector.current = next;
    setKnob({ x, y });
    return next;
  };

  const release = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    if (event && activePointerIdRef.current !== event.pointerId) return;
    if (event) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; resetting refs still stops movement.
      }
    }
    reset();
  };

  return (
    <button
      aria-label={`Movement trackpad. ${movementMode === "run" ? "Running" : "Walking"}. Hold and drag in any direction to travel.`}
      aria-pressed={active}
      className="wildz-dpad"
      onLostPointerCapture={release}
      onPointerCancel={release}
      onPointerDown={(event) => {
        if (activePointerIdRef.current !== null) return;
        activePointerIdRef.current = event.pointerId;
        dragging.current = true;
        const next = update(event);
        emitMovement(next);
        setActive(true);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
      }}
      onPointerMove={(event) => {
        if (!dragging.current || activePointerIdRef.current !== event.pointerId) return;
        update(event);
      }}
      onPointerUp={release}
      type="button"
    >
      <span className="wildz-dpad-ring" aria-hidden="true" />
      <Icons.chevronUp className="wildz-dpad-north" aria-hidden="true" size={18} />
      <Icons.chevronRight className="wildz-dpad-east" aria-hidden="true" size={18} />
      <Icons.chevronDown className="wildz-dpad-south" aria-hidden="true" size={18} />
      <Icons.chevronLeft className="wildz-dpad-west" aria-hidden="true" size={18} />
      <i className="wildz-dpad-knob" aria-hidden="true" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </button>
  );
}
