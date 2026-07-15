"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icons } from "@/components/icons";

export type WildsCommandKey = "mission" | "rewards" | "deck" | "vault";

export type WildsCommandItem = {
  key: WildsCommandKey;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  content: ReactNode;
};

export function WildsCommandDock({ items }: { items: readonly WildsCommandItem[] }) {
  const [activeKey, setActiveKey] = useState<WildsCommandKey | null>(null);
  const [dragY, setDragY] = useState(0);
  const triggerRefs = useRef<Partial<Record<WildsCommandKey, HTMLButtonElement | null>>>({});
  const dragStart = useRef<number | null>(null);
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const close = useCallback(() => {
    const trigger = activeKey ? triggerRefs.current[activeKey] : null;
    setActiveKey(null);
    setDragY(0);
    dragStart.current = null;
    window.requestAnimationFrame(() => trigger?.focus());
  }, [activeKey]);

  useEffect(() => {
    if (!activeKey) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
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
      <nav className="wilds-command-dock" aria-label="Game panels">
        {items.map((item) => {
          const active = activeKey === item.key;
          const controls = `wilds-command-sheet-${item.key}`;
          return (
            <button
              ref={(node) => { triggerRefs.current[item.key] = node; }}
              aria-controls={controls}
              aria-expanded={active}
              aria-label={`${item.label}${item.badge === undefined ? "" : ` · ${item.badge}`}`}
              aria-pressed={active}
              className="wilds-command-button"
              key={item.key}
              onClick={() => {
                setDragY(0);
                setActiveKey(active ? null : item.key);
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

      {activeItem ? (
        <div className="wilds-command-overlay">
          <button className="wilds-command-backdrop" aria-label={`Close ${activeItem.label}`} onClick={close} type="button" />
          <section
            aria-labelledby={`wilds-command-title-${activeItem.key}`}
            aria-modal="true"
            className="wilds-command-sheet"
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
              <h3 id={`wilds-command-title-${activeItem.key}`}>{activeItem.label}</h3>
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
