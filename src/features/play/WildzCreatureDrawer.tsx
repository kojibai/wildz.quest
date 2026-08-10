"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type UIEvent } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { sortWildzCards, type WildzCardSort } from "./card-sort";
import {
  creatureBookWindow,
  creatureDrawerMetrics,
  creatureRailVirtualPadding,
  drawerHapticPattern,
  settleCreatureDrawer,
  type CreatureDrawerSnap
} from "./creature-drawer";
import { creatureForm } from "./creature-catalog";
import type { PlayState } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import { WildsVerifiedBadge } from "./WildsVerifiedBadge";
import { currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { WildsCardScene } from "./WildsCardScene";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import type { AdventureCardCondition } from "./adventure/card-condition";

const RAIL_CARD_EXTENT = 184;
const RAIL_END_GUTTER = 40;

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
  onSelect,
  retired
  , condition
}: {
  asset: PortableCardAsset;
  active: boolean;
  progress: { level: number; xp: number; bond: number };
  logicalPosition: number;
  total: number;
  onSelect: (assetId: string) => void;
  retired: boolean;
  condition?: AdventureCardCondition;
}) {
  const form = creatureForm(asset.manifest.formId);
  const [inspecting, setInspecting] = useState(false);
  return <article
    aria-posinset={logicalPosition}
    aria-setsize={total}
    data-wildz-card-id={asset.id}
    className="wildz-creature-choice-shell"
    role="listitem"
  >
    <button
      aria-label={`${asset.manifest.name}, creature ${logicalPosition} of ${total}${retired ? ", retired memorial" : active ? ", active" : ""}`}
      aria-pressed={active}
      className={`wildz-creature-choice${retired ? " is-retired" : ""}`}
      onClick={() => retired ? setInspecting(true) : onSelect(asset.id)}
      type="button"
    >
      <WildsCreatureThumbnail asset={asset} className="wildz-slate-creature-art" />
      <span className="wildz-creature-choice-copy">
        <small>{progress.xp} XP · Lv. {progress.level}</small>
        <strong className="wilds-creature-name"><span>{asset.manifest.name}</span><WildsVerifiedBadge /></strong>
        <em>{form?.element ?? asset.manifest.species} · Bond {progress.bond}</em>
      </span>
      {retired ? <b className="wildz-creature-choice-active">Retired</b> : active ? <b className="wildz-creature-choice-active">Active</b> : null}
    </button>
    {inspecting && typeof document !== "undefined" ? createPortal(<div aria-label={`${asset.manifest.name} memorial card`} aria-modal="true" className="wildz-memorial-card-viewer" role="dialog">
      <button aria-label="Close memorial card" className="wildz-memorial-card-close" onClick={() => setInspecting(false)} type="button">×</button>
      <WildsCardScene asset={asset} condition={condition} origin={window.location.origin} qr="" />
      <p>Swipe the card to read its permanent death record.</p>
    </div>, document.body) : null}
  </article>;
});

