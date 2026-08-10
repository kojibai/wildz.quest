"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icons } from "@/components/icons";

export type WildsCommandKey = "commandCenter" | "mission" | "fieldGuide" | "satchel" | "deck" | "vault";

export type WildsCommandItem = {
  key: WildsCommandKey;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  status?: string;
  dockVisible?: boolean;
  content: ReactNode;
};

export function WildsCommandDock({ items, toolsOpen, panelKey, onToolsOpenChange, onPanelKeyChange, requestedKey = null, dismissSignal = 0, onRequestHandled = () => {} }: {
  items: readonly WildsCommandItem[];
  toolsOpen: boolean;
  panelKey: WildsCommandKey | null;
  onToolsOpenChange: (open: boolean) => void;
  onPanelKeyChange: (key: WildsCommandKey | null) => void;
  requestedKey?: WildsCommandKey | null;
  dismissSignal?: number;
  onRequestHandled?: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const originTriggerRef = useRef<HTMLElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const priorDismissSignal = useRef(dismissSignal);
  const priorActiveKey = useRef<WildsCommandKey | null>(panelKey);
  const activeKey = panelKey;
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const restoreOriginFocus = useCallback(() => {
    window.requestAnimationFrame(() => originTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!requestedKey) return;
    originTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : toolsTriggerRef.current;
    const requestedItem = items.find((item) => item.key === requestedKey);
    onToolsOpenChange(false);
    setDragY(0);
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
    setDragY(0);
    dragStart.current = null;
  }, [onPanelKeyChange]);

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
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove("wilds-command-open");
      document.body.classList.remove("wilds-command-open");
    };
  }, [activeKey, close]);

  const releaseDrag = (target: HTMLElement, pointerId: number) => {
    if (dragY > 72) close();
    else setDragY(0);
    dragStart.current = null;
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
  };

  return (
    <section className="wilds-command-system" aria-label="Wilds command center">
      <button
        aria-controls="wilds-world-tools-fan"
        aria-expanded={toolsOpen}
        aria-label="Open world tools"
        className="wilds-world-tools-trigger"
        onClick={() => {
          originTriggerRef.current = toolsTriggerRef.current;
          onToolsOpenChange(!toolsOpen);
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
                  onClick={() => {
                    originTriggerRef.current = toolsTriggerRef.current;
                    setDragY(0);
                    onToolsOpenChange(false);
                    onPanelKeyChange(item.key);
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

      {activeItem ? (
        <div className="wilds-command-overlay">
          <button className="wilds-command-backdrop" aria-label={`Close ${activeItem.label}`} onClick={close} type="button" />
          <section
            aria-labelledby={`wilds-command-title-${activeItem.key}`}
            aria-modal="true"
            className={`wilds-command-sheet wilds-command-sheet-${activeItem.key}`}
            id={`wilds-command-sheet-${activeItem.key}`}
            role="dialog"
            style={{ "--wilds-sheet-drag": `${dragY}px` } as CSSProperties}
          >
            <button
              aria-label={`Drag down to close ${activeItem.label}`}
              className="wilds-command-handle"
              onLostPointerCapture={() => {
                dragStart.current = null;
                setDragY(0);
              }}
              onPointerCancel={() => {
                dragStart.current = null;
                setDragY(0);
              }}
              onPointerDown={(event) => {
                dragStart.current = event.clientY;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragStart.current === null) return;
                setDragY(Math.max(0, event.clientY - dragStart.current));
              }}
              onPointerUp={(event) => releaseDrag(event.currentTarget, event.pointerId)}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
            <header className="wilds-command-sheet-header">
              <span className="wilds-command-sheet-icon" aria-hidden="true">{activeItem.icon}</span>
              <span><h3 id={`wilds-command-title-${activeItem.key}`}>{activeItem.label}</h3>{activeItem.status ? <small className="wilds-command-sheet-status">{activeItem.status}</small> : null}</span>
              <button aria-label={`Close ${activeItem.label}`} className="wilds-command-close" onClick={close} type="button">
                <Icons.close aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="wilds-command-sheet-content">{activeItem.content}</div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
