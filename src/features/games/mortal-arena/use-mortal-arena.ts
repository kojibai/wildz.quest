"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { creatureForm } from "../../play/creature-catalog";
import { isLivingCardAsset } from "../../play/living-card-types";
import { currentRevision } from "../../play/living-card-proof";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../play/portable-card";
import { emptyAdventureCondition, type AdventureCardCondition } from "../../play/adventure/card-condition";
import { projectArenaFighter } from "../../play/arena/card-fighter";
import { createArenaLivingRevision } from "../../play/arena/living-revision";
import { advanceArenaNpc, createArenaNpc, stepArenaNpc } from "./npc-controller";
import { advanceArenaPath, projectCampaignOpponent, restoreArenaPath, type WildzArenaPath } from "./campaign";
import { MORTAL_ARENA_MODULE } from "./module";
import { projectMortalityWarning } from "./mortality";
import { createArenaSettlement, recoverArenaSettlement, type ArenaSettlement } from "./settlement";
import type { ArenaAffinity, MortalArenaInput, MortalArenaResult, MortalArenaSetup, MortalArenaState } from "./types";

const PATH_KEY = "wildz:mortal-arena:path:v1";

function affinityFor(card: PortableCardAsset): ArenaAffinity {
  const element = creatureForm(card.manifest.formId)?.element;
  return element === "Grove" || element === "Spark" || element === "Tide" || element === "Ember" || element === "Prism" || element === "Stone" ? element : "Prism";
}

function arenaConditionFor(card: PortableCardAsset): AdventureCardCondition {
  if (!isLivingCardAsset(card)) return emptyAdventureCondition(card.id);
  const revision = currentRevision(card);
  const life = revision.growth.life;
  if (!life) return emptyAdventureCondition(card.id);
  const vitalityRatio = life.vitality / Math.max(1, life.maxVitality);
  const retired = Boolean(life.retired);
  const base = emptyAdventureCondition(card.id);
  return {
    ...base,
    life: retired ? "dead" : "alive",
    fatigue: retired ? 100 : Math.max(0, Math.min(100, Math.round((1 - vitalityRatio) * 78))),
    injuries: life.injuries.slice(-12).map((injuryId, index) => ({
      id: `arena-injury-${sha256PortableBasis(injuryId).slice(7, 19)}`,
      kind: "guard" as const,
      severity: (vitalityRatio <= .2 ? 3 : vitalityRatio <= .5 ? 2 : 1) as 1 | 2 | 3,
      sourceEventId: `life-event-${index + 1}`
    })),
    recovery: { state: "stable", trauma: retired ? 100 : Math.max(0, Math.min(100, Math.round((1 - vitalityRatio) * 92))), lastEventId: life.eventIds.at(-1) ?? null },
    ...(retired ? {
      retiredAt: revision.sealedAt,
      retirementCauseEventId: life.eventIds.at(-1) ?? "mortal-arena-retirement"
    } : {})
  };
}

function receizArenaProjection(card: PortableCardAsset) {
  const revision = createArenaLivingRevision({
    assetId: card.id,
    eventId: "wildz-arena-admission",
    rulesetId: "receiz-wilds-arena-v105",
    occurredAt: card.proof.sealedAt,
    condition: arenaConditionFor(card),
    scarIds: [],
    relationshipIds: [],
    achievementIds: [],
    evolutionIds: [],
    matchReceiptDigests: []
  });
  return projectArenaFighter(card, revision);
}

function fighterFor(card: PortableCardAsset) {
  const revision = isLivingCardAsset(card) ? currentRevision(card) : null;
  const life = revision?.growth.life;
  const lifeRatio = life ? life.vitality / Math.max(1, life.maxVitality) : 1;
  const projected = receizArenaProjection(card);
  return {
    creatureId: card.id,
    affinity: affinityFor(card),
    vitality: Math.max(1, Math.round(1_000 * lifeRatio)),
    power: Math.max(92, projected.stats.power * 2),
    guard: Math.max(80, projected.stats.guard * 2),
    speed: Math.max(82, Math.round(projected.moveSpeed * 24))
  };
}

