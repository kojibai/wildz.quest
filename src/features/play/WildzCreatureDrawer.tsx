"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type UIEvent } from "react";
import { Icons } from "@/components/icons";
import { sortWildzCards, type WildzCardSort } from "./card-sort";
import {
  creatureBookWindow,
  creatureDrawerMetrics,
  creatureRailOffsetForIndex,
  creatureRailRenderWindow,
  creatureRailSlots,
  drawerHapticPattern,
  settleCreatureDrawer,
  type CreatureDrawerSnap
} from "./creature-drawer";
import { creatureForm } from "./creature-catalog";
import type { VaultCompanionRosterEntry } from "./vault-companion-roster";
import { WildsVerifiedBadge } from "./WildsVerifiedBadge";
import { playHapticPattern } from "./wilds-haptics";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";

const RAIL_CARD_WIDTH = 184;
const RAIL_CARD_GAP = 8;
const RAIL_END_GUTTER = 40;

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

const CreatureChoice = memo(function CreatureChoice({
  entry,
  selectAndClose,
  buttonRef
}: {
  entry: VaultCompanionRosterEntry;
  selectAndClose: (assetId: string) => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}) {
  return <button
      aria-label={`${entry.name}, level ${entry.level}, ${entry.xp} XP, bond ${entry.bond}, ${entry.conditionLabel}${entry.active ? ", active" : ""}${entry.newlyCaptured ? ", new" : ""}`}
      aria-pressed={entry.active}
      className="wildz-creature-choice"
      onClick={() => selectAndClose(entry.asset.id)}
      ref={buttonRef}
      type="button"
    >
      <WildsCreatureThumbnail asset={entry.asset} className="wildz-slate-creature-art" />
      <span className="wildz-creature-choice-copy">
        <span className="wildz-creature-choice-kicker"><b>Lv. {entry.level}</b><i>{entry.xp} XP</i></span>
        <strong className="wilds-creature-name"><span>{entry.name}</span><WildsVerifiedBadge /></strong>
        <span aria-valuemax={100} aria-valuemin={0} aria-valuenow={entry.xp % 100} className="wildz-creature-xp-meter" role="progressbar"><i style={{ width: `${entry.xp % 100}%` }} /></span>
        <em>{entry.element} · {entry.species}</em>
        <span className="wildz-creature-stat-row"><b>Bond {entry.bond}</b><b>{entry.conditionLabel}</b></span>
      </span>
      {entry.newlyCaptured ? <span className="wildz-creature-new">New</span> : null}
      {entry.active ? <span className="wildz-creature-choice-active">Active</span> : null}
    </button>;
});

