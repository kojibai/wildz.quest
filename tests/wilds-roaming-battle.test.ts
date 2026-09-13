import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard, evolvePortableCard, type PortableCardAsset } from "../src/features/play/portable-card";
import { replayWildsRoamingBattle, createWildsRoamingBattle, chooseWildsRoamingDefenderIntent, submitWildsRoamingBattleIntent, projectWildsRoamingBattleReport, WILDS_ROAMING_BATTLE_MAX_TURNS, type WildsRoamingBattle, type WildsRoamingBattleIntent } from "../src/features/play/wilds-roaming-battle";
const at = "2026-09-13T12:00:00.000Z";
function card(formId: string, ownerReceizId: string, encounterId: string) {
  const family = formId.slice(0, -2);
  let asset: PortableCardAsset = sealCollectedCard({ formId: `${family}-1`, ownerReceizId, encounterId, capturedAt: at });
  for (let stage = 2; stage <= Number(formId.at(-1)); stage++) asset = evolvePortableCard({ previous: asset, nextFormId: `${family}-${stage}`, evolvedAt: at });
  return asset;
}
function fixture(challengerForm = "voltray-3", defenderForm = "voltray-1", maxTurns?: number) {
  const challengerAsset = card(challengerForm, "challenger", "challenger-card");
  const defenderAsset = card(defenderForm, "defender", "defender-card");
  const assets = { challengerAsset, defenderAsset };
  const session = createWildsRoamingBattle({ ...assets, challengerId: "challenger", defenderId: "defender", sessionId: "roaming:test", kaiUPulse: 100, at, maxTurns });
  return { assets, session };
}
function command(session: WildsRoamingBattle, assets: ReturnType<typeof fixture>["assets"], intent: WildsRoamingBattleIntent = { type: "ability", slot: 1 }) {
  return { ...assets, sessionId: session.sessionId, actorId: session.challengerId, expectedTurn: session.battle.turn,
    expectedRevision: session.revision, intentId: `intent:${session.revision}`, intent, kaiUPulse: session.kaiUPulse + 1, at };
}
function finish(input: ReturnType<typeof fixture>) {
  let session = input.session;
  while (session.outcome === "active") session = submitWildsRoamingBattleIntent(session, command(session, input.assets));
  return session;
}
test("both creatures fight from verified cards; either side can win without changing ownership", () => {
  const stronger = fixture();
  const won = finish(stronger);
  assert.equal(won.outcome, "capture-eligible");
  assert.ok(won.battle.transcript.length > 0);
  assert.equal(stronger.assets.defenderAsset.manifest.ownerReceizId, "defender");
  assert.equal(won.defenderId, "defender");
  const lost = finish(fixture("voltray-1", "voltray-3"));
  assert.equal(lost.outcome, "defended");
  assert.equal(lost.battle.winnerId, "defender");
  assert.ok(lost.battle.transcript.some(turn => turn.actions.some(action => action.playerId === "defender" && action.damage > 0)));
  const report = projectWildsRoamingBattleReport(won);
  assert.equal(report.length, won.battle.transcript.reduce((count, turn) => count + turn.actions.length, 0) + 1);
  assert.match(report.at(-1)!, /ownership has not changed/);
  assert.ok(Object.isFrozen(won.battle.players.defender.card.stats));
});
test("defense precommits from the same prior state regardless of the challenger move", () => {
  const { session, assets } = fixture();
  const expected = chooseWildsRoamingDefenderIntent(session);
  const attack = submitWildsRoamingBattleIntent(session, command(session, assets, { type: "ability", slot: 0 }));
  const guard = submitWildsRoamingBattleIntent(session, command(session, assets, { type: "guard" }));
  assert.deepEqual(attack.commands[0].defenderIntent, expected);
  assert.deepEqual(guard.commands[0].defenderIntent, expected);
  assert.equal(session.battle.transcript.length, 0);
  assert.deepEqual(submitWildsRoamingBattleIntent(session, command(session, assets, { type: "guard" })), guard);
});
test("same intent recovers once; conflicting IDs, stale rounds, clocks, and foreign actors reject", () => {
  const { session, assets } = fixture();
  const first = command(session, assets);
  const next = submitWildsRoamingBattleIntent(session, first);
  assert.equal(submitWildsRoamingBattleIntent(next, first), next);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...first, intent: { type: "guard" } }), /intent_conflict/);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...first, intentId: "new" }), /stale_turn/);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...command(next, assets), kaiUPulse: 0 }), /clock_stale/);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...command(next, assets), actorId: "defender" }), /actor_invalid/);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...command(next, assets), sessionId: "other" }), /session_mismatch/);
  assert.throws(() => submitWildsRoamingBattleIntent(next, { ...command(next, assets), intent: { type: "ability", slot: 4 } as never }), /intent_invalid/);
});
test("retreat, timeout, and a bounded draw cannot become captures", () => {
  for (const type of ["retreat", "timeout"] as const) {
    const { session, assets } = fixture();
    const request = command(session, assets, { type });
    const ended = submitWildsRoamingBattleIntent(session, request);
    assert.equal(ended.outcome, type === "retreat" ? "retreated" : "timed-out");
    assert.equal(ended.battle.transcript.length, 0);
    assert.equal(ended.defenderId, "defender");
    assert.equal(submitWildsRoamingBattleIntent(ended, request), ended);
    assert.throws(() => submitWildsRoamingBattleIntent(ended, command(ended, assets)), /not_active/);
  }
  const { session, assets } = fixture("voltray-3", "voltray-3", 1);
  const draw = submitWildsRoamingBattleIntent(session, command(session, assets, { type: "guard" }));
  assert.equal(draw.outcome, "draw");
  assert.equal(draw.battle.winnerId, null);
  assert.throws(() => fixture("voltray-1", "voltray-1", WILDS_ROAMING_BATTLE_MAX_TURNS + 1), /turn_limit_invalid/);
});
test("self battles, unverified stats, duplicate assets, and changed card proofs are rejected", () => {
  const { session, assets } = fixture();
  assert.throws(() => createWildsRoamingBattle({ ...assets, challengerId: "@challenger", defenderId: "challenger.receiz.id", sessionId: "self", kaiUPulse: 1, at }), /actors_invalid/);
  const forgedSession = structuredClone(session);
  forgedSession.battle.players.challenger.card.stats.power += 1000;
  assert.throws(() => submitWildsRoamingBattleIntent(forgedSession, command(session, assets)), /battle_card_invalid/);
  const tampered = structuredClone(assets.challengerAsset);
  tampered.manifest.stats.power += 1000;
  assert.throws(() => submitWildsRoamingBattleIntent(session, { ...command(session, assets), challengerAsset: tampered }), /verification_failed/);
  assert.throws(() => submitWildsRoamingBattleIntent(session, { ...command(session, assets), defenderAsset: assets.challengerAsset }), /same_asset/);
  const changed = evolvePortableCard({ previous: assets.defenderAsset, nextFormId: "voltray-2", evolvedAt: at });
  assert.throws(() => submitWildsRoamingBattleIntent(session, { ...command(session, assets), defenderAsset: changed }), /proof_changed/);
});
test("descriptive wall-clock text cannot steer deterministic combat", () => {
  const { session, assets } = fixture();
  const other = createWildsRoamingBattle({ ...assets, challengerId: "challenger", defenderId: "defender", sessionId: session.sessionId, kaiUPulse: 100, at: "2027-01-01T00:00:00.000Z" });
  assert.deepEqual(other.battle, session.battle);
  assert.deepEqual(chooseWildsRoamingDefenderIntent(other), chooseWildsRoamingDefenderIntent(session));
});

