"use client";

import Image from "next/image";
import { Icons } from "@/components/icons";
import type { WildsInput } from "./game-state";
import type { WildsMovementMode } from "./wilds-movement";
import type { PortableCardAsset } from "./portable-card";
import { creatureForm } from "./creature-catalog";
import { WildzContextButton } from "./WildzContextButton";
import { WildzDpad } from "./WildzDpad";

export function WildzSocialDeck({ nearbyCards, action, cameraHeading, movementMode, onInput, onAction, onMovementModeChange, onSelectCard, onOpenMap, onOpenProfile, onOpenMarket, onOpenRewards, onOpenDeck, onOpenVault, onRest, onTrain, onMission }: {
  nearbyCards: readonly PortableCardAsset[];
  action: { kind: string; label: string };
  cameraHeading: number;
  movementMode: WildsMovementMode;
  onInput: (input: WildsInput) => void;
  onAction: () => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onSelectCard: (assetId: string) => void;
  onOpenMap: () => void;
  onOpenProfile: () => void;
  onOpenMarket: () => void;
  onOpenRewards: () => void;
  onOpenDeck: () => void;
  onOpenVault: () => void;
  onRest: () => void;
  onTrain: () => void;
  onMission: () => void;
}) {
  return <section className="wildz-social-deck" aria-label="Nearby companions and game functions">
    <span className="wildz-social-handle" aria-hidden="true" />
    <div className="wildz-nearby-cards">
      {nearbyCards.slice(0, 4).map((card, index) => {
        const form = creatureForm(card.manifest.formId);
        return <article key={card.id}>
        <button className="wildz-nearby-creature" onClick={() => onSelectCard(card.id)} type="button">
          <span className="wildz-creature-portrait" style={{ backgroundColor: card.manifest.variant.traits.palette.primary }}>
            <Image alt={`${card.manifest.name} companion portrait`} fill sizes="72px" src="/creatures/sealcub-portrait.svg" />
          </span>
          <div><strong>{card.manifest.name}<i>✓</i></strong><small>Lv. {card.manifest.stage + index} · {form?.element ?? "Wild"} · {index ? "TrailSeeker" : "Your explorer"}</small><em>{form?.temperament ?? "bonded"}</em></div>
        </button>
        <div className="wildz-nearby-owner"><Icons.user size={18} /><span><strong>{index ? "TrailSeeker" : "Your explorer"}</strong></span></div>
        <button className="wildz-trade-inline" onClick={onOpenMarket} type="button"><b>{75 + index * 17} 🍃</b><span>Trade</span></button>
      </article>;
      })}
    </div>
    <div className="wildz-bottom-play-controls" aria-label="Movement and context controls">
      <div className="wildz-play-control-rail" aria-label="Explore actions">
        <button aria-label="Discovery active. Tap terrain to scan" aria-pressed="true" className="is-active" type="button"><Icons.game size={20} /></button>
        <button aria-label="Make camp and recover" onClick={onRest} type="button"><Icons.camp size={20} /></button>
        <button aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"} onClick={() => onMovementModeChange(movementMode === "walk" ? "run" : "walk")} type="button">
          {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
        </button>
      </div>
      <WildzDpad cameraHeading={cameraHeading} movementMode={movementMode} onInput={onInput} />
      <div className="wildz-play-control-rail" aria-label="Progression actions">
        <WildzContextButton action={action} onActivate={onAction} />
        <button aria-label="Train active companion" onClick={onTrain} type="button"><Icons.sparkle size={20} /></button>
        <button aria-label="Run world mission" onClick={onMission} type="button"><Icons.trophy size={20} /></button>
      </div>
    </div>
    <nav className="wildz-social-actions" aria-label="All game functions">
      <button aria-label="Open card vault" className="wildz-action-vault" onClick={onOpenVault} type="button"><Icons.archive size={25} /></button>
      <button aria-label="Open world map" className="wildz-action-map" onClick={onOpenMap} type="button"><Icons.map size={25} /></button>
      <button aria-label="Open player profile" className="wildz-action-people" onClick={onOpenProfile} type="button"><Icons.users size={25} /><i aria-hidden="true" /></button>
      <button aria-label="Open social market" className="wildz-action-pulse" onClick={onOpenMarket} type="button"><Icons.waveform size={25} /></button>
      <button aria-label="Open active deck" className="wildz-action-companion" onClick={onOpenDeck} type="button"><Image alt="" height={34} src="/creatures/sealcub-portrait.svg" width={34} /></button>
      <button aria-label="Open rewards" className="wildz-action-rewards" onClick={onOpenRewards} type="button"><Icons.products size={24} /><Icons.sparkle className="wildz-action-reward-spark" size={12} /></button>
    </nav>
  </section>;
}
