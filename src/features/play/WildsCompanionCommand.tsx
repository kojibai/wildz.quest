"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  advanceCompanionGesture,
  cancelCompanionGesture,
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
import { nextCompanionAbilityIndex, type CompanionAbilityNavigationKey } from "./companion-ability-composite";
import { canRestoreFocus } from "./focus-recovery";
import type { VaultCompanionRosterEntry } from "./vault-companion-roster";
import {
  openCompanionKeyboardInteraction,
  resetCompanionCommandInteraction,
  type CompanionCommandInteractionState
} from "./companion-command-interaction";

export type WildsCompanionPower = { id: string; label: string };

export function WildsCompanionCommand({
  entries,
  activeEntry,
  fieldPowers,
  onSelectCard,
  onUsePower,
  onSelectAbility,
  selectedAbilityIndex,
  onRequestDrawer,
  onCommandButtonReady,
  onAudioCue,
  cancelSignal = 0
}: {
  entries: readonly VaultCompanionRosterEntry[];
  activeEntry: VaultCompanionRosterEntry | null;
  fieldPowers: readonly WildsCompanionPower[];
  onSelectCard: (assetId: string) => void;
  onUsePower: (abilityIndex: number) => void;
  onSelectAbility: (abilityIndex: number) => void;
  selectedAbilityIndex: number;
  onRequestDrawer: (snap: "preview" | "expanded") => void;
  onCommandButtonReady?: (button: HTMLButtonElement | null) => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
  cancelSignal?: number;
}) {
  const gestureRef = useRef<CompanionGestureState | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerCaptureTargetRef = useRef<HTMLButtonElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const commandButtonRef = useRef<HTMLButtonElement | null>(null);
  const abilityListboxRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<CompanionGestureState["mode"]>("pending");
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(null);
  const [keyboardWheelOpen, setKeyboardWheelOpen] = useState(false);
  const projection = useMemo(
    () => companionCarousel(entries.map((entry) => ({ id: entry.asset.id })), activeEntry?.asset.id ?? null),
    [activeEntry?.asset.id, entries]
  );
  const abilityCount = Math.max(1, Math.min(4, fieldPowers.length));
  const normalizedActiveAbilityIndex = activeAbilityIndex === null ? null : activeAbilityIndex % abilityCount;

  const clearHold = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const renderGesture = (gesture: CompanionGestureState) => {
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      setMode(gesture.mode);
      setActiveAbilityIndex(gesture.activeAbilityIndex);
    });
  };

  const applyInteractionState = (state: CompanionCommandInteractionState) => {
    setMode(state.mode);
    setActiveAbilityIndex(state.activeAbilityIndex);
    setKeyboardWheelOpen(state.keyboardWheelOpen);
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
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
  }, []);

  const cycle = (direction: -1 | 1) => {
    const assetId = cycleVaultCompanion(entries.map((entry) => entry.asset.id), activeEntry?.asset.id ?? null, direction);
    if (!assetId || assetId === activeEntry?.asset.id) return;
    playWildsHaptic("cycle");
    onAudioCue?.("companion-detent");
    onSelectCard(assetId);
  };

  const consume = (result: CompanionGestureResult) => {
    if (result.kind === "tap-power") {
      playWildsHaptic("confirm");
      onUsePower(selectedAbilityIndex);
    } else if (result.kind === "cycle-next") {
      cycle(1);
    } else if (result.kind === "cycle-previous") {
      cycle(-1);
    } else if (result.kind === "open-drawer") {
      playWildsHaptic("drawer-open");
      onRequestDrawer("preview");
    } else if (result.kind === "select-ability") {
      const index = result.index % abilityCount;
      onSelectAbility(index);
      playWildsHaptic("confirm");
    } else if (result.kind === "cancel") {
      playWildsHaptic("cancel");
    }
    setMode("pending");
    setActiveAbilityIndex(null);
    setKeyboardWheelOpen(false);
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
      if (advanced.mode === "ability-wheel") playWildsHaptic("wheel-open");
      if (advanced.mode === "ability-wheel") setKeyboardWheelOpen(false);
      renderGesture(advanced);
    }, 96);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!gestureRef.current || activePointerIdRef.current !== event.pointerId) return;
    const previousIndex = gestureRef.current.activeAbilityIndex;
    const moved = moveCompanionGesture(gestureRef.current, pointerPoint(event), performance.now());
    gestureRef.current = moved;
    if (moved.activeAbilityIndex !== previousIndex && moved.activeAbilityIndex !== null) {
      playWildsHaptic("wheel-detent");
      onAudioCue?.("companion-detent");
    }
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

  const openKeyboardWheel = () => {
    applyInteractionState(openCompanionKeyboardInteraction(selectedAbilityIndex, abilityCount));
    playWildsHaptic("wheel-open");
  };

  const restoreCommandFocus = () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (canRestoreFocus(commandButtonRef.current)) commandButtonRef.current.focus();
    });
  };

  const closeKeyboardWheel = (commit: boolean) => {
    const index = (activeAbilityIndex ?? selectedAbilityIndex) % abilityCount;
    if (commit) onSelectAbility(index);
    const reset = resetCompanionCommandInteraction(commit ? "commit" : "escape");
    applyInteractionState(reset);
    playWildsHaptic(commit ? "confirm" : "cancel");
    if (reset.restoreFocus) restoreCommandFocus();
  };

  const cancelAllInteractions = () => {
    clearHold();
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = null;
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = null;
    gestureRef.current = null;
    releaseActivePointerCapture();
    applyInteractionState(resetCompanionCommandInteraction("owner-cancel"));
  };
  const cancelAllInteractionsRef = useRef(cancelAllInteractions);
  cancelAllInteractionsRef.current = cancelAllInteractions;

  useEffect(() => {
    cancelAllInteractionsRef.current();
  }, [cancelSignal]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key.toLowerCase() === "a") {
      event.preventDefault();
      openKeyboardWheel();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onUsePower(selectedAbilityIndex);
      playWildsHaptic("confirm");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      cycle(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      cycle(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onRequestDrawer("preview");
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelPointer();
      setMode("pending");
    }
  };

  const onAbilityKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      closeKeyboardWheel(true);
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      setActiveAbilityIndex((current) => nextCompanionAbilityIndex(
        current ?? selectedAbilityIndex,
        event.key as CompanionAbilityNavigationKey,
        abilityCount
      ));
      playWildsHaptic("wheel-detent");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeKeyboardWheel(false);
    }
  };

  const wheelOpen = mode === "ability-wheel";
  useEffect(() => {
    if (!wheelOpen || !keyboardWheelOpen) return;
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      abilityListboxRef.current?.focus();
    });
  }, [keyboardWheelOpen, wheelOpen]);

  return <div className={`wilds-companion-command-zone mode-${mode}`}>
    {wheelOpen ? <div
      aria-activedescendant={normalizedActiveAbilityIndex === null ? undefined : `wilds-companion-ability-${normalizedActiveAbilityIndex}`}
      aria-label="Choose active companion ability"
      className="wilds-companion-ability-wheel"
      onKeyDown={onAbilityKeyDown}
      ref={abilityListboxRef}
      role="listbox"
      tabIndex={0}
    >
      {fieldPowers.slice(0, 4).map((power, index) => <div
        aria-selected={normalizedActiveAbilityIndex === index}
        className={`wilds-companion-ability ability-${index}${normalizedActiveAbilityIndex === index ? " is-active" : ""}`}
        id={`wilds-companion-ability-${index}`}
        key={power.id}
        role="option"
      >{power.label}</div>)}
    </div> : null}
    <button
      aria-label={activeEntry ? `${activeEntry.name}. Tap to use ${fieldPowers[selectedAbilityIndex]?.label ?? "field power"}. Swipe sideways to change companion, swipe up for roster, or hold for abilities.` : "No selectable creature in this Vault."}
      aria-expanded={wheelOpen}
      aria-haspopup="listbox"
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
        <span className="wilds-companion-power-label">{fieldPowers[selectedAbilityIndex]?.label ?? "Power"}</span>
        <small>{projection.position}/{projection.total}</small>
      </> : <span className="wilds-companion-empty-copy">No selectable creature in this Vault.</span>}
    </button>
  </div>;
}