test("transported winners and reports are independently replayed instead of trusted", () => {
  const input = fixture();
  const won = finish(input);
  assert.deepEqual(replayWildsRoamingBattle(JSON.parse(JSON.stringify(won)), input.assets), won);
  const forged = structuredClone(won);
  forged.battle.players.defender.hp = 1;
  assert.throws(() => replayWildsRoamingBattle(forged, input.assets), /replay_mismatch/);
  const forgedDefense = structuredClone(won);
  Object.assign(forgedDefense.commands[0], { defenderIntent: { type: "timeout" } });
  assert.throws(() => replayWildsRoamingBattle(forgedDefense, input.assets), /replay_mismatch/);
  const forgedWin = structuredClone(input.session);
  Object.assign(forgedWin, { outcome: "capture-eligible" });
  assert.throws(() => replayWildsRoamingBattle(forgedWin, input.assets), /replay_mismatch/);
});

test("gameplay accepts an admitted current keeper without rewriting the birth owner", () => {
  const { assets } = fixture();
  const session = createWildsRoamingBattle({ ...assets, challengerId: "challenger", defenderId: "current_keeper", sessionId: "current-keeper", kaiUPulse: 100, at });
  assert.equal(session.defenderId, "current_keeper");
  assert.equal(assets.defenderAsset.manifest.ownerReceizId, "defender");
});
