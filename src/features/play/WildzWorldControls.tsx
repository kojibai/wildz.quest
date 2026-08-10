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
  const { state, dispatch } = useWorldOverlayDirector({ dismissSignal, exclusiveOwner });
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const controlsEnabled = exclusiveOwner === "none" && state.exclusiveOwner === "none";
  const fieldPowers = useMemo(() => {
    const form = activeCard ? creatureForm(activeCard.manifest.formId) : null;
    return form?.abilities.map((ability, index) => ({ id: `${form.id}:${index}`, label: ability.name }))
      ?? [{ id: "context", label: action.label }];
  }, [action.label, activeCard]);

  useEffect(() => {
    if (requestedCommand && exclusiveOwner !== "none") onRequestedCommandHandled();
  }, [exclusiveOwner, onRequestedCommandHandled, requestedCommand]);

  return (
    <section className="wildz-world-controls" aria-label="World controls">
      <div className="wildz-movement-home">
        <div className="wildz-quick-utilities" aria-label="Quick utilities">
          <button aria-label="Make camp and recover" disabled={!controlsEnabled} onClick={onRest} type="button"><Icons.camp size={20} /></button>
          <button
            aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"}
            disabled={!controlsEnabled}
            onClick={() => onMovementModeChange(movementMode === "walk" ? "run" : "walk")}
            type="button"
          >
            {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
          </button>
        </div>
        <WildzDpad
          cameraHeadingRef={cameraHeadingRef}
          movementMode={movementMode}
          onInput={(input) => { if (controlsEnabled) onInput(input); }}
        />
      </div>

      <div className="wildz-tools-home">
        <WildsCommandDock
          items={commandItems}
          toolsOpen={controlsEnabled && state.toolsOpen}
          panelKey={controlsEnabled ? state.panelKey : null}
          onToolsOpenChange={(open) => dispatch({ type: "tools", open })}
          onPanelKeyChange={(key) => dispatch({ type: "panel", key })}
          requestedKey={exclusiveOwner === "none" ? requestedCommand : null}
          dismissSignal={dismissSignal}
          onRequestHandled={onRequestedCommandHandled}
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
          onSnapChange={(snap) => dispatch({ type: "drawer", snap })}
        />
        <WildsCompanionCommand
          activeCard={activeCard}
          cards={nearbyCards}
          fieldPowers={fieldPowers}
          onRequestDrawer={(snap) => dispatch({ type: "drawer", snap })}
          onAudioCue={onAudioCue}
          onSelectAbility={ignore}
          onSelectCard={(assetId) => { if (controlsEnabled) selectCard(assetId); }}
          onUsePower={() => { if (controlsEnabled) onAction(); }}
        />
      </div>
    </section>
  );
}
