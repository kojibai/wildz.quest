"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Icons } from "@/components/icons";
import {
  advanceCompanionGesture,
  cancelCompanionGesture,
  companionCommandKeyResult,
  COMPANION_HOLD_MS,
  createCompanionGesture,
  moveCompanionGesture,
  releaseCompanionGesture,
  type CompanionGestureResult,
  type CompanionGestureState
} from "./companion-command-gesture";
import { companionCarousel, cycleVaultCompanion } from "./companion-command-model";
import { playWildsHaptic } from "./wilds-haptics";
import type { WildsAudioCue } from "./wilds-audio";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import type { VaultCompanionRosterEntry } from "./vault-companion-roster";
import { canRestoreFocus } from "./focus-recovery";

export function WildsCompanionCommand({
  entries,
  activeEntry,
  onSelectCard,
  onRequestDrawer,
  onTrainCharacter,
  onRecoverCharacter,
  onViewInVault,
  onCommandButtonReady,
  onAudioCue,
  cancelSignal = 0
}: {
  entries: readonly VaultCompanionRosterEntry[];
  activeEntry: VaultCompanionRosterEntry | null;
  onSelectCard: (assetId: string) => void;
  onRequestDrawer: (snap: "preview" | "expanded") => void;
  onTrainCharacter: (familyId: string) => void;
  onRecoverCharacter: () => void;
  onViewInVault: () => void;
  onCommandButtonReady?: (button: HTMLButtonElement | null) => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
  cancelSignal?: number;
}) {
  const gestureRef = useRef<CompanionGestureState | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerCaptureTargetRef = useRef<HTMLButtonElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const commandButtonRef = useRef<HTMLButtonElement | null>(null);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<CompanionGestureState["mode"]>("pending");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const projection = useMemo(
    () => companionCarousel(entries.map((entry) => ({ id: entry.asset.id })), activeEntry?.asset.id ?? null),
    [activeEntry?.asset.id, entries]
  );
  const clearHold = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const renderGesture = (gesture: CompanionGestureState) => {
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      setMode(gesture.mode);
    });
  };

  const releaseActivePointerCapture = () => {
    const pointerId = activePointerIdRef.current;
    const target = pointerCaptureTargetRef.current;
    if (pointerId !== null && target) {
      try {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      } catch { /* capture is optional */ }
    }
    activePointerIdRef.current = null;
    pointerCaptureTargetRef.current = null;
  };

  useEffect(() => () => {
    clearHold();
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
  }, []);

  const cycle = (direction: -1 | 1) => {
    const assetId = cycleVaultCompanion(entries.map((entry) => entry.asset.id), activeEntry?.asset.id ?? null, direction);
    if (!assetId || assetId === activeEntry?.asset.id) return;
    playWildsHaptic("cycle");
    onAudioCue?.("companion-detent");
    onSelectCard(assetId);
  };

  const consume = (result: CompanionGestureResult) => {
    if (result.kind === "open-quick-actions") {
      playWildsHaptic("drawer-open");
      setQuickActionsOpen(true);
    } else if (result.kind === "open-drawer-expanded") {
      playWildsHaptic("drawer-open");
      onRequestDrawer("expanded");
    } else if (result.kind === "cycle-next") {
      cycle(1);
    } else if (result.kind === "cycle-previous") {
      cycle(-1);
    } else if (result.kind === "cancel") {
      playWildsHaptic("cancel");
    }
    setMode("pending");
  };

  const pointerPoint = (event: ReactPointerEvent<HTMLButtonElement>) => ({ x: event.clientX, y: event.clientY });

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!activeEntry || activePointerIdRef.current !== null) return;
    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    pointerCaptureTargetRef.current = event.currentTarget;
    const gesture = createCompanionGesture(pointerPoint(event), performance.now());
    gestureRef.current = gesture;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ }
    setMode("pending");
    clearHold();
    holdTimerRef.current = window.setTimeout(() => {
      if (!gestureRef.current) return;
      const advanced = advanceCompanionGesture(gestureRef.current, performance.now());
      gestureRef.current = advanced;
      renderGesture(advanced);
    }, COMPANION_HOLD_MS);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!gestureRef.current || activePointerIdRef.current !== event.pointerId) return;
    const moved = moveCompanionGesture(gestureRef.current, pointerPoint(event), performance.now());
    gestureRef.current = moved;
    if (moved.mode !== "pending") clearHold();
    renderGesture(moved);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const gesture = gestureRef.current;
    if (!gesture) return;
    clearHold();
    gestureRef.current = null;
    releaseActivePointerCapture();
    consume(releaseCompanionGesture(gesture, pointerPoint(event), performance.now()));
  };

  const cancelPointer = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    if (event && activePointerIdRef.current !== event.pointerId) return;
    if (!gestureRef.current) return;
    clearHold();
    const gesture = gestureRef.current;
    gestureRef.current = null;
    releaseActivePointerCapture();
    consume(cancelCompanionGesture(gesture));
  };

  const cancelAllInteractions = () => {
    clearHold();
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = null;
    gestureRef.current = null;
    releaseActivePointerCapture();
    setQuickActionsOpen(false);
    setMode("pending");
  };
  const cancelAllInteractionsRef = useRef(cancelAllInteractions);
  cancelAllInteractionsRef.current = cancelAllInteractions;

  useEffect(() => {
    cancelAllInteractionsRef.current();
  }, [cancelSignal]);

  useEffect(() => {
    if (!quickActionsOpen) return;
    const frame = window.requestAnimationFrame(() => quickActionsRef.current?.querySelector<HTMLElement>("button")?.focus());
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setQuickActionsOpen(false);
      window.requestAnimationFrame(() => commandButtonRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [quickActionsOpen]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const result = companionCommandKeyResult(event.key);
    if (!result) return;
    event.preventDefault();
    if (result === "cycle-previous") cycle(-1);
    else if (result === "cycle-next") cycle(1);
    else if (result === "open-quick-actions") consume({ kind: result });
    else if (result === "open-drawer-expanded") consume({ kind: result });
    else cancelPointer();
  };

  const runQuickAction = (action: () => void) => {
    setQuickActionsOpen(false);
    action();
    window.requestAnimationFrame(() => {
      if (canRestoreFocus(commandButtonRef.current)) commandButtonRef.current.focus();
    });
  };

  return <div className={`wilds-companion-command-zone mode-${mode}${quickActionsOpen ? " quick-actions-open" : ""}`}>
    {quickActionsOpen && activeEntry ? <div aria-label={`${activeEntry.name} character actions`} className="wilds-companion-quick-actions" ref={quickActionsRef} role="dialog">
      <header>
        <WildsCreatureThumbnail asset={activeEntry.asset} className="wilds-companion-quick-portrait" />
        <span><strong>{activeEntry.name}</strong><small>Lv. {activeEntry.level} · {activeEntry.xp} XP · Bond {activeEntry.bond}</small><b>{activeEntry.element} · {activeEntry.conditionLabel}</b></span>
        <button aria-label="Close character actions" onClick={() => runQuickAction(() => {})} type="button"><Icons.close aria-hidden="true" size={17} /></button>
      </header>
      <div>
        <button onClick={() => runQuickAction(() => onTrainCharacter(activeEntry.asset.manifest.familyId))} type="button">Train</button>
        <button onClick={() => runQuickAction(onRecoverCharacter)} type="button">Recover</button>
        <button onClick={() => runQuickAction(onViewInVault)} type="button">View in Vault</button>
      </div>
    </div> : null}
    <button
      aria-expanded={quickActionsOpen}
      aria-label={activeEntry ? `${activeEntry.name}. Open character actions. Swipe sideways to change character, flick up for the full roster, or hold for character actions.` : "No selectable creature in this Vault."}
      className="wilds-companion-command"
      disabled={!activeEntry}
      onKeyDown={onKeyDown}
      onLostPointerCapture={cancelPointer}
      onPointerCancel={cancelPointer}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      ref={(button) => {
        commandButtonRef.current = button;
        onCommandButtonReady?.(button);
      }}
      type="button"
    >
      {activeEntry ? <>
        <WildsCreatureThumbnail asset={activeEntry.asset} className="wilds-companion-active-portrait" />
        <strong className="wilds-companion-real-name">{activeEntry.name}</strong>
        <small>{projection.position}/{projection.total}</small>
      </> : <span className="wilds-companion-empty-copy">No selectable creature in this Vault.</span>}
    </button>
  </div>;
}
