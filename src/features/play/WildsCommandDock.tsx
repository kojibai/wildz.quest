"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import type { WorldOverlayOwner } from "./world-overlay-state";
import { canRestoreFocus } from "./focus-recovery";

export type WildsCommandKey = "commandCenter" | "mission" | "fieldGuide" | "satchel" | "construction" | "deck" | "vault";

export type WildsCommandItem = {
  key: WildsCommandKey;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  status?: string;
  dockVisible?: boolean;
  content: ReactNode;
};

const WORLD_TOOLS_SWIPE_UP_PX = 44;
const WORLD_TOOLS_SWIPE_AXIS_RATIO = 1.15;
const COMMAND_BUTTON_SWIPE_UP_PX = 24;

export function isWildsWorldToolsSwipeUp(
  origin: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>
) {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return dy <= -WORLD_TOOLS_SWIPE_UP_PX && Math.abs(dy) >= Math.abs(dx) * WORLD_TOOLS_SWIPE_AXIS_RATIO;
}

export function isWildsWorldToolsSwipeDown(
  origin: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>
) {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return dy >= WORLD_TOOLS_SWIPE_UP_PX && Math.abs(dy) >= Math.abs(dx) * WORLD_TOOLS_SWIPE_AXIS_RATIO;
}

export function isWildsCommandButtonSwipeUp(
  origin: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>
) {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return dy <= -COMMAND_BUTTON_SWIPE_UP_PX && Math.abs(dy) >= Math.abs(dx) * WORLD_TOOLS_SWIPE_AXIS_RATIO;
}

