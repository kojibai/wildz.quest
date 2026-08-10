"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Icons } from "@/components/icons";
import type { WildzCardSort } from "./card-sort";
import type { PlayState, WildsInput } from "./game-state";
import type { WildsMovementMode } from "./wilds-movement";
import type { PortableCardAsset } from "./portable-card";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import { WildzDpad } from "./WildzDpad";
import { WildsCompanionCommand } from "./WildsCompanionCommand";
import { creatureForm } from "./creature-catalog";
import type { CreatureDrawerSnap } from "./creature-drawer";
import type { WildsAudioCue } from "./wilds-audio";

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

export function WildzSocialDeck({ nearbyCards, activeCard, companionProgress, cardConditions, action, cameraHeadingRef, movementMode, cardOrder, onCardOrderChange, onInput, onAction, onMovementModeChange, onSelectCard, onRest, onAudioCue }: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  cardConditions: PlayState["adventureConditions"];
  action: { kind: string; label: string };
  cameraHeadingRef: RefObject<number>;
  movementMode: WildsMovementMode;
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  onInput: (input: WildsInput) => void;
  onAction: () => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onSelectCard: (assetId: string) => void;
  onRest: () => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
}) {
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);
  const [drawerSnap, setDrawerSnap] = useState<CreatureDrawerSnap>("closed");
  const fieldPowers = useMemo(() => {
    const form = activeCard ? creatureForm(activeCard.manifest.formId) : null;
    return form?.abilities.map((ability, index) => ({ id: `${form.id}:${index}`, label: ability.name }))
      ?? [{ id: "context", label: action.label }];
  }, [action.label, activeCard]);

  return <section className="wildz-social-deck" aria-label="Nearby companions and game functions">
    <WildzCreatureDrawer
      activeCard={activeCard}
      cardOrder={cardOrder}
      cardConditions={cardConditions}
      companionProgress={companionProgress}
      nearbyCards={nearbyCards}
      onCardOrderChange={changeCardOrder}
      onSelectCard={selectCard}
      snap={drawerSnap}
      onSnapChange={setDrawerSnap}
    />
    <div className="wildz-bottom-play-controls" aria-label="Movement and context controls">
      <div className="wildz-quick-utilities" aria-label="Quick utilities">
        <button aria-label="Make camp and recover" onClick={onRest} type="button"><Icons.camp size={20} /></button>
        <button aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"} onClick={() => onMovementModeChange(movementMode === "walk" ? "run" : "walk")} type="button">
          {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
        </button>
      </div>
      <WildzDpad cameraHeadingRef={cameraHeadingRef} movementMode={movementMode} onInput={onInput} />
      <WildsCompanionCommand
        activeCard={activeCard}
        cards={nearbyCards}
        fieldPowers={fieldPowers}
        onRequestDrawer={setDrawerSnap}
        onAudioCue={onAudioCue}
        onSelectAbility={() => {}}
        onSelectCard={selectCard}
        onUsePower={onAction}
      />
    </div>
  </section>;
}
