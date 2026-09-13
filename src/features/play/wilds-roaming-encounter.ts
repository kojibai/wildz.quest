import { canonicalPortableCardJson, type PortableCardAsset } from "./portable-card";
import { pvpCardFromAsset } from "./multiplayer-card";
import { parseWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { KAI_PULSE_DURATION_MS } from "./kai-klok-moment";
import { createWildsRoamingBattle, replayWildsRoamingBattle, submitWildsRoamingBattleIntent, type WildsRoamingBattle, type WildsRoamingBattleIntent } from "./wilds-roaming-battle";

export const WILDS_ROAMING_CAPTURE_TTL_UPULSES = Math.ceil(120_000 / KAI_PULSE_DURATION_MS * 1_000_000);
export const WILDS_ROAMING_ENCOUNTER_TTL_UPULSES = Math.ceil(180_000 / KAI_PULSE_DURATION_MS * 1_000_000);
export type WildsRoamingChallenger = Readonly<{ playerId: string; handle: string; receizId: string }>;
export type WildsRoamingEncounterNotice = Readonly<{ id: string; roomKey: string; challengerId: string; defenderId: string; assetId: string; proofDigest: string; expiresKaiUPulse: number }>;
/** Private gameplay replay material; never include this row in atlas/public room state. */
export type WildsRoamingEncounter = Readonly<{
  schema: "wildz.roaming-encounter.v1"; authority: "gameplay-projection";
  id: string; roomKey: string; revision: number; challenger: WildsRoamingChallenger;
  defenderId: string; defenderAssetId: string; defenderProofDigest: string;
  challengerAsset: PortableCardAsset; defenderAsset: PortableCardAsset | null;
  requestedKaiUPulse: number; expiresKaiUPulse: number;
  expeditionId: string | null; session: WildsRoamingBattle | null;
  ownerAcknowledgedRevision: number | null; cancelled: boolean;
  capturePhase?: "ready" | "captured" | "expired";
}>;
function fail(code: string): never { throw new Error(`wilds_roaming_encounter_${code}`); }
function actorId(value: string) { return parseWildzPlayerCoordinate(value)?.actorId ?? fail("actor_invalid"); }
export function roamingEncounterParticipant(row: WildsRoamingEncounter, actor: string) {
  const id = actorId(actor);
  return id === row.challenger.playerId || id === row.defenderId;
}
export function projectWildsRoamingEncounterNotice(row: WildsRoamingEncounter): WildsRoamingEncounterNotice {
  return { id: row.id, roomKey: row.roomKey, challengerId: row.challenger.playerId, defenderId: row.defenderId,
    assetId: row.defenderAssetId, proofDigest: row.defenderProofDigest, expiresKaiUPulse: row.expiresKaiUPulse };
}
export function requestWildsRoamingEncounter(input: {
  id: string; roomKey: string; challenger: WildsRoamingChallenger; challengerAsset: PortableCardAsset;
  defenderId: string; defenderAssetId: string; defenderProofDigest: string; kaiUPulse: number;
}): WildsRoamingEncounter {
  if (!/^[a-zA-Z0-9:-]{8,160}$/.test(input.id) || !Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < 0) fail("request_invalid");
  const challengerId = actorId(input.challenger.playerId);
  const defenderId = actorId(input.defenderId);
  if (challengerId === defenderId || !input.challenger.receizId) fail("actors_invalid");
  pvpCardFromAsset(input.challengerAsset);
  return { schema: "wildz.roaming-encounter.v1", authority: "gameplay-projection", id: input.id,
    roomKey: input.roomKey, revision: 0, challenger: { ...input.challenger, playerId: challengerId }, defenderId,
    defenderAssetId: input.defenderAssetId, defenderProofDigest: input.defenderProofDigest,
    challengerAsset: structuredClone(input.challengerAsset), defenderAsset: null,
    requestedKaiUPulse: input.kaiUPulse, expiresKaiUPulse: input.kaiUPulse + WILDS_ROAMING_ENCOUNTER_TTL_UPULSES,
    expeditionId: null, session: null, ownerAcknowledgedRevision: null, cancelled: false };
}
export function acceptWildsRoamingEncounter(row: WildsRoamingEncounter, input: {
  actorId: string; defenderAsset: PortableCardAsset; expeditionId: string; kaiUPulse: number; at: string;
}): WildsRoamingEncounter {
  if (actorId(input.actorId) !== row.defenderId) fail("owner_required");
  if (!input.expeditionId || input.expeditionId.length > 256) fail("expedition_required");
  if (input.defenderAsset.id !== row.defenderAssetId || input.defenderAsset.proof.digest !== row.defenderProofDigest) fail("proof_changed");
  if (input.kaiUPulse < row.requestedKaiUPulse) fail("clock_stale");
  if (row.cancelled || input.kaiUPulse >= row.expiresKaiUPulse) fail("expired");
  if (row.session) {
    if (row.expeditionId !== input.expeditionId) fail("accept_conflict");
    return row;
  }
  const session = createWildsRoamingBattle({ sessionId: row.id, challengerId: row.challenger.playerId,
    defenderId: row.defenderId, challengerAsset: row.challengerAsset, defenderAsset: input.defenderAsset,
    kaiUPulse: input.kaiUPulse, at: input.at });
  return { ...row, revision: row.revision + 1, defenderAsset: structuredClone(input.defenderAsset), expeditionId: input.expeditionId, session };
}
export function moveWildsRoamingEncounter(row: WildsRoamingEncounter, input: {
  actorId: string; expectedTurn: number; expectedRevision: number; intentId: string;
  intent: WildsRoamingBattleIntent; kaiUPulse: number; at: string;
}): WildsRoamingEncounter {
  if (actorId(input.actorId) !== row.challenger.playerId) fail("challenger_required");
  if (!row.session || !row.defenderAsset || row.cancelled) fail("battle_required");
  if (input.kaiUPulse >= row.expiresKaiUPulse) fail("expired");
  const session = submitWildsRoamingBattleIntent(row.session, { ...input, sessionId: row.id,
    challengerAsset: row.challengerAsset, defenderAsset: row.defenderAsset });
  return session === row.session ? row : { ...row, session, revision: row.revision + 1, ownerAcknowledgedRevision: null };
}
export function expireWildsRoamingEncounter(row: WildsRoamingEncounter, kaiUPulse: number, at: string): WildsRoamingEncounter {
  if (row.session?.outcome === "capture-eligible" && row.capturePhase !== "captured" && row.capturePhase !== "expired"
    && kaiUPulse >= row.session.kaiUPulse + WILDS_ROAMING_CAPTURE_TTL_UPULSES) return { ...row, revision: row.revision + 1, capturePhase: "expired" };
  if (kaiUPulse < row.expiresKaiUPulse || row.cancelled || (row.session && row.session.outcome !== "active")) return row;
  if (!row.session || !row.defenderAsset) return { ...row, cancelled: true, revision: row.revision + 1 };
  const session = submitWildsRoamingBattleIntent(row.session, { sessionId: row.id, actorId: row.challenger.playerId,
    challengerAsset: row.challengerAsset, defenderAsset: row.defenderAsset, expectedRevision: row.session.revision,
    expectedTurn: row.session.battle.turn, intentId: `expiry:${row.id}`, intent: { type: "timeout" }, kaiUPulse, at });
  return { ...row, session, revision: row.revision + 1 };
}
export function acknowledgeWildsRoamingEncounter(row: WildsRoamingEncounter, input: {
  actorId: string; expectedRevision: number; expeditionId: string;
}): WildsRoamingEncounter {
  if (actorId(input.actorId) !== row.defenderId) fail("owner_required");
  if (!row.session || !row.defenderAsset || row.session.outcome === "active") fail("outcome_required");
  if (input.expectedRevision !== row.session.revision || input.expeditionId !== row.expeditionId) fail("stale_outcome");
  replayWildsRoamingBattle(row.session, { challengerAsset: row.challengerAsset, defenderAsset: row.defenderAsset });
  return row.ownerAcknowledgedRevision === row.session.revision ? row
    : { ...row, revision: row.revision + 1, ownerAcknowledgedRevision: row.session.revision };
}
export function cancelWildsRoamingEncounter(row: WildsRoamingEncounter, actor: string): WildsRoamingEncounter {
  if (!roamingEncounterParticipant(row, actor)) fail("participant_required");
  if (row.session) fail("battle_active");
  return row.cancelled ? row : { ...row, cancelled: true, revision: row.revision + 1 };
}
/** Transport recovery must extend known commands. Equal-revision forks fail closed. */
export function admitWildsRoamingEncounter(prior: WildsRoamingEncounter | undefined, incoming: WildsRoamingEncounter): WildsRoamingEncounter {
  if (incoming.schema !== "wildz.roaming-encounter.v1" || incoming.authority !== "gameplay-projection"
    || !Number.isSafeInteger(incoming.revision) || incoming.revision < 0 || incoming.revision > 40) fail("record_invalid");
  if (incoming.session) {
    if (!incoming.defenderAsset || incoming.session.sessionId !== incoming.id) fail("record_invalid");
    replayWildsRoamingBattle(incoming.session, { challengerAsset: incoming.challengerAsset, defenderAsset: incoming.defenderAsset });
  }
  if (!prior) return incoming;
  const fixed = (row: WildsRoamingEncounter) => [row.id, row.roomKey, row.challenger, row.challengerAsset, row.defenderId, row.defenderAssetId, row.defenderProofDigest, row.requestedKaiUPulse, row.expiresKaiUPulse];
  if (canonicalPortableCardJson(fixed(prior)) !== canonicalPortableCardJson(fixed(incoming))) fail("genesis_conflict");
  if (incoming.revision < prior.revision) return prior;
  if (incoming.revision === prior.revision) {
    if (canonicalPortableCardJson(prior) !== canonicalPortableCardJson(incoming)) fail("revision_conflict");
    return prior;
  }
  const battleGenesis = (session: WildsRoamingBattle) => canonicalPortableCardJson([session.sessionId, session.challengerId, session.defenderId, session.startedKaiUPulse, session.startedAt, session.maxTurns]);
  if (prior.session && incoming.session && battleGenesis(prior.session) !== battleGenesis(incoming.session)) fail("history_conflict");
  if (prior.session && prior.session.outcome !== "active" && canonicalPortableCardJson(prior.session) !== canonicalPortableCardJson(incoming.session)) fail("history_conflict");
  if (prior.session && (!incoming.session || prior.expeditionId !== incoming.expeditionId
    || canonicalPortableCardJson(prior.session.commands) !== canonicalPortableCardJson(incoming.session.commands.slice(0, prior.session.commands.length)))) fail("history_conflict");
  return incoming;
}

/** Exact finish-relative capture deadline; active network outages use the maximum possible finish window. */
export function wildsRoamingEncounterHoldExpiry(row: WildsRoamingEncounter) {
  return row.session?.outcome === "capture-eligible" ? row.session.kaiUPulse + WILDS_ROAMING_CAPTURE_TTL_UPULSES
    : row.expiresKaiUPulse + WILDS_ROAMING_CAPTURE_TTL_UPULSES;
}

/** Keep a won artifact recoverable until the challenger has actually restored it. */
export function shouldPollWildsRoamingEncounter(row: WildsRoamingEncounter, selfId: string, reportRecorded: boolean, captureRestored: boolean) {
  if (row.cancelled) return false;
  if (!reportRecorded) return true;
  if (row.capturePhase === "expired") return false;
  if (row.capturePhase === "captured") return actorId(selfId) === row.challenger.playerId && !captureRestored;
  if (row.session && row.session.outcome !== "active" && row.session.outcome !== "capture-eligible") {
    return actorId(selfId) === row.defenderId && row.ownerAcknowledgedRevision !== row.session.revision;
  }
  return true;
}
