"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  const surfaceRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
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
  return createPortal(
    <div
      className={`wilds-popover-layer${portalTarget ? " is-contained" : ""}`}
      onPointerCancel={stopPointerPropagation}
      onPointerDown={stopPointerPropagation}
      onPointerMove={stopPointerPropagation}
      onPointerUp={stopPointerPropagation}
    >
      <button aria-label={`Close ${ariaLabel}`} className="wilds-popover-backdrop" onClick={onClose} tabIndex={-1} type="button" />
      <section aria-label={ariaLabel} aria-modal="true" className={`wilds-popover-surface ${className}`.trim()} id={id} ref={surfaceRef} role="dialog">
        <div className="wilds-popover-chrome">{header}</div>
        <div className="wilds-popover-scroll">{children}</div>
      </section>
    </div>,
    portalTarget ?? document.body
  );
}
