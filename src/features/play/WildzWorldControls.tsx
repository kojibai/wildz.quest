"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Icons } from "@/components/icons";
import type { WildzCardSort } from "./card-sort";
import { creatureForm } from "./creature-catalog";
import type { PlayState, WildsInput } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import { useWorldOverlayDirector } from "./use-world-overlay-director";
import type { WildsAudioCue } from "./wilds-audio";
import { WildsCommandDock, type WildsCommandItem, type WildsCommandKey } from "./WildsCommandDock";
import { WildsCompanionCommand } from "./WildsCompanionCommand";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import { WildzDpad } from "./WildzDpad";
import type { WildsMovementMode } from "./wilds-movement";
import type { WorldOverlayOwner } from "./world-overlay-state";

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
  requestedCommand = null,
  onRequestedCommandHandled = ignore,
  onCardOrderChange,
  onInput,
  onAction,
  onMovementModeChange,
  onSelectCard,
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
  requestedCommand?: WildsCommandKey | null;
  onRequestedCommandHandled?: () => void;
  onCardOrderChange: (order: WildzCardSort) => void;
  onInput: (input: WildsInput) => void;
  onAction: () => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onSelectCard: (assetId: string) => void;
  onRest: () => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
}) {
  const { state, dispatch, gestureCancelSignal } = useWorldOverlayDirector({ dismissSignal, exclusiveOwner });
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const forwardInput = useStableEvent(onInput);
  const invokeAction = useStableEvent(onAction);
  const changeMovementMode = useStableEvent(onMovementModeChange);
  const rest = useStableEvent(onRest);
  const requestHandled = useStableEvent(onRequestedCommandHandled);
  const controlsEnabled = exclusiveOwner === "none" && state.exclusiveOwner === "none";
  const handleInput = useCallback((input: WildsInput) => {
    if (controlsEnabled) forwardInput(input);
  }, [controlsEnabled, forwardInput]);
  const handleToolsOpenChange = useCallback((open: boolean) => dispatch({ type: "tools", open }), [dispatch]);
  const handlePanelKeyChange = useCallback((key: WildsCommandKey | null) => dispatch({ type: "panel", key }), [dispatch]);
  const handleDrawerSnapChange = useCallback((snap: "closed" | "preview" | "expanded") => dispatch({ type: "drawer", snap }), [dispatch]);
  const handleRequestDrawer = useCallback((snap: "preview" | "expanded") => dispatch({ type: "drawer", snap }), [dispatch]);
  const handleSelectCard = useCallback((assetId: string) => {
    if (controlsEnabled) selectCard(assetId);
  }, [controlsEnabled, selectCard]);
  const handleUsePower = useCallback(() => {
    if (controlsEnabled) invokeAction();
  }, [controlsEnabled, invokeAction]);
  const handleRest = useCallback(() => {
    if (controlsEnabled) rest();
  }, [controlsEnabled, rest]);
  const handleMovementModeChange = useCallback(() => {
    if (controlsEnabled) changeMovementMode(movementMode === "walk" ? "run" : "walk");
  }, [changeMovementMode, controlsEnabled, movementMode]);
  const fieldPowers = useMemo(() => {
    const form = activeCard ? creatureForm(activeCard.manifest.formId) : null;
    return form?.abilities.map((ability, index) => ({ id: `${form.id}:${index}`, label: ability.name }))
      ?? [{ id: "context", label: action.label }];
  }, [action.label, activeCard]);

  useEffect(() => {
    if (requestedCommand && exclusiveOwner !== "none") requestHandled();
  }, [exclusiveOwner, requestHandled, requestedCommand]);

  return (
    <section className="wildz-world-controls" aria-label="World controls">
      <div className="wildz-movement-home">
        <div className="wildz-quick-utilities" aria-label="Quick utilities">
          <button aria-label="Make camp and recover" disabled={!controlsEnabled} onClick={handleRest} type="button"><Icons.camp size={20} /></button>
          <button
            aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"}
            disabled={!controlsEnabled}
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

      <div className="wildz-tools-home">
        <WildsCommandDock
          items={commandItems}
          toolsOpen={controlsEnabled && state.toolsOpen}
          panelKey={controlsEnabled ? state.panelKey : null}
          onToolsOpenChange={handleToolsOpenChange}
          onPanelKeyChange={handlePanelKeyChange}
          requestedKey={exclusiveOwner === "none" ? requestedCommand : null}
          dismissSignal={dismissSignal}
          onRequestHandled={requestHandled}
        />
      </div>

      <div className="wildz-companion-home">
        <WildzCreatureDrawer
          activeCard={activeCard}
          cardOrder={cardOrder}
          cardConditions={cardConditions}
          companionProgress={companionProgress}
          nearbyCards={nearbyCards}
          onCardOrderChange={changeCardOrder}
          onSelectCard={selectCard}
          snap={controlsEnabled ? state.drawerSnap : "closed"}
          onSnapChange={handleDrawerSnapChange}
        />
        <WildsCompanionCommand
          activeCard={activeCard}
          cancelSignal={gestureCancelSignal}
          cards={nearbyCards}
          fieldPowers={fieldPowers}
          onRequestDrawer={handleRequestDrawer}
          onAudioCue={onAudioCue}
          onSelectAbility={ignore}
          onSelectCard={handleSelectCard}
          onUsePower={handleUsePower}
        />
      </div>
    </section>
  );
}
