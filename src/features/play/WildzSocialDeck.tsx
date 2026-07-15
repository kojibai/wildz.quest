"use client";

import { Icons } from "@/components/icons";
import type { PlayState, WildsInput } from "./game-state";
import type { WildsMovementMode } from "./wilds-movement";
import type { PortableCardAsset } from "./portable-card";
import { creatureForm } from "./creature-catalog";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import { WildzContextButton } from "./WildzContextButton";
import { WildzDpad } from "./WildzDpad";

export function WildzSocialDeck({ nearbyCards, activeCard, companionProgress, action, cameraHeading, movementMode, onInput, onAction, onMovementModeChange, onSelectCard, onOpenFieldGuide, onOpenProfile, onOpenMarket, onOpenSatchel, onOpenDeck, onOpenVault, onRest, onTrain, onMission }: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  action: { kind: string; label: string };
  cameraHeading: number;
  movementMode: WildsMovementMode;
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
  return <section className="wildz-social-deck" aria-label="Nearby companions and game functions">
    <span className="wildz-social-handle" aria-hidden="true" />
    <div className="wildz-nearby-cards">
      {nearbyCards.slice(0, 4).map((card) => {
        const form = creatureForm(card.manifest.formId);
        const progress = companionProgress[card.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
        return <article key={card.id}>
        <button className="wildz-nearby-creature" onClick={() => onSelectCard(card.id)} type="button">
          <WildsCreatureThumbnail asset={card} className="wildz-creature-portrait" />
          <div><strong>{card.manifest.name}</strong><small>Lv. {progress.level} · Stage {card.manifest.stage} · {form?.element ?? card.manifest.species}</small><em>{form?.temperament ?? card.manifest.rarity}</em></div>
        </button>
        <div className="wildz-nearby-owner"><Icons.user size={18} /><span><strong>{card.manifest.ownerReceizId}</strong></span></div>
        <button className="wildz-trade-inline" onClick={onOpenMarket} type="button"><b>{card.manifest.stats.power} PWR</b><span>Trade</span></button>
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
      <button aria-label="Open field guide" className="wildz-action-guide" onClick={onOpenFieldGuide} type="button"><Icons.book size={25} /></button>
      <button aria-label="Open player profile" className="wildz-action-people" onClick={onOpenProfile} type="button"><Icons.users size={25} /><i aria-hidden="true" /></button>
      <button aria-label="Open social market" className="wildz-action-pulse" onClick={onOpenMarket} type="button"><Icons.waveform size={25} /></button>
      <button aria-label="Open active deck" className="wildz-action-companion" onClick={onOpenDeck} type="button">{activeCard ? <WildsCreatureThumbnail asset={activeCard} /> : <Icons.assets size={25} />}</button>
      <button aria-label="Open foraging satchel" className="wildz-action-satchel" onClick={onOpenSatchel} type="button"><Icons.products size={24} /><Icons.sparkle className="wildz-action-satchel-spark" size={12} /></button>
    </nav>
  </section>;
}
