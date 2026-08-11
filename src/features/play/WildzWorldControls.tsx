"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Icons } from "@/components/icons";
import type { WildzCardSort } from "./card-sort";
import { creatureForm } from "./creature-catalog";
import type { PlayState, WildsInput } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import type { WildsAudioCue } from "./wilds-audio";
import { canRestoreFocus } from "./focus-recovery";
import { projectVaultCompanionRoster } from "./vault-companion-roster";
import { WildsCommandDock, type WildsCommandItem, type WildsCommandKey } from "./WildsCommandDock";
import { WildsCompanionCommand } from "./WildsCompanionCommand";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import { WildzDpad } from "./WildzDpad";
import type { WildsMovementMode } from "./wilds-movement";
import type { WorldOverlayEvent, WorldOverlayOwner, WorldOverlayState } from "./world-overlay-state";

const ignore = () => {};

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

export function WildzWorldControls({
  nearbyCards,
  activeCard,
  companionProgress,
  cardConditions,
  action,
  cameraHeadingRef,
  movementMode,
  cardOrder,
  commandItems,
  dismissSignal,
  exclusiveOwner,
  overlayState,
  overlayDispatch,
  gestureCancelSignal,
  selectedAbilityIndex,
  newRosterAssetId,
  requestedCommand = null,
  onRequestedCommandHandled = ignore,
  onCardOrderChange,
  onInput,
  onAction,
  onMovementModeChange,
  onSelectCard,
  onSelectAbility,
  onRest,
  onAudioCue
}: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  cardConditions: PlayState["adventureConditions"];
  action: { kind: string; label: string };
  cameraHeadingRef: RefObject<number>;
  movementMode: WildsMovementMode;
  cardOrder: WildzCardSort;
  commandItems: readonly WildsCommandItem[];
  dismissSignal: number;
  exclusiveOwner: WorldOverlayOwner;
  overlayState: WorldOverlayState;
  overlayDispatch: (event: WorldOverlayEvent) => void;
  gestureCancelSignal: number;
  selectedAbilityIndex: number;
  newRosterAssetId: string | null;
  requestedCommand?: WildsCommandKey | null;
  onRequestedCommandHandled?: () => void;
  onCardOrderChange: (order: WildzCardSort) => void;
  onInput: (input: WildsInput) => void;
  onAction: (abilityIndex: number) => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onSelectCard: (assetId: string) => void;
  onSelectAbility: (abilityIndex: number) => void;
  onRest: () => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
}) {
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const selectAbility = useStableEvent(onSelectAbility);
  const forwardInput = useStableEvent(onInput);
  const invokeAction = useStableEvent(onAction);
  const changeMovementMode = useStableEvent(onMovementModeChange);
  const rest = useStableEvent(onRest);
  const requestHandled = useStableEvent(onRequestedCommandHandled);
  const drawerOriginRef = useRef<HTMLElement | null>(null);
  const companionCommandRef = useRef<HTMLButtonElement | null>(null);
  const drawerFocusFrameRef = useRef<number | null>(null);
  const previousDrawerSnapRef = useRef<"closed" | "preview" | "expanded">("closed");
  const pendingDrawerOriginRestoreRef = useRef(false);
  const controlsEnabled = (exclusiveOwner === "none" || exclusiveOwner === "command")
    && (overlayState.exclusiveOwner === "none" || overlayState.exclusiveOwner === "command");
  const panelOpen = exclusiveOwner === "command" && overlayState.panelKey !== null;
  const worldHomesEnabled = exclusiveOwner === "none" && controlsEnabled && !panelOpen;
  const movementHomeBlocked = exclusiveOwner !== "none" || panelOpen;
  const toolsHomeBlocked = exclusiveOwner !== "none" && exclusiveOwner !== "command";
  const companionHomeBlocked = exclusiveOwner !== "none" || panelOpen;
  const controlledDrawerSnap = worldHomesEnabled ? overlayState.drawerSnap : "closed";
  const handleInput = useCallback((input: WildsInput) => {
    if (worldHomesEnabled) forwardInput(input);
  }, [forwardInput, worldHomesEnabled]);
  const handleToolsOpenChange = useCallback((open: boolean) => {
    if (!toolsHomeBlocked) overlayDispatch({ type: "tools", open });
  }, [overlayDispatch, toolsHomeBlocked]);
  const handlePanelKeyChange = useCallback((key: WildsCommandKey | null) => {
    if (!toolsHomeBlocked) overlayDispatch({ type: "panel", key });
  }, [overlayDispatch, toolsHomeBlocked]);
  const restoreDrawerOrigin = useCallback(() => {
    if (drawerFocusFrameRef.current !== null) window.cancelAnimationFrame(drawerFocusFrameRef.current);
    drawerFocusFrameRef.current = window.requestAnimationFrame(() => {
      drawerFocusFrameRef.current = null;
      if (canRestoreFocus(drawerOriginRef.current)) drawerOriginRef.current.focus();
    });
  }, []);
  useEffect(() => () => {
    if (drawerFocusFrameRef.current !== null) window.cancelAnimationFrame(drawerFocusFrameRef.current);
  }, []);
  useEffect(() => {
    if (previousDrawerSnapRef.current !== "closed" && controlledDrawerSnap === "closed") {
      pendingDrawerOriginRestoreRef.current = true;
    }
    previousDrawerSnapRef.current = controlledDrawerSnap;
    if (!pendingDrawerOriginRestoreRef.current || !worldHomesEnabled || companionHomeBlocked) return;
    pendingDrawerOriginRestoreRef.current = false;
    restoreDrawerOrigin();
  }, [companionHomeBlocked, controlledDrawerSnap, restoreDrawerOrigin, worldHomesEnabled]);
  const handleDrawerSnapChange = useCallback((snap: "closed" | "preview" | "expanded") => {
    if (companionHomeBlocked) return;
    overlayDispatch({ type: "drawer", snap });
  }, [companionHomeBlocked, overlayDispatch]);
  const handleRequestDrawer = useCallback((snap: "preview" | "expanded") => {
    if (!worldHomesEnabled) return;
    drawerOriginRef.current = companionCommandRef.current;
    overlayDispatch({ type: "drawer", snap });
  }, [overlayDispatch, worldHomesEnabled]);
  const handleSelectCard = useCallback((assetId: string) => {
    if (worldHomesEnabled) selectCard(assetId);
  }, [selectCard, worldHomesEnabled]);
  const handleSelectAbility = useCallback((abilityIndex: number) => {
    if (worldHomesEnabled) selectAbility(abilityIndex);
  }, [selectAbility, worldHomesEnabled]);
  const handleUsePower = useCallback((abilityIndex: number) => {
    if (worldHomesEnabled) invokeAction(abilityIndex);
  }, [invokeAction, worldHomesEnabled]);
  const handleRest = useCallback(() => {
    if (worldHomesEnabled) rest();
  }, [rest, worldHomesEnabled]);
  const handleMovementModeChange = useCallback(() => {
    if (worldHomesEnabled) changeMovementMode(movementMode === "walk" ? "run" : "walk");
  }, [changeMovementMode, movementMode, worldHomesEnabled]);
  const fieldPowers = useMemo(() => {
    const form = activeCard ? creatureForm(activeCard.manifest.formId) : null;
    return form?.abilities.map((ability, index) => ({ id: `${form.id}:${index}`, label: ability.name }))
      ?? [{ id: "context", label: action.label }];
  }, [action.label, activeCard]);
  const companionRoster = useMemo(() => projectVaultCompanionRoster({
    inventory: nearbyCards,
    companionProgress,
    cardConditions,
    activeAssetId: activeCard?.id ?? null,
    newAssetId: newRosterAssetId
  }), [activeCard?.id, cardConditions, companionProgress, nearbyCards, newRosterAssetId]);

  useEffect(() => {
    if (requestedCommand && exclusiveOwner !== "none") requestHandled();
  }, [exclusiveOwner, requestHandled, requestedCommand]);

  return (
    <section className={`wildz-world-controls${panelOpen ? " is-panel-open" : ""}`} aria-label="World controls">
      <div aria-hidden={movementHomeBlocked} className="wildz-movement-home" inert={movementHomeBlocked ? true : undefined}>
        <div className="wildz-quick-utilities" aria-label="Quick utilities">
          <button aria-label="Make camp and recover" disabled={!worldHomesEnabled} onClick={handleRest} type="button"><Icons.camp size={20} /></button>
          <button
            aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"}
            disabled={!worldHomesEnabled}
            onClick={handleMovementModeChange}
            type="button"
          >
            {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
          </button>
        </div>
        <WildzDpad
          cameraHeadingRef={cameraHeadingRef}
          cancelSignal={gestureCancelSignal}
          movementMode={movementMode}
          onInput={handleInput}
        />
      </div>

      <div aria-hidden={toolsHomeBlocked} className="wildz-tools-home" inert={toolsHomeBlocked ? true : undefined}>
        <WildsCommandDock
          items={commandItems}
          toolsOpen={controlsEnabled && overlayState.toolsOpen}
          panelKey={controlsEnabled ? overlayState.panelKey : null}
          onToolsOpenChange={handleToolsOpenChange}
          onPanelKeyChange={handlePanelKeyChange}
          requestedKey={exclusiveOwner === "none" ? requestedCommand : null}
          dismissSignal={dismissSignal}
          exclusiveOwner={exclusiveOwner}
          onRequestHandled={requestHandled}
        />
      </div>

      <div aria-hidden={companionHomeBlocked} className="wildz-companion-home" inert={companionHomeBlocked ? true : undefined}>
        <WildzCreatureDrawer
          cardOrder={cardOrder}
          entries={companionRoster}
          onCardOrderChange={changeCardOrder}
          onSelectCard={handleSelectCard}
          snap={controlledDrawerSnap}
          onSnapChange={handleDrawerSnapChange}
        />
        <WildsCompanionCommand
          activeCard={activeCard}
          cancelSignal={gestureCancelSignal}
          cards={nearbyCards}
          fieldPowers={fieldPowers}
          onCommandButtonReady={(button) => { companionCommandRef.current = button; }}
          onRequestDrawer={handleRequestDrawer}
          onAudioCue={worldHomesEnabled ? onAudioCue : undefined}
          onSelectAbility={handleSelectAbility}
          onSelectCard={handleSelectCard}
          onUsePower={handleUsePower}
          selectedAbilityIndex={selectedAbilityIndex}
        />
      </div>
    </section>
  );
}
