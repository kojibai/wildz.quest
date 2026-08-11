"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function WildsPopoverSurface({ ariaLabel, children, className = "", header, id, onClose, portalTarget = null }: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  header: ReactNode;
  id?: string;
  onClose: () => void;
  portalTarget?: Element | null;
}) {
  const [dragY, setDragY] = useState(0);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const dragStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  closeRef.current = onClose;

  useEffect(() => {
    originRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = surfaceRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => surface?.querySelector<HTMLElement>("[autofocus], button:not([disabled])")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (!surface) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(surface.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !surface.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const origin = originRef.current;
      window.requestAnimationFrame(() => { if (origin?.isConnected) origin.focus(); });
    };
  }, []);

  if (typeof document === "undefined") return null;
  const stopPointerPropagation = (event: ReactPointerEvent) => event.stopPropagation();
  const resetDrag = () => {
    dragStartRef.current = null;
    dragDistanceRef.current = 0;
    setDragY(0);
  };
  const releaseDrag = (target: HTMLButtonElement, pointerId: number) => {
    const shouldClose = dragDistanceRef.current > 72;
    resetDrag();
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    if (shouldClose) closeRef.current();
  };
  return createPortal(
    <div
      className={`wilds-popover-layer${portalTarget ? " is-contained" : ""}`}
      onPointerCancel={stopPointerPropagation}
      onPointerDown={stopPointerPropagation}
      onPointerMove={stopPointerPropagation}
      onPointerUp={stopPointerPropagation}
    >
      <button aria-label={`Close ${ariaLabel}`} className="wilds-popover-backdrop" onClick={onClose} tabIndex={-1} type="button" />
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        className={`wilds-popover-surface ${className}${dragY > 0 ? " is-dragging" : ""}`.trim()}
        id={id}
        ref={surfaceRef}
        role="dialog"
        style={{ "--wilds-sheet-drag": `${dragY}px` } as CSSProperties}
      >
        <div className="wilds-popover-chrome">
          <button
            aria-label={`Drag down to close ${ariaLabel}`}
            className="wilds-command-handle"
            onLostPointerCapture={resetDrag}
            onPointerCancel={resetDrag}
            onPointerDown={(event) => {
              dragStartRef.current = event.clientY;
              dragDistanceRef.current = 0;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (dragStartRef.current === null) return;
              const distance = Math.max(0, event.clientY - dragStartRef.current);
              dragDistanceRef.current = distance;
              setDragY(distance);
            }}
            onPointerUp={(event) => releaseDrag(event.currentTarget, event.pointerId)}
            type="button"
          >
            <span aria-hidden="true" />
          </button>
          {header}
        </div>
        <div className="wilds-popover-scroll">{children}</div>
      </section>
    </div>,
    portalTarget ?? document.body
  );
}