function setupFor(roster: readonly PortableCardAsset[], path: WildzArenaPath): { setup: MortalArenaSetup; opponent: ReturnType<typeof projectCampaignOpponent> } {
  const opponent = projectCampaignOpponent(path);
  const leader = roster[0]!;
  const matchBasis = { player: leader.manifest.ownerReceizId, proof: leader.proof.digest, stage: path.stage, history: path.history.length };
  const digest = sha256PortableBasis(canonicalPortableCardJson(matchBasis));
  const seed = Number.parseInt(digest.slice(7, 15), 16) >>> 0;
  const base = fighterFor(leader);
  return {
    opponent,
    setup: {
      matchId: `arena:${digest.slice(7, 31)}`,
      seed,
      mortal: true,
      sides: [
        { actorId: leader.manifest.ownerReceizId, fighters: roster.slice(0, 3).map(fighterFor) },
        { actorId: opponent.id, fighters: [{
          creatureId: opponent.id,
          affinity: opponent.affinity,
          vitality: Math.round(1_000 * opponent.vitalityPermille / 1_000),
          power: Math.round(base.power * opponent.powerPermille / 1_000),
          guard: Math.round(base.guard * (opponent.kind === "boss" ? 1.18 : .96)),
          speed: Math.round(base.speed * (opponent.kind === "boss" ? .92 : .98))
        }] }
      ]
    }
  };
}