export const WildzCreatureDrawer = memo(function WildzCreatureDrawer({
  entries,
  cardOrder,
  onCardOrderChange,
  onSelectCard,
  snap,
  onSnapChange
}: {
  entries: readonly VaultCompanionRosterEntry[];
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  onSelectCard: (assetId: string) => void;
  snap: CreatureDrawerSnap;
  onSnapChange: (snap: CreatureDrawerSnap) => void;
}) {
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === "undefined" ? 844 : window.innerHeight);
  const [showAffordanceSweep, setShowAffordanceSweep] = useState(false);
  const [range, setRange] = useState({ start: 0, end: 8 });
  const [bookPage, setBookPage] = useState(0);
  const drawerRef = useRef<HTMLElement>(null);
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const entryFocusFrameRef = useRef<number | null>(null);
  const pendingFocusAssetIdRef = useRef<string | null>(null);
  const previousSnapRef = useRef<CreatureDrawerSnap>(snap);
  const railRef = useRef<HTMLDivElement>(null);
  const railFrameRef = useRef<number | null>(null);
  const dragHeight = useRef<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastAt: number; velocityY: number; moved: boolean } | null>(null);
  const suppressHandleClick = useRef(false);
  const metrics = useMemo(() => creatureDrawerMetrics(viewportHeight), [viewportHeight]);
  const height = metrics[snap];
  const mode = snap;
  const entriesByAssetId = useMemo(() => new Map(entries.map((entry) => [entry.asset.id, entry])), [entries]);
  const sortedEntries = useMemo(() => sortWildzCards(entries.map((entry) => entry.asset), cardOrder)
    .flatMap((asset) => {
      const entry = entriesByAssetId.get(asset.id);
      return entry ? [entry] : [];
    }), [cardOrder, entries, entriesByAssetId]);
  const bookWindow = useMemo(() => creatureBookWindow(sortedEntries, bookPage, 1), [bookPage, sortedEntries]);
  const activeEntry = entries.find((entry) => entry.active) ?? null;
  const activeIndex = sortedEntries.findIndex((entry) => entry.active);
  const activeWindowRange = useMemo(() => {
    const targetIndex = activeIndex >= 0 ? activeIndex : 0;
    const start = Math.max(0, targetIndex - 4);
    return { start, end: Math.min(sortedEntries.length, start + 12) };
  }, [activeIndex, sortedEntries.length]);
  const activeForm = activeEntry ? creatureForm(activeEntry.asset.manifest.formId) : null;
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const selectAndClose = useCallback((assetId: string) => {
    playHapticPattern([9]);
    selectCard(assetId);
    onSnapChange("closed");
  }, [onSnapChange, selectCard]);

  const registerEntryButton = useCallback((assetId: string, element: HTMLButtonElement | null) => {
    if (element) entryButtonRefs.current.set(assetId, element);
    else entryButtonRefs.current.delete(assetId);
  }, []);

  useEffect(() => {
    const closeForViewportChange = () => {
      setViewportHeight(window.innerHeight);
      if (snap !== "closed") onSnapChange("closed");
    };
    window.addEventListener("resize", closeForViewportChange, { passive: true });
    window.addEventListener("orientationchange", closeForViewportChange);
    return () => {
      window.removeEventListener("resize", closeForViewportChange);
      window.removeEventListener("orientationchange", closeForViewportChange);
    };
  }, [onSnapChange, snap]);

  useEffect(() => {
    if (snap === "closed") return;
    const key = "wildz:drawer-affordance-seen:v1";
    if (window.localStorage.getItem(key)) return;
    setShowAffordanceSweep(true);
    window.localStorage.setItem(key, "seen");
    const timer = window.setTimeout(() => setShowAffordanceSweep(false), 1_450);
    return () => window.clearTimeout(timer);
  }, [snap]);

  useEffect(() => {
    setRange({ start: 0, end: 8 });
    setBookPage(0);
  }, [cardOrder]);

  useEffect(() => () => {
    if (railFrameRef.current !== null) window.cancelAnimationFrame(railFrameRef.current);
    if (entryFocusFrameRef.current !== null) window.cancelAnimationFrame(entryFocusFrameRef.current);
  }, []);

  useEffect(() => {
    const opened = previousSnapRef.current === "closed" && snap !== "closed";
    previousSnapRef.current = snap;
    if (!opened) return;
    const target = activeEntry ?? sortedEntries[0];
    pendingFocusAssetIdRef.current = target?.asset.id ?? null;
    setRange(activeWindowRange);
    if (activeIndex >= 0) setBookPage(Math.floor(activeIndex / bookWindow.pageSize));
  }, [activeEntry, activeIndex, activeWindowRange, bookWindow.pageSize, snap, sortedEntries]);

  useEffect(() => {
    const assetId = pendingFocusAssetIdRef.current;
    if (!assetId || snap === "closed") return;
    entryFocusFrameRef.current = window.requestAnimationFrame(() => {
      entryFocusFrameRef.current = null;
      const target = entryButtonRefs.current.get(assetId);
      if (!target) return;
      if (snap === "preview" && activeIndex >= 0 && railRef.current) {
        railRef.current.scrollLeft = creatureRailOffsetForIndex(activeIndex, RAIL_CARD_WIDTH, RAIL_CARD_GAP);
      }
      target.focus({ preventScroll: true });
      pendingFocusAssetIdRef.current = null;
    });
    return () => {
      if (entryFocusFrameRef.current !== null) window.cancelAnimationFrame(entryFocusFrameRef.current);
      entryFocusFrameRef.current = null;
    };
  }, [activeIndex, bookPage, range, snap, sortedEntries]);

  useEffect(() => {
    if (snap === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onSnapChange("closed");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      if (entryFocusFrameRef.current !== null) window.cancelAnimationFrame(entryFocusFrameRef.current);
      entryFocusFrameRef.current = null;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onSnapChange, snap]);

  useEffect(() => {
    if (snap !== "expanded") return;
    const focusables = () => Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) ?? []);
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !drawerRef.current?.contains(event.target)) focusables()[0]?.focus();
    };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      window.removeEventListener("keydown", trapFocus);
    };
  }, [snap]);

  const commitSnap = useCallback((next: CreatureDrawerSnap) => {
    const pattern = drawerHapticPattern(snap, next);
    if (pattern.length) playHapticPattern(pattern);
    onSnapChange(next);
  }, [onSnapChange, snap]);

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

  const cancelAndClose = () => {
    cancelDrag();
    if (snap !== "closed") onSnapChange("closed");
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
        const next = creatureRailRenderWindow(sortedEntries.length, target.scrollLeft, target.clientWidth, RAIL_CARD_WIDTH, RAIL_CARD_GAP);
        setRange((previous) => previous.start === next.start && previous.end === next.end ? previous : next);
      });
    }
  };

  const renderChoice = (entry: VaultCompanionRosterEntry) => <CreatureChoice
    buttonRef={(element) => registerEntryButton(entry.asset.id, element)}
    entry={entry}
    selectAndClose={selectAndClose}
  />;

  const renderChoiceShell = (entry: VaultCompanionRosterEntry, logicalIndex: number, renderContent = true) => <article
    aria-hidden={renderContent ? undefined : true}
    aria-posinset={logicalIndex + 1}
    aria-setsize={sortedEntries.length}
    className="wildz-creature-choice-shell"
    data-wildz-card-id={entry.asset.id}
    key={entry.asset.id}
    role="listitem"
  >
    {renderContent ? renderChoice(entry) : null}
  </article>;

  const railSlots = creatureRailSlots(sortedEntries, range.start, range.end, activeIndex);

  return <section
    aria-label="Active creature selector"
    className={`wildz-creature-drawer mode-${mode} ${mode === "closed" ? "is-closed" : ""}`}
    ref={drawerRef}
    style={{
      "--wildz-drawer-height": `${height}px`,
      "--wildz-drawer-creature": activeForm?.palette.accent ?? "#78dda1"
    } as CSSProperties}
  >
    {mode !== "closed" ? <button
      aria-controls="wildz-creature-drawer-content"
      aria-expanded={true}
      aria-label={mode === "preview" ? "Expand creature selector" : "Close creature selector"}
      className={`wildz-creature-drawer-handle ${showAffordanceSweep ? "show-affordance-sweep" : ""}`}
      onClick={() => {
        if (suppressHandleClick.current) {
          suppressHandleClick.current = false;
          return;
        }
        commitSnap(snap === "preview" ? "expanded" : "closed");
      }}
      onLostPointerCapture={cancelDrag}
      onPointerCancel={cancelAndClose}
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
    </button> : null}
    <div aria-hidden={mode === "closed"} className="wildz-creature-drawer-content" id="wildz-creature-drawer-content" inert={mode === "closed" ? true : undefined}>
      <div className="wildz-creature-drawer-tools">
        <span>{sortedEntries.length} companion{sortedEntries.length === 1 ? "" : "s"} · {mode}</span>
        <label><span>Sort</span><select aria-label="Sort creature selector" onChange={(event) => changeCardOrder(event.target.value as WildzCardSort)} value={cardOrder}>
          <option value="rarity">Rarity</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select></label>
      </div>
      {mode === "expanded" ? <div
        aria-label={`Creature roster page ${bookWindow.page + 1} of ${bookWindow.pageCount}`}
        className="wildz-creature-book"
        onScroll={(event) => {
          const height = Math.max(1, event.currentTarget.clientHeight);
          setBookPage(Math.max(0, Math.min(bookWindow.pageCount - 1, Math.round(event.currentTarget.scrollTop / height))));
        }}
        role="region"
      >
        {Array.from({ length: bookWindow.pageCount }, (_, page) => {
          const withinWindow = page >= bookWindow.windowStartPage && page < bookWindow.windowEndPage;
          const start = page * bookWindow.pageSize;
          return <div className="wildz-creature-spread" key={page} role="list">
            {withinWindow ? sortedEntries.slice(start, start + bookWindow.pageSize).map((entry, index) => renderChoiceShell(entry, start + index)) : null}
          </div>;
        })}
      </div> : <div
        aria-label="Scroll companions horizontally"
        className="wildz-creature-window"
        onScroll={updateVirtualRange}
        ref={railRef}
        role="list"
      >
        {railSlots.map((slot) => renderChoiceShell(slot.item, slot.index, slot.renderContent))}
        {sortedEntries.length ? <span aria-hidden="true" className="wildz-creature-window-end" style={{ flexBasis: RAIL_END_GUTTER }} /> : null}
        {!sortedEntries.length ? <p className="wildz-card-rail-empty">No living companions in the Vault yet.</p> : null}
      </div>}
    </div>
  </section>;
});