export function WildsCommandDock({ items, toolsOpen, panelKey, onToolsOpenChange, onPanelKeyChange, requestedKey = null, dismissSignal = 0, exclusiveOwner, onRequestHandled = () => {} }: {
  items: readonly WildsCommandItem[];
  toolsOpen: boolean;
  panelKey: WildsCommandKey | null;
  onToolsOpenChange: (open: boolean) => void;
  onPanelKeyChange: (key: WildsCommandKey | null) => void;
  requestedKey?: WildsCommandKey | null;
  dismissSignal?: number;
  exclusiveOwner: WorldOverlayOwner;
  onRequestHandled?: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const originTriggerRef = useRef<HTMLElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const toolsGestureRef = useRef<Readonly<{ pointerId: number; x: number; y: number; committed: boolean }> | null>(null);
  const commandGestureRef = useRef<Readonly<{ key: WildsCommandKey; pointerId: number; x: number; y: number; committed: boolean }> | null>(null);
  const suppressToolsClickRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const priorDismissSignal = useRef(dismissSignal);
  const priorActiveKey = useRef<WildsCommandKey | null>(panelKey);
  const activeKey = panelKey;
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const openCommandItem = useCallback((key: WildsCommandKey) => {
    originTriggerRef.current = toolsTriggerRef.current;
    onToolsOpenChange(false);
    onPanelKeyChange(key);
  }, [onPanelKeyChange, onToolsOpenChange]);

  const commitCommandGesture = useCallback((key: WildsCommandKey, pointerId: number, x: number, y: number) => {
    const gesture = commandGestureRef.current;
    if (!gesture || gesture.key !== key || gesture.pointerId !== pointerId || gesture.committed) return false;
    if (!isWildsCommandButtonSwipeUp(gesture, { x, y })) return false;
    commandGestureRef.current = { ...gesture, committed: true };
    openCommandItem(key);
    return true;
  }, [openCommandItem]);

  const resetCommandGesture = useCallback((target?: HTMLButtonElement, pointerId?: number) => {
    commandGestureRef.current = null;
    if (target && pointerId !== undefined) {
      try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); } catch { /* capture is optional */ }
    }
  }, []);

  const resetToolsGesture = useCallback((target?: HTMLButtonElement, pointerId?: number) => {
    toolsGestureRef.current = null;
    if (target && pointerId !== undefined) {
      try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); } catch { /* capture is optional */ }
    }
  }, []);

  const commitToolsGesture = useCallback((pointerId: number, x: number, y: number) => {
    const gesture = toolsGestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId || gesture.committed) return false;
    const point = { x, y };
    const next = isWildsWorldToolsSwipeUp(gesture, point)
      ? true
      : isWildsWorldToolsSwipeDown(gesture, point)
        ? false
        : null;
    if (next === null || next === toolsOpen) return false;
    toolsGestureRef.current = { ...gesture, committed: true };
    suppressToolsClickRef.current = true;
    originTriggerRef.current = toolsTriggerRef.current;
    onToolsOpenChange(next);
    return true;
  }, [onToolsOpenChange, toolsOpen]);

  const restoreOriginFocus = useCallback(() => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      const origin = originTriggerRef.current;
      if (exclusiveOwner === "none" && canRestoreFocus(origin)) origin.focus();
    });
  }, [exclusiveOwner]);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
  }, []);

  useEffect(() => {
    if (!requestedKey) return;
    originTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : toolsTriggerRef.current;
    const requestedItem = items.find((item) => item.key === requestedKey);
    onToolsOpenChange(false);
    onRequestHandled();
    if (!requestedItem) {
      onPanelKeyChange(null);
      restoreOriginFocus();
      return;
    }
    onPanelKeyChange(requestedKey);
  }, [items, onPanelKeyChange, onRequestHandled, onToolsOpenChange, requestedKey, restoreOriginFocus]);

  const close = useCallback(() => {
    onPanelKeyChange(null);
    dragStartRef.current = null;
    dragDistanceRef.current = 0;
    setDragY(0);
  }, [onPanelKeyChange]);

  const resetDrag = () => {
    dragStartRef.current = null;
    dragDistanceRef.current = 0;
    setDragY(0);
  };

  const releaseDrag = (target: HTMLButtonElement, pointerId: number) => {
    const shouldClose = dragDistanceRef.current > 72;
    resetDrag();
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    if (shouldClose) close();
  };

  useEffect(() => {
    if (priorActiveKey.current && !activeKey) restoreOriginFocus();
    priorActiveKey.current = activeKey;
  }, [activeKey, restoreOriginFocus]);

  useEffect(() => {
    if (priorDismissSignal.current === dismissSignal) return;
    priorDismissSignal.current = dismissSignal;
    if (activeKey) close();
  }, [activeKey, close, dismissSignal]);

  useEffect(() => {
    if (!activeKey) return;
    const previousOverflow = document.body.style.overflow;
    document.documentElement.classList.add("wilds-command-open");
    document.body.classList.add("wilds-command-open");
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "Tab") {
        const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []);
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && (document.activeElement === first || !sheetRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sheetRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !sheetRef.current?.contains(event.target)) {
        sheetRef.current?.querySelector<HTMLElement>("[autofocus], button:not([disabled])")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", containFocus);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove("wilds-command-open");
      document.body.classList.remove("wilds-command-open");
    };
  }, [activeKey, close]);

  return (
    <section className="wilds-command-system" aria-label="Wilds command center">
      <button
        aria-controls="wilds-world-tools-fan"
        aria-expanded={toolsOpen}
        aria-hidden={activeItem ? true : undefined}
        aria-label="Open world tools"
        className="wilds-world-tools-trigger"
        disabled={Boolean(activeItem)}
        onClick={() => {
          if (suppressToolsClickRef.current) {
            suppressToolsClickRef.current = false;
            return;
          }
          originTriggerRef.current = toolsTriggerRef.current;
          onToolsOpenChange(!toolsOpen);
        }}
        onLostPointerCapture={(event) => {
          if (!toolsGestureRef.current) return;
          resetToolsGesture(event.currentTarget, event.pointerId);
          suppressToolsClickRef.current = false;
        }}
        onPointerCancel={(event) => {
          resetToolsGesture(event.currentTarget, event.pointerId);
          suppressToolsClickRef.current = false;
        }}
        onPointerDown={(event) => {
          if (toolsGestureRef.current) return;
          toolsGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, committed: false };
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
        }}
        onPointerMove={(event) => { commitToolsGesture(event.pointerId, event.clientX, event.clientY); }}
        onPointerUp={(event) => {
          commitToolsGesture(event.pointerId, event.clientX, event.clientY);
          resetToolsGesture(event.currentTarget, event.pointerId);
          if (suppressToolsClickRef.current) {
            window.setTimeout(() => { suppressToolsClickRef.current = false; }, 0);
          }
        }}
        ref={toolsTriggerRef}
        type="button"
      >
        <Icons.menu aria-hidden="true" size={20} />
      </button>

      {toolsOpen ? (
        <div className="wilds-world-tools-fan" id="wilds-world-tools-fan">
          <nav className="wilds-command-dock" aria-label="Game panels">
            {items.filter((item) => item.dockVisible !== false).map((item) => {
              const active = activeKey === item.key;
              const controls = `wilds-command-sheet-${item.key}`;
              return (
                <button
                  aria-controls={controls}
                  aria-expanded={active}
                  aria-label={`${item.label}${item.badge === undefined ? "" : ` · ${item.badge}`}`}
                  aria-pressed={active}
                  className="wilds-command-button"
                  key={item.key}
                  onClick={() => { openCommandItem(item.key); }}
                  onLostPointerCapture={(event) => {
                    if (commandGestureRef.current?.pointerId === event.pointerId) resetCommandGesture();
                  }}
                  onPointerCancel={(event) => { resetCommandGesture(event.currentTarget, event.pointerId); }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || commandGestureRef.current) return;
                    commandGestureRef.current = { key: item.key, pointerId: event.pointerId, x: event.clientX, y: event.clientY, committed: false };
                    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
                  }}
                  onPointerMove={(event) => { commitCommandGesture(item.key, event.pointerId, event.clientX, event.clientY); }}
                  onPointerUp={(event) => {
                    commitCommandGesture(item.key, event.pointerId, event.clientX, event.clientY);
                    resetCommandGesture(event.currentTarget, event.pointerId);
                  }}
                  title={item.label}
                  type="button"
                >
                  <span className="wilds-command-icon" aria-hidden="true">
                    {item.icon}
                    {item.badge === undefined ? null : <b className="wilds-command-badge">{item.badge}</b>}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}

      {activeItem && typeof document !== "undefined" ? createPortal((
        <div
          className="wilds-command-overlay"
          onPointerCancel={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <button tabIndex={-1} className="wilds-command-backdrop" aria-label={`Close ${activeItem.label}`} onClick={close} type="button" />
          <section
            aria-labelledby={`wilds-command-title-${activeItem.key}`}
            aria-modal="true"
            className={`wilds-command-sheet wilds-command-sheet-${activeItem.key}${dragY > 0 ? " is-dragging" : ""}`}
            id={`wilds-command-sheet-${activeItem.key}`}
            role="dialog"
            ref={sheetRef}
            style={{ "--wilds-sheet-drag": `${dragY}px` } as CSSProperties}
          >
            <div className="wilds-command-sheet-chrome">
              <button
                aria-label={`Drag down to close ${activeItem.label}`}
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
              <header className="wilds-command-sheet-header">
                <span className="wilds-command-sheet-icon" aria-hidden="true">{activeItem.icon}</span>
                <span><h3 id={`wilds-command-title-${activeItem.key}`}>{activeItem.label}</h3>{activeItem.status ? <small className="wilds-command-sheet-status">{activeItem.status}</small> : null}</span>
                <button autoFocus aria-label={`Close ${activeItem.label}`} className="wilds-command-close" onClick={close} type="button">
                  <Icons.close aria-hidden="true" size={18} />
                </button>
              </header>
            </div>
            <div className="wilds-command-sheet-content">{activeItem.content}</div>
          </section>
        </div>
      ), document.body) : null}
    </section>
  );
}