export function useMortalArena({ active, roster, onCommit }: {
  active: boolean;
  roster: readonly PortableCardAsset[];
  onCommit: (settlement: ArenaSettlement, path: WildzArenaPath) => void;
}) {
  const leader = roster[0]!;
  const initialPath = useMemo(() => typeof window === "undefined" ? restoreArenaPath(null, leader.manifest.ownerReceizId) : restoreArenaPath(window.localStorage.getItem(PATH_KEY), leader.manifest.ownerReceizId), [leader.manifest.ownerReceizId]);
  const initial = useMemo(() => setupFor(roster, initialPath), [initialPath, roster]);
  const [path, setPath] = useState(initialPath);
  const [opponent, setOpponent] = useState(initial.opponent);
  const [state, setState] = useState<MortalArenaState>(() => MORTAL_ARENA_MODULE.create(initial.setup));
  const [settlement, setSettlement] = useState<ArenaSettlement | null>(null);
  const [impactTick, setImpactTick] = useState(0);
  const movementRef = useRef({ x: 0, z: 0 });
  const pulseRef = useRef<Partial<MortalArenaInput>>({});
  const heldRef = useRef<Pick<MortalArenaInput, "guard" | "flee">>({});
  const playerSequence = useRef(0);
  const npcRef = useRef(createArenaNpc({ actorId: initial.opponent.id, tier: initial.opponent.tier, seed: initial.setup.seed ^ 0x9e3779b9 }));
  const npcQueue = useRef<ReturnType<typeof stepArenaNpc>[]>([]);
  const settledMatchRef = useRef<string | null>(null);
  const previousVitalityRef = useRef(state.sides[0].fighters[0]!.vitality + state.sides[1].fighters[0]!.vitality);

  const resetForPath = useCallback((nextPath: WildzArenaPath) => {
    const next = setupFor(roster, nextPath);
    setOpponent(next.opponent);
    setState(MORTAL_ARENA_MODULE.create(next.setup));
    setSettlement(null);
    settledMatchRef.current = null;
    playerSequence.current = 0;
    npcQueue.current = [];
    npcRef.current = createArenaNpc({ actorId: next.opponent.id, tier: next.opponent.tier, seed: next.setup.seed ^ 0x9e3779b9 });
  }, [roster]);

  useEffect(() => {
    if (!active || state.phase === "complete" || settlement) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        let next = current;
        for (let step = 0; step < 2 && next.phase !== "complete"; step += 1) {
          const nextTick = next.tick + 1;
          playerSequence.current += 1;
          const playerInput: MortalArenaInput = {
            moveX: Math.round(movementRef.current.x * 1_000),
            moveZ: Math.round(movementRef.current.z * 1_000),
            ...heldRef.current,
            ...pulseRef.current
          };
          pulseRef.current = {};
          npcQueue.current.push(stepArenaNpc(npcRef.current, next));
          npcRef.current = advanceArenaNpc(npcRef.current);
          const due = npcQueue.current.filter((frame) => frame.atTick <= nextTick);
          npcQueue.current = npcQueue.current.filter((frame) => frame.atTick > nextTick);
          next = MORTAL_ARENA_MODULE.step(next, [
            { actorId: next.sides[0].actorId, sequence: playerSequence.current, atTick: nextTick, input: playerInput },
            ...due.slice(-1)
          ]);
        }
        const vitality = next.sides[0].fighters[next.sides[0].activeIndex]!.vitality + next.sides[1].fighters[next.sides[1].activeIndex]!.vitality;
        if (vitality < previousVitalityRef.current) setImpactTick(next.tick);
        previousVitalityRef.current = vitality;
        return next;
      });
    }, 33);
    return () => window.clearInterval(timer);
  }, [active, settlement, state.phase]);

  useEffect(() => {
    if (!active || state.phase !== "complete" || settledMatchRef.current === state.matchId) return;
    const result = MORTAL_ARENA_MODULE.complete(state);
    if (!result) return;
    settledMatchRef.current = state.matchId;
    const settledCard = roster[state.sides[0].activeIndex] ?? leader;
    const pending = createArenaSettlement({ card: settledCard, result, playerSide: 0, completedAt: new Date().toISOString() });
    const key = `wildz:mortal-arena:settlement:${pending.id}`;
    window.localStorage.setItem(key, JSON.stringify(pending));
    const committed = recoverArenaSettlement(pending);
    window.localStorage.setItem(key, JSON.stringify(committed));
    const nextPath = advanceArenaPath(path, result);
    window.localStorage.setItem(PATH_KEY, JSON.stringify(nextPath));
    setPath(nextPath);
    setSettlement(committed);
    onCommit(committed, nextPath);
  }, [active, leader, onCommit, path, roster, state]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!active) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select, button, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") movementRef.current.z = -1;
      if (key === "s" || key === "arrowdown") movementRef.current.z = 1;
      if (key === "a" || key === "arrowleft") movementRef.current.x = -1;
      if (key === "d" || key === "arrowright") movementRef.current.x = 1;
      if (key === " ") pulseRef.current.light = true;
      if (key === "f") pulseRef.current.focus = true;
      if (key === "q") pulseRef.current.swapTo = (state.sides[0].activeIndex + 1) % state.sides[0].fighters.length;
      if (key === "shift") heldRef.current.guard = true;
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key === "w" || key === "arrowup") && movementRef.current.z < 0) movementRef.current.z = 0;
      if ((key === "s" || key === "arrowdown") && movementRef.current.z > 0) movementRef.current.z = 0;
      if ((key === "a" || key === "arrowleft") && movementRef.current.x < 0) movementRef.current.x = 0;
      if ((key === "d" || key === "arrowright") && movementRef.current.x > 0) movementRef.current.x = 0;
      if (key === "shift") heldRef.current.guard = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active, state.sides]);

  const activeFighter = state.sides[0].fighters[state.sides[0].activeIndex]!;
  const rival = state.sides[1].fighters[state.sides[1].activeIndex]!;
  const result: MortalArenaResult | null = state.phase === "complete" ? MORTAL_ARENA_MODULE.complete(state) : null;
  return {
    state,
    path,
    opponent,
    settlement,
    result,
    impactTick,
    warning: projectMortalityWarning(activeFighter, Math.max(72, rival.power)),
    setMovement: (x: number, z: number) => { movementRef.current = { x, z }; },
    pulse: (input: Partial<MortalArenaInput>) => { pulseRef.current = { ...pulseRef.current, ...input }; },
    hold: (input: "guard" | "flee", activeHold: boolean) => { heldRef.current[input] = activeHold; },
    continuePath: () => resetForPath(path)
  };
}
