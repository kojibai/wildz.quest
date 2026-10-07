"use client";

import { ArrowUpRight, BookOpen, Check, ChevronDown, Compass, Flag, LockKeyhole, Sparkles, Swords, Trophy, Users } from "lucide-react";
import type { WildsSagaProjection } from "./wilds-saga-director";
import { projectSagaReturnContinuity } from "./wilds-saga-achievements";
import type { WildsMissionGraph, WildsMissionNodeProjection } from "./wilds-saga-missions";
import type { WildsTrainerProjection } from "./wilds-saga-trainers";
import type { WildsTournamentProjection } from "./wilds-saga-tournament";
import type { WildsPlayerSagaState } from "./wilds-world-state";
import type { WildsWorldClientMode } from "./use-wilds-world";
import type { WildsActivityEntry } from "./wallet/wilds-activity-history";
import { WildsStoryLedger } from "./WildsStoryLedger";
import { WildsPersonalStory } from "./WildsPersonalStory";
import type { WildsJourneyMemory } from "./wilds-journey";

const ACTION_LABELS = { travel: "Explore route", discover: "Discover", capture: "Find a companion", train: "Train together", battle: "Battle", ecology: "Help the habitat", raid: "Join the raid", social: "Meet the keepers", craft: "Create", tournament: "Enter tournament" } as const;

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
  actionHistory = [],
  journeyMemories = [],
  location,
  onOpenLedger,
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
  actionHistory?: readonly WildsActivityEntry[];
  journeyMemories?: readonly WildsJourneyMemory[];
  location?: { name: string; position: { x: number; z: number } };
  onOpenLedger?: () => void;
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
  const worldMutable = Boolean(recommended?.worldMutable);
  const completedNodes = primaryNodes.filter(node => node.state === "complete");

  return <section className="wilds-saga-panel" aria-label="Living story progression">
    <header>
      <span><small>{"Today's living chapter"}</small><strong>{saga.chapter.title}</strong></span>
      <b>{saga.act.ark}</b>
    </header>
    <p className="wilds-saga-directive">{saga.act.directive}</p>
    <div>
      <div className="wilds-saga-progress-label"><span>Chapter progress</span><strong>{percent}%</strong></div>
      <div className="wilds-progress" role="progressbar" aria-label="Chapter progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
    </div>
    <p className="wilds-saga-live-state" aria-live="polite">
      <Sparkles size={12} aria-hidden="true" />
      {worldMutable
        ? mode === "receiz_live"
          ? "Your next admitted action can still change this Kai day."
          : "Your next action is admitted locally and its shared projection will follow."
        : "This objective is an echo; the shared day has moved on."}
    </p>

    <div className="wilds-saga-grid">
      <article className="wilds-saga-objective">
        <small>Next objective</small>
        <strong>{recommended?.definition.title ?? "The chapter path is complete"}</strong>
        <p>{recommended?.definition.description ?? "Return at the next Kai moment to meet what follows."}</p>
        {recommended ? <button className="wilds-saga-action is-primary" disabled={!worldMutable || pending} onClick={() => onContribute(recommended)} type="button">
          <span><Compass size={17} aria-hidden="true" />{pending ? "Recording your action…" : recommended.state === "complete" ? "Complete" : ACTION_LABELS[recommended.definition.acceptedVerbs[0]!]}</span><ArrowUpRight size={17} aria-hidden="true" />
        </button> : null}
      </article>
      <article>
        <small>Trainer level</small>
        <strong>Level {player?.trainerLevel ?? 1}</strong>
        <p>{player?.trainerXp ?? 0} XP · {player?.achievementGrantIds.length ?? 0} achievements earned</p>
      </article>
      <article className="wilds-saga-cause">
        <small>Why the world changed</small>
        <strong>{continuity.causeSummary}</strong>
        <p>{continuity.greeting}</p>
      </article>
    </div>

    <section className="wilds-saga-trainers" aria-label="Seeded trainers">
      <div className="wilds-saga-section-heading"><Users size={22} aria-hidden="true" /><span><small>World trainers</small><strong>{trainers.length ? "A new challenge awaits" : "The next trainers are arriving"}</strong></span></div>
      {trainers.slice(0, 3).map((trainer) => <article key={trainer.id}>
        <span className="wilds-saga-trainer-emblem" aria-hidden="true"><Swords size={17} /></span>
        <span className="wilds-saga-trainer-name"><strong>{trainer.name}</strong><small>{trainer.locationId} · {trainer.affinity}</small></span>
        <b>Lv. {trainer.challengeLevel}</b>
        <button className="wilds-saga-action is-battle" disabled={!trainer.available} onClick={() => onBattleTrainer(trainer)} type="button"><Swords size={15} aria-hidden="true" />Battle Trainer<ArrowUpRight size={15} aria-hidden="true" /></button>
      </article>)}
    </section>

    <section className="wilds-saga-tournament" aria-label="Daily tournament">
      <div className="wilds-saga-section-heading"><Trophy size={27} aria-hidden="true" /><span><small>Daily tournament</small><strong>{tournament?.name ?? saga.chapter.tournament.name}</strong></span></div>
      <p>{tournament ? `${tournament.phase[0]!.toUpperCase()}${tournament.phase.slice(1)} · ${tournament.entrants.length}/8 entrants` : "Opens during the Purify Ark. Today’s results become part of the world’s story."}</p>
      {tournament?.phase === "open" && qualification && !entered ? <button className="wilds-saga-action is-gold" disabled={pending} onClick={() => onEnterTournament(tournament.id, qualification.grantId)} type="button"><Trophy size={16} aria-hidden="true" />Enter tournament<ArrowUpRight size={16} aria-hidden="true" /></button> : null}
      {entered ? <em><Check size={14} aria-hidden="true" />Entered in today&apos;s living bracket.</em> : !qualification ? <em><LockKeyhole size={14} aria-hidden="true" />Complete the qualifying achievement to enter.</em> : null}
    </section>

    <details className="wilds-saga-history" open>
      <summary><BookOpen size={22} aria-hidden="true" /><span><strong>Story so far</strong><small>Your ledger, chapter progress, and the world’s memory</small></span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="wilds-saga-history-body">
        <WildsPersonalStory playerName={playerName} saga={saga} memories={journeyMemories} activities={actionHistory} location={location} />
        <section aria-label="Today's chapter history">
          <h4>Today’s chapter · {completedNodes.length}/{primaryNodes.length} steps complete</h4>
          <ol className="wilds-saga-timeline">
            {completedNodes.map(node => <li key={node.definition.id}><span className="wilds-saga-timeline-marker" aria-hidden="true"><Check size={12} /></span><div><small className="wilds-saga-history-status">Completed · {node.progress}/{node.target}</small><strong>{node.definition.title}</strong><p>{node.definition.description}</p></div></li>)}
            <li className="is-current"><span className="wilds-saga-timeline-marker" aria-hidden="true"><Flag size={11} /></span><div><small className="wilds-saga-history-status">{recommended ? worldMutable ? "Next step" : "Chapter remembered" : "Chapter path complete"}</small><strong>{recommended?.definition.title ?? saga.chapter.title}</strong><p>{recommended ? `${recommended.definition.description} · ${recommended.progress}/${recommended.target} contributions` : "You completed the chapter path. The world’s next chapter will carry this work forward."}</p></div></li>
          </ol>
        </section>
        <WildsStoryLedger entries={actionHistory} onOpenLedger={onOpenLedger} />
        {continuity.storyMemories.length ? <section aria-label="Remembered chapters"><h4>Chapters remembered</h4><ol className="wilds-saga-timeline">
          {[...continuity.storyMemories].reverse().map(memory => <li key={memory.settledEventId}><span className="wilds-saga-timeline-marker" aria-hidden="true"><BookOpen size={11} /></span><div><small className="wilds-saga-history-status">{memory.label}</small><strong>{memory.title}</strong><p>{memory.detail}</p></div></li>)}
        </ol></section> : <p>Today’s chapter is still unfolding. Its outcome will join the world’s memory when the day settles.</p>}
      </div>
    </details>
  </section>;
}
