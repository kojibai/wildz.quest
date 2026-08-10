"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import type { PortableCardAsset } from "./portable-card";
import type { TrainerEncounterState } from "./trainer-encounter";
import type { WildsTrainerProjection } from "./wilds-saga-trainers";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";

function difficulty(trainer: WildsTrainerProjection, playerLevel: number) {
  const delta = trainer.challengeLevel - playerLevel;
  if (delta >= 5 || trainer.tier === "boss") return "Severe";
  if (delta >= 2 || trainer.tier === "champion") return "Hard";
  if (delta <= -3) return "Favored";
  return "Matched";
}

export function WildsTrainerEncounter({
  encounter,
  trainer,
  activeCard,
  roster,
  playerLevel,
  onAccept,
  onCancel,
  onContinue,
  onRematch,
  onSkipTransition,
  onTransitionComplete
}: {
  encounter: TrainerEncounterState;
  trainer: WildsTrainerProjection;
  activeCard: PortableCardAsset;
  roster: readonly PortableCardAsset[];
  playerLevel: number;
  onAccept: (rosterIds: readonly string[]) => void;
  onCancel: () => void;
  onContinue: () => void;
  onRematch: () => void;
  onSkipTransition: () => void;
  onTransitionComplete: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const transitionCompleteRef = useRef(onTransitionComplete);
  transitionCompleteRef.current = onTransitionComplete;
  const admittedRoster = useMemo(
    () => [activeCard, ...roster.filter((card) => card.id !== activeCard.id)].slice(0, 3),
    [activeCard, roster]
  );

  useEffect(() => {
    if (encounter.phase !== "transition") return;
    const timer = window.setTimeout(() => transitionCompleteRef.current(), encounter.transitionDurationMs);
    return () => window.clearTimeout(timer);
  }, [encounter.phase, encounter.transitionDurationMs]);

  if (encounter.phase === "idle" || encounter.phase === "combat" || encounter.phase === "returning") return null;

  if (encounter.phase === "transition") {
    return <section className="wilds-trainer-transition" aria-live="assertive" aria-label={`Battle transition: ${activeCard.manifest.name} versus ${trainer.name}`}>
      <div className="wilds-trainer-transition-energy" aria-hidden="true" />
      <article><WildsCreatureThumbnail asset={activeCard} /><strong>{activeCard.manifest.name}</strong><small>Your lead</small></article>
      <div className="wilds-trainer-versus"><span>Trainer battle</span><b>VS</b><i>{trainer.affinity}</i></div>
      <article className={`is-rival affinity-${trainer.affinity}`}><span className="wilds-trainer-portrait"><Icons.users size={34} /></span><strong>{trainer.name}</strong><small>Lv. {trainer.challengeLevel}</small></article>
      {encounter.repeat ? <button onClick={onSkipTransition} type="button">Skip</button> : null}
    </section>;
  }

  if (encounter.phase === "result" && encounter.result) {
    const victory = encounter.result.outcome === "player_victory";
    return <section className="wilds-trainer-result" aria-labelledby="wilds-trainer-result-title" aria-modal="true" role="dialog">
      <span className="eyebrow">Result sealed · Arena Path {encounter.result.arenaPathStage}</span>
      <Icons.trophy aria-hidden="true" size={34} />
      <h2 id="wilds-trainer-result-title">{victory ? "Victory carried into the Wilds" : encounter.result.outcome === "fled" ? "Retreat survived" : "The rivalry deepens"}</h2>
      <p>{trainer.name} will remember this encounter. Your companion’s condition and history were committed before this result appeared.</p>
      <div className="wilds-trainer-result-rewards" aria-label="Encounter rewards">
        <span><strong>+{encounter.result.xp}</strong><small>XP</small></span>
        <span><strong>+{encounter.result.bond}</strong><small>Bond</small></span>
        <span><strong>{trainer.rematchIndex + 1}</strong><small>Memory</small></span>
      </div>
      {reviewOpen ? <div className="wilds-trainer-result-review" role="status"><strong>{encounter.settlementId}</strong><span>{trainer.affinity} affinity · {trainer.tier} tier · deterministic settlement</span></div> : null}
      <div className="wilds-trainer-result-actions">
        <button className="primary" onClick={onContinue} type="button">Continue</button>
        {trainer.recurring ? <button onClick={onRematch} type="button">Rematch</button> : null}
        <button aria-expanded={reviewOpen} onClick={() => setReviewOpen((open) => !open)} type="button">Review</button>
      </div>
    </section>;
  }

  return <section className="wilds-trainer-challenge" aria-labelledby="wilds-trainer-challenge-title" aria-modal="true" role="dialog">
    <header>
      <div className={`wilds-trainer-portrait affinity-${trainer.affinity}`}><Icons.users aria-hidden="true" size={32} /></div>
      <div><span className="eyebrow">{trainer.tier} trainer · {trainer.affinity} affinity</span><h2 id="wilds-trainer-challenge-title">{trainer.name}</h2></div>
      <button aria-label="Close trainer challenge" onClick={onCancel} type="button"><Icons.close size={19} /></button>
    </header>
    <blockquote>“Your Kai Pulse leaves a clear trail. Let’s see whether your bond holds when the arena answers back.”</blockquote>
    <div className="wilds-trainer-matchup">
      <span><small>Trainer level</small><strong>{trainer.challengeLevel}</strong></span>
      <span><small>Estimated</small><strong>{difficulty(trainer, playerLevel)}</strong></span>
      <span><small>Rematch</small><strong>{trainer.rematchIndex + 1}</strong></span>
    </div>
    <div className="wilds-trainer-roster" aria-label="Selected battle roster">
      {admittedRoster.map((card, index) => <article key={card.id}><WildsCreatureThumbnail asset={card} /><span><strong>{card.manifest.name}</strong><small>{index === 0 ? "Lead" : "Reserve"}</small></span></article>)}
    </div>
    <footer>
      <button onClick={onCancel} type="button">Talk</button>
      <button className="primary" onClick={() => onAccept(admittedRoster.map((card) => card.id))} type="button"><Icons.trophy size={18} /> Battle</button>
    </footer>
  </section>;
}
