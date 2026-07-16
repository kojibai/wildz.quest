"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type UIEvent } from "react";
import { Icons } from "@/components/icons";
import { sortWildzCards, type WildzCardSort } from "./card-sort";
import {
  creatureBookWindow,
  creatureDrawerMetrics,
  creatureDrawerMode,
  drawerHapticPattern,
  settleCreatureDrawer,
  type CreatureDrawerSnap
} from "./creature-drawer";
import { creatureForm } from "./creature-catalog";
import type { PlayState } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import { WildsVerifiedBadge } from "./WildsVerifiedBadge";

const RAIL_CARD_EXTENT = 184;

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

const CreatureChoice = memo(function CreatureChoice({
  asset,
  active,
  progress,
  logicalPosition,
  total,
  onSelect
}: {
  asset: PortableCardAsset;
  active: boolean;
  progress: { level: number; xp: number; bond: number };
  logicalPosition: number;
  total: number;
  onSelect: (assetId: string) => void;
}) {
  const form = creatureForm(asset.manifest.formId);
  return <article
    aria-posinset={logicalPosition}
    aria-setsize={total}
    data-wildz-card-id={asset.id}
    className="wildz-creature-choice-shell"
    role="listitem"
  >
    <button
      aria-label={`${asset.manifest.name}, creature ${logicalPosition} of ${total}${active ? ", active" : ""}`}
      aria-pressed={active}
      className="wildz-creature-choice"
      onClick={() => onSelect(asset.id)}
      type="button"
    >
      <WildsCreatureThumbnail asset={asset} />
      <span className="wildz-creature-choice-copy">
        <small>{progress.xp} XP · Lv. {progress.level}</small>
        <strong className="wilds-creature-name"><span>{asset.manifest.name}</span><WildsVerifiedBadge /></strong>
        <em>{form?.element ?? asset.manifest.species} · Bond {progress.bond}</em>
      </span>
      {active ? <b className="wildz-creature-choice-active">Active</b> : null}
    </button>
  </article>;
});