export const WildzCreatureDrawer = memo(function WildzCreatureDrawer({
  nearbyCards,
  activeCard,
  companionProgress,
  cardConditions,
  cardOrder,
  onCardOrderChange,
  onSelectCard,
  snap,
  onSnapChange,
  requestedSnap = null,
  onRequestedSnapHandled = () => {}
}: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  cardConditions: PlayState["adventureConditions"];
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  onSelectCard: (assetId: string) => void;
  snap: CreatureDrawerSnap;
  onSnapChange: (snap: CreatureDrawerSnap) => void;
  requestedSnap?: CreatureDrawerSnap | null;
  onRequestedSnapHandled?: () => void;
}) {
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === "undefined" ? 844 : window.innerHeight);
  const [showAffordanceSweep, setShowAffordanceSweep] = useState(false);
  const [range, setRange] = useState({ start: 0, end: 8 });
  const [bookPage, setBookPage] = useState(0);
  const drawerRef = useRef<HTMLElement>(null);
  const railFrameRef = useRef<number | null>(null);
  const dragHeight = useRef<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastAt: number; velocityY: number; moved: boolean } | null>(null);
  const suppressHandleClick = useRef(false);
  const metrics = useMemo(() => creatureDrawerMetrics(viewportHeight), [viewportHeight]);
  const height = metrics[snap];
  const mode = snap;
  const sortedCards = useMemo(() => sortWildzCards(nearbyCards, cardOrder), [cardOrder, nearbyCards]);
  const bookWindow = useMemo(() => creatureBookWindow(sortedCards, bookPage, 1), [bookPage, sortedCards]);
  const activeForm = activeCard ? creatureForm(activeCard.manifest.formId) : null;
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const selectAndClose = useCallback((assetId: string) => {
    selectCard(assetId);
    onSnapChange("closed");
  }, [onSnapChange, selectCard]);

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
    setRange({ start: 0, end: 8 });
    setBookPage(0);
  }, [cardOrder]);

  useEffect(() => () => {
    if (railFrameRef.current !== null) window.cancelAnimationFrame(railFrameRef.current);
  }, []);

  useEffect(() => {
    if (snap === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSnapChange("closed");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onSnapChange, snap]);

  const commitSnap = useCallback((next: CreatureDrawerSnap) => {
    const pattern = drawerHapticPattern(snap, next);
    if (pattern.length && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
    onSnapChange(next);
  }, [onSnapChange, snap]);

  useEffect(() => {
    if (!requestedSnap) return;
    commitSnap(requestedSnap);
    onRequestedSnapHandled();
  }, [commitSnap, onRequestedSnapHandled, requestedSnap]);

  const finishDrag = (target: HTMLElement, pointerId: number) => {
    const gesture = drag.current;
    drag.current = null;
    drawerRef.current?.classList.remove("is-dragging");
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    if (!gesture) return;
    const next = settleCreatureDrawer(dragHeight.current ?? gesture.startHeight, gesture.velocityY, metrics);
    dragHeight.current = null;
    drawerRef.current?.style.setProperty("--wildz-drawer-height", `${metrics[next]}px`);
    commitSnap(next);
    suppressHandleClick.current = gesture.moved;
  };

  const cancelDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    dragHeight.current = null;
    drawerRef.current?.classList.remove("is-dragging");
    drawerRef.current?.style.setProperty("--wildz-drawer-height", `${metrics[snap]}px`);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const now = performance.now();
    drag.current = {
      startY: event.clientY,
      startHeight: metrics[snap],
      lastY: event.clientY,
      lastAt: now,
      velocityY: 0,
      moved: false
    };
    dragHeight.current = metrics[snap];
    drawerRef.current?.classList.add("is-dragging");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
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
    dragHeight.current = nextHeight;
    drawerRef.current?.style.setProperty("--wildz-drawer-height", `${nextHeight}px`);
  };

  const updateVirtualRange = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (mode === "preview" && railFrameRef.current === null) {
      railFrameRef.current = window.requestAnimationFrame(() => {
        railFrameRef.current = null;
        if (!target.isConnected) return;
        const start = Math.max(0, Math.floor(target.scrollLeft / RAIL_CARD_EXTENT) - 4);
        const count = Math.ceil(target.clientWidth / RAIL_CARD_EXTENT) + 10;
        const end = Math.min(sortedCards.length, start + count);
        setRange((previous) => previous.start === start && previous.end === end ? previous : { start, end });
      });
    }
  };

  const renderChoice = (card: PortableCardAsset, logicalIndex: number) => {
    const progress = companionProgress[card.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
    const condition = cardConditions[card.id];
    const retired = condition?.life === "dead" || (isLivingCardAsset(card) && Boolean(currentRevision(card).growth.life?.retired));
    return <CreatureChoice
      active={activeCard?.id === card.id}
      asset={card}
      key={card.id}
      logicalPosition={logicalIndex + 1}
      onSelect={selectAndClose}
      progress={progress}
      retired={retired}
      condition={condition}
      total={sortedCards.length}
    />;
  };

  const windowedCards = sortedCards.slice(range.start, range.end);
  const windowStyle = mode !== "expanded"
    ? creatureRailVirtualPadding(sortedCards.length, range.start, range.end, RAIL_CARD_EXTENT, 0)
    : undefined;

  return <section
    aria-label="Active creature selector"
    className={`wildz-creature-drawer mode-${mode} ${mode === "closed" ? "is-closed" : ""}`}
    ref={drawerRef}
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
      onLostPointerCapture={cancelDrag}
      onPointerCancel={cancelDrag}
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
    <div aria-hidden={mode === "closed"} className="wildz-creature-drawer-content" id="wildz-creature-drawer-content" inert={mode === "closed" ? true : undefined}>
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
        {sortedCards.length ? <span aria-hidden="true" className="wildz-creature-window-end" style={{ flexBasis: RAIL_END_GUTTER }} /> : null}
        {!sortedCards.length ? <p className="wildz-card-rail-empty">No sealed companions yet. Open Vault to restore one.</p> : null}
      </div>}
    </div>
  </section>;
});
