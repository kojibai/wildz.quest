"use client";

import type { WildsSagaProjection } from "./wilds-saga-director";
import { projectSagaReturnContinuity } from "./wilds-saga-achievements";
import type { WildsMissionGraph, WildsMissionNodeProjection } from "./wilds-saga-missions";
import type { WildsTrainerProjection } from "./wilds-saga-trainers";
import type { WildsTournamentProjection } from "./wilds-saga-tournament";
import type { WildsPlayerSagaState } from "./wilds-world-state";
import type { WildsWorldClientMode } from "./use-wilds-world";

export function WildsSagaPanel({
  saga,
  missions,
  player,
  trainers,
  tournament,
  mode,
  playerId,
  playerName,
  pending,
  onContribute,
  onBattleTrainer,
  onEnterTournament
}: {
  saga: WildsSagaProjection;
  missions: WildsMissionGraph;
  player: WildsPlayerSagaState | null;
  trainers: readonly WildsTrainerProjection[];
  tournament: WildsTournamentProjection | null;
  mode: WildsWorldClientMode;
  playerId: string;
  playerName: string;
  pending: boolean;
  onContribute: (node: WildsMissionNodeProjection) => void;
  onBattleTrainer: (trainer: WildsTrainerProjection) => void;
  onEnterTournament: (tournamentId: string, qualificationGrantId: string) => void;
}) {
  const continuity = projectSagaReturnContinuity({ playerName, saga, memories: saga.activeConsequences });
  const recommended = missions.recommended;
  const primaryNodes = missions.nodes.filter((node) => node.primary);
  const primaryProgress = primaryNodes.reduce((total, node) => total + node.progress, 0);
  const primaryTarget = primaryNodes.reduce((total, node) => total + node.target, 0);
  const percent = primaryTarget ? Math.round(primaryProgress / primaryTarget * 100) : 0;
  const qualification = Object.values(player?.achievementGrants ?? {}).find((grant) => grant.definitionId === saga.chapter.tournament.qualificationAchievementId);
  const entered = tournament?.entrants.some((entrant) => entrant.id === playerId) ?? false;
  const worldMutable = mode === "receiz_live" && Boolean(recommended?.worldMutable);

  return <section className="wilds-saga-panel" aria-label="Living story progression">
    <header>
      <span><small>{"Today's living chapter"}</small><strong>{saga.chapter.title}</strong></span>
      <b>{saga.act.ark}</b>
    </header>
    <p className="wilds-saga-directive">{saga.act.directive}</p>
    <div className="wilds-progress" aria-label={`${percent}% chapter progress`}><span style={{ width: `${percent}%` }} /></div>
    <p className="wilds-saga-live-state" aria-live="polite">
      {worldMutable ? "Your next admitted action can still change this Kai day." : mode === "receiz_live" ? "This objective is an echo; the shared day has moved on." : "Practice mode previews the story without changing the shared world."}
    </p>

    <div className="wilds-saga-grid">
      <article>
        <small>Next objective</small>
        <strong>{recommended?.definition.title ?? "The chapter path is complete"}</strong>
        <p>{recommended?.definition.description ?? "Return at the next Kai moment to meet what follows."}</p>
        {recommended ? <button disabled={!worldMutable || pending} onClick={() => onContribute(recommended)} type="button">
          {recommended.state === "complete" ? "Complete" : `Do: ${recommended.definition.acceptedVerbs[0]}`}
        </button> : null}
      </article>
      <article>
        <small>Trainer level</small>
        <strong>Level {player?.trainerLevel ?? 1}</strong>
        <p>{player?.trainerXp ?? 0} XP · {player?.achievementGrantIds.length ?? 0} real achievements</p>
      </article>
      <article>
        <small>Why the world changed</small>
        <strong>{continuity.causeSummary}</strong>
        <p>{continuity.greeting}</p>
      </article>
    </div>

    <section className="wilds-saga-trainers" aria-label="Seeded trainers">
      <div><small>World trainers</small><strong>{trainers.length ? "Challenges are alive across the map" : "The next trainers are arriving"}</strong></div>
      {trainers.slice(0, 3).map((trainer) => <article key={trainer.id}>
        <span><strong>{trainer.name}</strong><small>{trainer.locationId} · {trainer.affinity}</small></span>
        <b>Lv. {trainer.challengeLevel}</b>
        <button disabled={mode !== "receiz_live" || pending} onClick={() => onBattleTrainer(trainer)} type="button">Battle NPC</button>
      </article>)}
    </section>

    <section className="wilds-saga-tournament" aria-label="Daily tournament">
      <small>Daily tournament</small>
      <strong>{tournament?.name ?? saga.chapter.tournament.name}</strong>
      <p>{tournament ? `${tournament.phase} · ${tournament.entrants.length}/8 seeded entrants` : "Opens during the Purify Ark and resolves with or without you."}</p>
      {tournament?.phase === "open" && qualification && !entered ? <button disabled={pending || mode !== "receiz_live"} onClick={() => onEnterTournament(tournament.id, qualification.grantId)} type="button">Enter tournament</button> : null}
      {entered ? <em>Entered in today&apos;s living bracket.</em> : !qualification ? <em>Complete the qualifying achievement to enter.</em> : null}
    </section>

    <details className="wilds-saga-history">
      <summary>Story so far</summary>
      {continuity.memories.length ? continuity.memories.map((memory) => <p key={memory.settledEventId}><strong>{memory.chapterId}</strong> ended in {memory.outcome}; it left {memory.hookId} in the world.</p>) : <p>The first shared chapter is being written now.</p>}
    </details>
  </section>;
}
