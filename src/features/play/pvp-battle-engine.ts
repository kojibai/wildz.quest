import type { CreatureStats } from "./creature-catalog";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type PvpCard = {
  assetId: string;
  proofDigest: string;
  name: string;
  stats: CreatureStats;
  abilities: [{ name: string; power: number }, { name: string; power: number }];
};

export type PvpIntent = { type: "ability"; slot: 0 | 1 } | { type: "guard" } | { type: "timeout" };

export type PvpFighter = {
  playerId: string;
  card: PvpCard;
  hp: number;
  maxHp: number;
  missedTurns: number;
};

export type PvpBattle = {
  schema: "receiz.wilds_pvp_battle.v1";
  id: string;
  challengeId: string;
  seed: string;
  phase: "active" | "settled" | "void";
  turn: number;
  players: Record<string, PvpFighter>;
  playerOrder: [string, string];
  pendingIntents: Record<string, { intent: PvpIntent; intentId: string }>;
  usedIntentIds: string[];
  transcript: Array<{
    turn: number;
    actions: Array<{ playerId: string; type: PvpIntent["type"]; detail: string; damage: number }>;
    digest: string;
  }>;
  winnerId: string | null;
  resultReason: "knockout" | "forfeit" | "draw" | null;
  acceptedAt: string;
  updatedAt: string;
};

export function createPvpBattle(input: {
  challengeId: string;
  playerA: { playerId: string; card: PvpCard };
  playerB: { playerId: string; card: PvpCard };
  acceptedAt: string;
}): PvpBattle {
  const seed = sha256PortableBasis(canonicalPortableCardJson({
    challengeId: input.challengeId,
    proofs: [input.playerA.card.proofDigest, input.playerB.card.proofDigest].sort(),
    acceptedAt: input.acceptedAt
  }));
  return {
    schema: "receiz.wilds_pvp_battle.v1",
    id: `pvp:${seed.slice(7, 31)}`,
    challengeId: input.challengeId,
    seed,
    phase: "active",
    turn: 1,
    players: Object.fromEntries([input.playerA, input.playerB].map(({ playerId, card }) => [playerId, {
      playerId,
      card,
      hp: card.stats.health,
      maxHp: card.stats.health,
      missedTurns: 0
    }])),
    playerOrder: [input.playerA.playerId, input.playerB.playerId],
    pendingIntents: {},
    usedIntentIds: [],
    transcript: [],
    winnerId: null,
    resultReason: null,
    acceptedAt: input.acceptedAt,
    updatedAt: input.acceptedAt
  };
}

function deterministicBonus(battle: PvpBattle, attackerId: string, slot: number) {
  const digest = sha256PortableBasis(`${battle.seed}:${battle.turn}:${attackerId}:${slot}`);
  return Number.parseInt(digest.slice(7, 9), 16) % 5;
}

function resolveTurn(battle: PvpBattle): PvpBattle {
  const [leftId, rightId] = battle.playerOrder;
  const ordered = [leftId, rightId].sort((left, right) => {
    const speed = battle.players[right]!.card.stats.speed - battle.players[left]!.card.stats.speed;
    if (speed) return speed;
    return sha256PortableBasis(`${battle.seed}:${battle.turn}:${left}`).localeCompare(sha256PortableBasis(`${battle.seed}:${battle.turn}:${right}`));
  });
  const players = Object.fromEntries(Object.entries(battle.players).map(([id, player]) => [id, { ...player }]));
  const actions: PvpBattle["transcript"][number]["actions"] = [];
  for (const actorId of ordered) {
    const targetId = actorId === leftId ? rightId : leftId;
    const actor = players[actorId]!;
    const target = players[targetId]!;
    const submitted = battle.pendingIntents[actorId]!;
    const intent = submitted.intent;
    if (actor.hp <= 0) continue;
    if (intent.type === "timeout") {
      actor.missedTurns += 1;
      actions.push({ playerId: actorId, type: "timeout", detail: `${actor.card.name} missed the turn and guarded.`, damage: 0 });
      continue;
    }
    actor.missedTurns = 0;
    if (intent.type === "guard") {
      actions.push({ playerId: actorId, type: "guard", detail: `${actor.card.name} raised its guard.`, damage: 0 });
      continue;
    }
    const opposingIntent = battle.pendingIntents[targetId]!.intent;
    const ability = actor.card.abilities[intent.slot];
    const defense = Math.floor(target.card.stats.guard * (opposingIntent.type === "guard" || opposingIntent.type === "timeout" ? 0.36 : 0.2));
    const damage = Math.max(4, Math.floor(ability.power * 0.5 + actor.card.stats.power * 0.26 + deterministicBonus(battle, actorId, intent.slot) - defense));
    target.hp = Math.max(0, target.hp - damage);
    actions.push({ playerId: actorId, type: "ability", detail: `${actor.card.name} used ${ability.name} for ${damage}.`, damage });
  }

  const forfeiter = battle.playerOrder.find((id) => players[id]!.missedTurns >= 3);
  const conscious = battle.playerOrder.filter((id) => players[id]!.hp > 0);
  const settled = Boolean(forfeiter) || conscious.length < 2;
  const winnerId = forfeiter ? battle.playerOrder.find((id) => id !== forfeiter)! : conscious.length === 1 ? conscious[0]! : null;
  const resultReason = forfeiter ? "forfeit" : conscious.length === 1 ? "knockout" : conscious.length === 0 ? "draw" : null;
  const transcriptEntry = {
    turn: battle.turn,
    actions,
    digest: sha256PortableBasis(canonicalPortableCardJson({ turn: battle.turn, actions, players }))
  };
  return {
    ...battle,
    phase: settled ? "settled" : "active",
    turn: settled ? battle.turn : battle.turn + 1,
    players,
    pendingIntents: {},
    transcript: [...battle.transcript, transcriptEntry],
    winnerId,
    resultReason,
    updatedAt: new Date(Date.parse(battle.acceptedAt) + battle.turn * 1_000).toISOString()
  };
}

export function submitPvpIntent(battle: PvpBattle, actorId: string, intent: PvpIntent, intentId: string): PvpBattle {
  if (battle.phase !== "active") throw new Error("wilds_pvp_not_active");
  if (!battle.players[actorId]) throw new Error("wilds_pvp_actor_invalid");
  if (battle.usedIntentIds.includes(intentId)) throw new Error("wilds_pvp_intent_replayed");
  if (battle.pendingIntents[actorId]) throw new Error("wilds_pvp_intent_already_submitted");
  const pendingIntents = { ...battle.pendingIntents, [actorId]: { intent, intentId } };
  const waiting = { ...battle, pendingIntents, usedIntentIds: [...battle.usedIntentIds, intentId] };
  return battle.playerOrder.every((id) => pendingIntents[id]) ? resolveTurn(waiting) : waiting;
}

export function pvpTranscriptDigest(battle: PvpBattle) {
  return sha256PortableBasis(canonicalPortableCardJson(battle.transcript));
}