export const WildzCreatureDrawer = memo(function WildzCreatureDrawer({
  nearbyCards,
  activeCard,
  companionProgress,
  cardOrder,
  onCardOrderChange,
  onSelectCard
}: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  onSelectCard: (assetId: string) => void;
}) {
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === "undefined" ? 844 : window.innerHeight);
  const [snap, setSnap] = useState<CreatureDrawerSnap>("closed");
  const [showAffordanceSweep, setShowAffordanceSweep] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [range, setRange] = useState({ start: 0, end: 24 });
  const [bookPage, setBookPage] = useState(0);
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastAt: number; velocityY: number; moved: boolean } | null>(null);
  const suppressHandleClick = useRef(false);
  const metrics = useMemo(() => creatureDrawerMetrics(viewportHeight), [viewportHeight]);
  const height = dragHeight ?? metrics[snap];
  const mode = creatureDrawerMode(height, metrics);
  const sortedCards = useMemo(() => sortWildzCards(nearbyCards, cardOrder), [cardOrder, nearbyCards]);
  const bookWindow = useMemo(() => creatureBookWindow(sortedCards, bookPage, 1), [bookPage, sortedCards]);
  const activeForm = activeCard ? creatureForm(activeCard.manifest.formId) : null;
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const selectAndClose = useCallback((assetId: string) => {
    selectCard(assetId);
    setSnap("closed");
    setDragHeight(null);
  }, [selectCard]);

  useEffect(() => {
    const resize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const key = "wildz:drawer-affordance-seen:v1";
    if (window.localStorage.getItem(key)) return;
    setShowAffordanceSweep(true);
    window.localStorage.setItem(key, "seen");
    const timer = window.setTimeout(() => setShowAffordanceSweep(false), 1_450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setRange({ start: 0, end: 24 });
    setBookPage(0);
  }, [cardOrder]);

  useEffect(() => {
    if (snap === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSnap("closed");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [snap]);

  const commitSnap = useCallback((next: CreatureDrawerSnap) => {
    const pattern = drawerHapticPattern(snap, next);
    if (pattern.length && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
    setSnap(next);
  }, [snap]);

  const finishDrag = (target: HTMLElement, pointerId: number) => {
    const gesture = drag.current;
    drag.current = null;
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    if (!gesture) return;
    const next = settleCreatureDrawer(dragHeight ?? gesture.startHeight, gesture.velocityY, metrics);
    commitSnap(next);
    setDragHeight(null);
    suppressHandleClick.current = gesture.moved;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const now = performance.now();
    drag.current = {
      startY: event.clientY,
      startHeight: height,
      lastY: event.clientY,
      lastAt: now,
      velocityY: 0,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = drag.current;
    if (!gesture) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastAt);
    const nextHeight = Math.max(metrics.closed, Math.min(metrics.expanded, gesture.startHeight + gesture.startY - event.clientY));
    gesture.velocityY = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastAt = now;
    gesture.moved ||= Math.abs(event.clientY - gesture.startY) > 6;
    setDragHeight(nextHeight);
  };

  const updateVirtualRange = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (mode === "preview") {
      const start = Math.max(0, Math.floor(target.scrollLeft / RAIL_CARD_EXTENT) - 4);
      const count = Math.ceil(target.clientWidth / RAIL_CARD_EXTENT) + 10;
      setRange({ start, end: Math.min(sortedCards.length, start + count) });
      return;
    }
  };

  const renderChoice = (card: PortableCardAsset, logicalIndex: number) => {
    const progress = companionProgress[card.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
    return <CreatureChoice
      active={activeCard?.id === card.id}
      asset={card}
      key={card.id}
      logicalPosition={logicalIndex + 1}
      onSelect={selectAndClose}
      progress={progress}
      total={sortedCards.length}
    />;
  };

  const windowedCards = sortedCards.slice(range.start, range.end);
  const windowStyle = mode === "preview"
    ? { paddingInlineStart: `${range.start * RAIL_CARD_EXTENT}px`, paddingInlineEnd: `${Math.max(0, sortedCards.length - range.end) * RAIL_CARD_EXTENT}px` }
    : undefined;

  return <section
    aria-label="Active creature selector"
    className={`wildz-creature-drawer mode-${mode} ${mode === "closed" ? "is-closed" : ""}`}
    style={{
      "--wildz-drawer-height": `${height}px`,
      "--wildz-drawer-creature": activeForm?.palette.accent ?? "#78dda1"
    } as CSSProperties}
  >
    <button
      aria-controls="wildz-creature-drawer-content"
      aria-expanded={mode !== "closed"}
      aria-label={mode === "closed" ? `Preview creatures. Active: ${activeCard?.manifest.name ?? "none"}` : mode === "preview" ? "Expand creature selector" : "Close creature selector"}
      className={`wildz-creature-drawer-handle ${showAffordanceSweep ? "show-affordance-sweep" : ""}`}
      onClick={() => {
        if (suppressHandleClick.current) {
          suppressHandleClick.current = false;
          return;
        }
        commitSnap(snap === "closed" ? "preview" : snap === "preview" ? "expanded" : "closed");
      }}
      onLostPointerCapture={() => { drag.current = null; setDragHeight(null); }}
      onPointerCancel={() => { drag.current = null; setDragHeight(null); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDrag(event.currentTarget, event.pointerId)}
      type="button"
    >
      <span aria-hidden="true" className="wildz-creature-drawer-peek" />
      <span aria-hidden="true" className="wildz-creature-drawer-grip" />
      <span aria-hidden="true" className="wildz-creature-drawer-dots">
        {(["closed", "preview", "expanded"] as const).map((state) => <i className={mode === state ? "is-active" : ""} key={state} />)}
      </span>
      <Icons.chevronUp aria-hidden="true" size={14} />
      <span aria-hidden="true" className="wildz-creature-drawer-sweep" />
    </button>
    <div className="wildz-creature-drawer-content" id="wildz-creature-drawer-content">
      <div className="wildz-creature-drawer-tools">
        <span>{sortedCards.length} creature{sortedCards.length === 1 ? "" : "s"} · {mode}</span>
        <label><span>Sort</span><select aria-label="Sort creature selector" onChange={(event) => changeCardOrder(event.target.value as WildzCardSort)} value={cardOrder}>
          <option value="rarity">Rarity</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select></label>
      </div>
      {mode === "expanded" ? <div
        aria-label={`Creature book spread ${bookWindow.page + 1} of ${bookWindow.pageCount}`}
        className="wildz-creature-book"
        onScroll={(event) => {
          const width = Math.max(1, event.currentTarget.clientWidth);
          setBookPage(Math.max(0, Math.min(bookWindow.pageCount - 1, Math.round(event.currentTarget.scrollLeft / width))));
        }}
        role="region"
      >
        {Array.from({ length: bookWindow.pageCount }, (_, page) => {
          const withinWindow = page >= bookWindow.windowStartPage && page < bookWindow.windowEndPage;
          const start = page * bookWindow.pageSize;
          return <div className="wildz-creature-spread" key={page} role="list">
            {withinWindow ? sortedCards.slice(start, start + bookWindow.pageSize).map((card, index) => renderChoice(card, start + index)) : null}
          </div>;
        })}
      </div> : <div
        aria-label="Scroll creatures horizontally"
        className="wildz-creature-window"
        onScroll={updateVirtualRange}
        role="list"
        style={windowStyle}
      >
        {windowedCards.map((card, index) => renderChoice(card, range.start + index))}
        {!sortedCards.length ? <p className="wildz-card-rail-empty">No sealed companions yet. Open Vault to restore one.</p> : null}
      </div>}
    </div>
  </section>;
});
