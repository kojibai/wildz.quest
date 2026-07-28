"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Icons } from "@/components/icons";
import type { WildzCardSort } from "./card-sort";
import type { PlayState, WildsInput } from "./game-state";
import type { WildsMovementMode } from "./wilds-movement";
import type { PortableCardAsset } from "./portable-card";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import { WildzContextButton } from "./WildzContextButton";
import { WildzDpad } from "./WildzDpad";

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

export function WildzSocialDeck({ nearbyCards, activeCard, companionProgress, cardConditions, action, cameraHeadingRef, movementMode, cardOrder, onCardOrderChange, onInput, onAction, onMovementModeChange, onSelectCard, onOpenFieldGuide, onOpenProfile, onOpenMarket, onOpenSatchel, onOpenDeck, onOpenVault, onRest, onTrain, onMission }: {
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
  onOpenFieldGuide: () => void;
  onOpenProfile: () => void;
  onOpenMarket: () => void;
  onOpenSatchel: () => void;
  onOpenDeck: () => void;
  onOpenVault: () => void;
  onRest: () => void;
  onTrain: () => void;
  onMission: () => void;
}) {
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const selectCard = useStableEvent(onSelectCard);

  return <section className="wildz-social-deck" aria-label="Nearby companions and game functions">
    <WildzCreatureDrawer
      activeCard={activeCard}
      cardOrder={cardOrder}
      cardConditions={cardConditions}
      companionProgress={companionProgress}
      nearbyCards={nearbyCards}
      onCardOrderChange={changeCardOrder}
      onSelectCard={selectCard}
    />
    <div className="wildz-bottom-play-controls" aria-label="Movement and context controls">
      <div className="wildz-play-control-rail" aria-label="Explore actions">
        <button aria-label="Discovery active. Tap terrain to scan" aria-pressed="true" className="is-active" type="button"><Icons.game size={20} /></button>
        <button aria-label="Make camp and recover" onClick={onRest} type="button"><Icons.camp size={20} /></button>
        <button aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"} onClick={() => onMovementModeChange(movementMode === "walk" ? "run" : "walk")} type="button">
          {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
        </button>
      </div>
      <WildzDpad cameraHeadingRef={cameraHeadingRef} movementMode={movementMode} onInput={onInput} />
      <div className="wildz-play-control-rail" aria-label="Progression actions">
        <WildzContextButton action={action} onActivate={onAction} />
        <button aria-label="Train active companion" onClick={onTrain} type="button"><Icons.sparkle size={20} /></button>
        <button aria-label="Run world mission" onClick={onMission} type="button"><Icons.trophy size={20} /></button>
      </div>
    </div>
    <nav className="wildz-social-actions" aria-label="All game functions">
      <button aria-label="Open Trail Pack and Wilds Heartbeat" className="wildz-action-vault" onClick={onOpenDeck} type="button"><Icons.archive size={25} /></button>
      <button aria-label="Open field guide" className="wildz-action-guide" onClick={onOpenFieldGuide} type="button"><Icons.book size={25} /></button>
      <button aria-label="Open player profile" className="wildz-action-people" onClick={onOpenProfile} type="button"><Icons.users size={25} /><i aria-hidden="true" /></button>
      <button aria-label="Open social market" className="wildz-action-pulse" onClick={onOpenMarket} type="button"><Icons.waveform size={25} /></button>
      <button aria-label="Open card vault" className="wildz-action-companion" onClick={onOpenVault} type="button"><Icons.assets aria-hidden="true" size={25} /></button>
      <button aria-label="Open foraging satchel" className="wildz-action-satchel" onClick={onOpenSatchel} type="button"><Icons.products size={24} /><Icons.sparkle className="wildz-action-satchel-spark" size={12} /></button>
    </nav>
  </section>;
}
