import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { kaiUPulseToISOString } from "./kai-klok-moment";
import { pvpCardFromAsset } from "./multiplayer-card";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { createPvpBattle, submitPvpIntent, type PvpBattle, type PvpIntent } from "./pvp-battle-engine";

export const WILDS_ROAMING_BATTLE_MAX_TURNS = 32;
export type WildsRoamingBattleIntent = PvpIntent | { type: "retreat" };
export type WildsRoamingBattleOutcome = "active" | "capture-eligible" | "defended" | "retreated" | "timed-out" | "draw";
type Assets = { challengerAsset: PortableCardAsset; defenderAsset: PortableCardAsset };
export type WildsRoamingBattle = Readonly<{
  schema: "wildz.roaming-battle.v1";
  /** Gameplay only. A win is never an ownership or custody receipt. */
  authority: "gameplay-projection";
  sessionId: string;
  challengerId: string;
  defenderId: string;
  revision: number;
  kaiUPulse: number;
  at: string;
  startedKaiUPulse: number;
  startedAt: string;
  maxTurns: number;
  outcome: WildsRoamingBattleOutcome;
  battle: PvpBattle;
  commands: readonly Readonly<{ intentId: string; fingerprint: string; defenderIntent: PvpIntent | null; intent: WildsRoamingBattleIntent; kaiUPulse: number; at: string }>[];
}>;
export type WildsRoamingBattleCommand = Assets & {
  sessionId: string; actorId: string; expectedTurn: number; expectedRevision: number;
  intentId: string; intent: WildsRoamingBattleIntent; kaiUPulse: number; at: string;
};
function fail(code: string): never { throw new Error(`wilds_roaming_battle_${code}`); }
const validId = (value: string) => typeof value === "string" && value.length > 0 && value.length <= 256;
function clock(kaiUPulse: number, at: string) {
  if (!Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0 || typeof at !== "string" || !Number.isFinite(Date.parse(at))) fail("clock_invalid");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
// Current custody is admitted by the coordinator from native/Vault evidence.
// Immutable card manifests retain their original owner after an actual transfer.
function cards(input: Assets) {
  if (input.challengerAsset.id === input.defenderAsset.id) fail("same_asset");
  return [pvpCardFromAsset(input.challengerAsset), pvpCardFromAsset(input.defenderAsset)] as const;
}

export function createWildsRoamingBattle(input: Assets & {
  sessionId: string; challengerId: string; defenderId: string; kaiUPulse: number; at: string; maxTurns?: number;
}): WildsRoamingBattle {
  if (!validId(input.sessionId)) fail("session_invalid");
  clock(input.kaiUPulse, input.at);
  const challengerId = parseWildzPlayerCoordinate(input.challengerId)?.actorId;
  const defenderId = parseWildzPlayerCoordinate(input.defenderId)?.actorId;
  if (!challengerId || !defenderId || challengerId === defenderId) fail("actors_invalid");
  const maxTurns = input.maxTurns ?? WILDS_ROAMING_BATTLE_MAX_TURNS;
  if (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > WILDS_ROAMING_BATTLE_MAX_TURNS) fail("turn_limit_invalid");
  const [challenger, defender] = cards(input);
  // ISO is descriptive only: the engine's deterministic seed comes from admitted Kai time.
  const battle = createPvpBattle({ challengeId: input.sessionId,
    playerA: { playerId: challengerId, card: structuredClone(challenger) },
    playerB: { playerId: defenderId, card: structuredClone(defender) }, acceptedAt: kaiUPulseToISOString(input.kaiUPulse) });
  return freeze({ schema: "wildz.roaming-battle.v1", authority: "gameplay-projection", sessionId: input.sessionId,
    challengerId, defenderId, revision: 0, kaiUPulse: input.kaiUPulse, at: input.at,
    startedKaiUPulse: input.kaiUPulse, startedAt: input.at, maxTurns, outcome: "active", battle, commands: [] });
}

/** Precommit defense from the prior turn alone. No challenger intent is accepted. */
export function chooseWildsRoamingDefenderIntent(session: WildsRoamingBattle): PvpIntent {
  if (session.outcome !== "active" || Object.keys(session.battle.pendingIntents).length) fail("not_active");
  const defender = session.battle.players[session.defenderId]!;
  const digest = sha256PortableBasis(`${session.battle.seed}:${session.battle.turn}:${defender.card.proofDigest}:${defender.hp}`);
  const choice = Number.parseInt(digest.slice(7, 9), 16);
  return choice % 5 === 0 ? { type: "guard" } : { type: "ability", slot: choice % 2 as 0 | 1 };
}
function validIntent(intent: WildsRoamingBattleIntent) {
  if (!intent || typeof intent !== "object") return false;
  return intent.type === "ability" ? (intent.slot === 0 || intent.slot === 1) && Object.keys(intent).length === 2
    : ["guard", "timeout", "retreat"].includes(intent.type) && Object.keys(intent).length === 1;
}
/** Load the prior session from the coordinator's own store, never a client-supplied
 * snapshot. This pure projection neither signs nor authorizes custody changes. */
export function submitWildsRoamingBattleIntent(session: WildsRoamingBattle, input: WildsRoamingBattleCommand): WildsRoamingBattle {
  if (input.sessionId !== session.sessionId) fail("session_mismatch");
  if (!sameWildzPlayerCoordinate(input.actorId, session.challengerId)) fail("actor_invalid");
  if (!validId(input.intentId) || !validIntent(input.intent)) fail("intent_invalid");
  clock(input.kaiUPulse, input.at);
  const [challenger, defender] = cards(input);
  for (const [id, card] of [[session.challengerId, challenger], [session.defenderId, defender]] as const) {
    const pinned = session.battle.players[id]!.card;
    if (pinned.assetId !== card.assetId || pinned.proofDigest !== card.proofDigest) fail("proof_changed");
    if (canonicalPortableCardJson(pinned) !== canonicalPortableCardJson(card)) fail("battle_card_invalid");
  }
  const fingerprint = sha256PortableBasis(canonicalPortableCardJson({ sessionId: input.sessionId, actorId: session.challengerId,
    expectedTurn: input.expectedTurn, expectedRevision: input.expectedRevision, intent: input.intent, kaiUPulse: input.kaiUPulse }));
  const duplicate = session.commands.find(command => command.intentId === input.intentId);
  if (duplicate) {
    if (duplicate.fingerprint !== fingerprint) fail("intent_conflict");
    return session;
  }
  if (session.outcome !== "active") fail("not_active");
  if (input.expectedRevision !== session.revision || input.expectedTurn !== session.battle.turn) fail("stale_turn");
  if (input.kaiUPulse < session.kaiUPulse) fail("clock_stale");
  let battle = session.battle;
  let outcome: WildsRoamingBattleOutcome;
  let defenderIntent: PvpIntent | null = null;
  if (input.intent.type === "retreat" || input.intent.type === "timeout") {
    outcome = input.intent.type === "retreat" ? "retreated" : "timed-out";
    battle = { ...battle, phase: "settled", winnerId: session.defenderId, resultReason: "forfeit", updatedAt: kaiUPulseToISOString(input.kaiUPulse) };
  } else {
    defenderIntent = chooseWildsRoamingDefenderIntent(session);
    const committed = submitPvpIntent(battle, session.defenderId, defenderIntent, `defender:${session.revision}`);
    battle = submitPvpIntent(committed, session.challengerId, input.intent, `challenger:${session.revision}`);
    outcome = battle.phase === "active" ? "active" : battle.winnerId === session.challengerId ? "capture-eligible" : battle.winnerId === session.defenderId ? "defended" : "draw";
    if (outcome === "active" && battle.transcript.length >= session.maxTurns) {
      outcome = "draw";
      battle = { ...battle, phase: "settled", winnerId: null, resultReason: "draw" };
    }
  }
  return freeze({ ...session, battle, outcome, revision: session.revision + 1, kaiUPulse: input.kaiUPulse, at: input.at,
    commands: [...session.commands, { intentId: input.intentId, fingerprint, defenderIntent, intent: structuredClone(input.intent), kaiUPulse: input.kaiUPulse, at: input.at }] });
}

export function projectWildsRoamingBattleReport(session: WildsRoamingBattle): readonly string[] {
  const events = session.battle.transcript.flatMap(turn => turn.actions.map(action => `Turn ${turn.turn}: ${action.detail}`));
  const endings: Record<WildsRoamingBattleOutcome, string> = {
    active: "The battle continues.", "capture-eligible": "The challenger won. Capture is eligible; ownership has not changed.",
    defended: "The roaming creature won and remains with its owner.", retreated: "The challenger retreated. Ownership is unchanged.",
    "timed-out": "The challenge timed out. Ownership is unchanged.", draw: "The battle ended in a draw. Ownership is unchanged."
  };
  return [...events, endings[session.outcome]];
}

/** Rebuild a transported game projection from its pinned genesis and legal commands.
 * This verifies gameplay, not custody or permission to start an encounter. Callers
 * must bind genesis to their own accepted expedition before offering an artifact. */
export function replayWildsRoamingBattle(value: WildsRoamingBattle, assets: Assets): WildsRoamingBattle {
  if (!value || value.schema !== "wildz.roaming-battle.v1" || !Array.isArray(value.commands)
    || value.commands.length > WILDS_ROAMING_BATTLE_MAX_TURNS) fail("replay_invalid");
  let replay = createWildsRoamingBattle({ ...assets, sessionId: value.sessionId,
    challengerId: value.challengerId, defenderId: value.defenderId,
    kaiUPulse: value.startedKaiUPulse, at: value.startedAt, maxTurns: value.maxTurns });
  for (const command of value.commands) {
    replay = submitWildsRoamingBattleIntent(replay, { ...assets, sessionId: replay.sessionId,
      actorId: replay.challengerId, expectedTurn: replay.battle.turn, expectedRevision: replay.revision,
      intentId: command.intentId, intent: command.intent, kaiUPulse: command.kaiUPulse, at: command.at });
  }
  if (canonicalPortableCardJson(replay) !== canonicalPortableCardJson(value)) fail("replay_mismatch");
  return replay;
}

/** Keep only the last exact replay input for one accepted encounter. Identical
 * polling responses need no second combat replay; changed bytes always reverify.
 * This cache supplies no custody authority and never returns mutable proof data. */
export function createWildsRoamingBattleVerifier() {
  let verifiedInput: string | undefined;
  return (value: WildsRoamingBattle, assets: Assets): void => {
    const input = canonicalPortableCardJson([value, assets]);
    if (input === verifiedInput) return;
    replayWildsRoamingBattle(value, assets);
    verifiedInput = input;
  };
}
