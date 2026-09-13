import test from "node:test";
import assert from "node:assert/strict";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { shouldPollWildsRoamingEncounter, wildsRoamingEncounterHoldExpiry, WILDS_ROAMING_CAPTURE_TTL_UPULSES, acceptWildsRoamingEncounter, acknowledgeWildsRoamingEncounter, admitWildsRoamingEncounter, expireWildsRoamingEncounter, moveWildsRoamingEncounter, projectWildsRoamingEncounterNotice, requestWildsRoamingEncounter } from "../src/features/play/wilds-roaming-encounter";
import { openWildsRoamingTransport, sealWildsRoamingTransport } from "../src/lib/receiz/wilds-roaming-transport-integrity";
import { readWildsRoamingEncounter, publishWildsRoamingEncounter, storeWildsRoamingEncounter } from "../src/lib/receiz/wilds-roaming-battle-server";
import { NextRequest } from "next/server";

const at = "2026-09-13T12:00:00.000Z";
function fixture(suffix = "test") {
  const challengerAsset = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "challenger", encounterId: `challenger:${suffix}`, capturedAt: at });
  const defenderAsset = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "defender", encounterId: `defender:${suffix}`, capturedAt: at });
  const row = requestWildsRoamingEncounter({ id: `roaming:${suffix}`, roomKey: "wilds:platform:0:0", challenger: { playerId: "challenger", handle: "challenger", receizId: "native-challenger" }, challengerAsset,
    defenderId: "defender", defenderAssetId: defenderAsset.id, defenderProofDigest: defenderAsset.proof.digest, kaiUPulse: 100 });
  return { row, defenderAsset };
}
test("only owner admits exact roaming creature and challenger cannot move before acceptance", () => {
  const { row, defenderAsset } = fixture();
  const command = { actorId: "challenger", expectedRevision: 0, expectedTurn: 1, intentId: "move:1", intent: { type: "guard" as const }, kaiUPulse: 110, at };
  assert.throws(() => moveWildsRoamingEncounter(row, command), /battle_required/);
  assert.throws(() => acceptWildsRoamingEncounter(row, { actorId: "challenger", defenderAsset, expeditionId: "route:1", kaiUPulse: 110, at }), /owner_required/);
  assert.throws(() => acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset: row.challengerAsset, expeditionId: "route:1", kaiUPulse: 110, at }), /proof_changed/);
  const accepted = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:1", kaiUPulse: 110, at });
  const moved = moveWildsRoamingEncounter(accepted, { ...command, expectedTurn: accepted.session!.battle.turn });
  assert.equal(moved.session!.battle.transcript.length, 1);
  assert.deepEqual(projectWildsRoamingEncounterNotice(moved), projectWildsRoamingEncounterNotice(row));
  assert.equal(JSON.stringify(projectWildsRoamingEncounterNotice(moved)).includes("manifest"), false);
  assert.throws(() => acceptWildsRoamingEncounter(accepted, { actorId: "defender", defenderAsset, expeditionId: "different", kaiUPulse: 111, at }), /accept_conflict/);
});
test("owner acknowledgment requires a real completed replay and exact accepted expedition", () => {
  const { row, defenderAsset } = fixture();
  const accepted = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:1", kaiUPulse: 110, at });
  assert.throws(() => acknowledgeWildsRoamingEncounter(accepted, { actorId: "defender", expectedRevision: 0, expeditionId: "route:1" }), /outcome_required/);
  const ended = moveWildsRoamingEncounter(accepted, { actorId: "challenger", expectedRevision: 0, expectedTurn: accepted.session!.battle.turn, intentId: "retreat:1", intent: { type: "retreat" }, kaiUPulse: 120, at });
  assert.throws(() => acknowledgeWildsRoamingEncounter(ended, { actorId: "challenger", expectedRevision: 1, expeditionId: "route:1" }), /owner_required/);
  assert.throws(() => acknowledgeWildsRoamingEncounter(ended, { actorId: "defender", expectedRevision: 1, expeditionId: "wrong" }), /stale_outcome/);
  const ack = acknowledgeWildsRoamingEncounter(ended, { actorId: "defender", expectedRevision: 1, expeditionId: "route:1" });
  assert.equal(ack.ownerAcknowledgedRevision, 1);
  const forged = { ...ended, session: { ...ended.session!, outcome: "capture-eligible" as const } };
  assert.throws(() => acknowledgeWildsRoamingEncounter(forged, { actorId: "defender", expectedRevision: 1, expeditionId: "route:1" }), /replay_mismatch/);
});
test("fixed Kai expiry ends waiting and active encounters without extending on moves", () => {
  const { row, defenderAsset } = fixture();
  assert.equal(expireWildsRoamingEncounter(row, row.expiresKaiUPulse - 1, at), row);
  assert.equal(expireWildsRoamingEncounter(row, row.expiresKaiUPulse, at).cancelled, true);
  const accepted = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:1", kaiUPulse: 110, at });
  const expired = expireWildsRoamingEncounter(accepted, row.expiresKaiUPulse, at);
  assert.equal(expired.session?.outcome, "timed-out");
  assert.equal(expired.expiresKaiUPulse, row.expiresKaiUPulse);
  assert.equal(expired.ownerAcknowledgedRevision, null);
});
test("recovery preserves local descendants and rejects conflicting same revision or genesis", () => {
  const { row, defenderAsset } = fixture();
  const accepted = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:1", kaiUPulse: 110, at });
  assert.equal(admitWildsRoamingEncounter(accepted, row), accepted);
  assert.throws(() => admitWildsRoamingEncounter(accepted, { ...accepted, ownerAcknowledgedRevision: 2 }), /revision_conflict/);
  assert.throws(() => admitWildsRoamingEncounter(accepted, { ...accepted, requestedKaiUPulse: 0 }), /genesis_conflict/);
});
test("purpose-bound private transport rejects tampered or unsigned gameplay and cross-purpose seals", () => {
  const { row } = fixture();
  const secret = "test-only-roaming-secret-at-least-32-bytes";
  const sealed = sealWildsRoamingTransport(row, "encounter", secret);
  assert.deepEqual(openWildsRoamingTransport(sealed, "encounter", secret), row);
  assert.throws(() => openWildsRoamingTransport(row, "encounter", secret), /transport_invalid/);
  assert.throws(() => openWildsRoamingTransport(sealed, "capture-offer", secret), /transport_invalid/);
  assert.throws(() => openWildsRoamingTransport({ ...sealed, record: { ...row, ownerAcknowledgedRevision: 99 } }, "encounter", secret), /transport_invalid/);
});
test("private participant read rejects a third party; published state is sealed and private", async () => {
  const { row } = fixture("private-test");
  storeWildsRoamingEncounter(row);
  const request = new NextRequest("https://wildz.quest/api/wilds/multiplayer/roaming-battle");
  const actor = { playerId: "challenger", handle: "challenger", receizActorId: "native-challenger", practice: false };
  const adapter = () => ({ readAppStateByUrl: async () => null }) as never;
  await assert.rejects(readWildsRoamingEncounter(request, { ...actor, playerId: "intruder" }, row.id, adapter), /participant_required/);
  assert.equal((await readWildsRoamingEncounter(request, actor, row.id, adapter)).id, row.id);
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = "test-only-roaming-secret-at-least-32-bytes";
  let publication: Record<string, unknown> | undefined;
  try {
    await publishWildsRoamingEncounter(request, actor, row, (() => ({ client: { appState: { publish: async (value: Record<string, unknown>) => { publication = value; return { ok: true }; } } } })) as never);
    assert.equal(publication?.visibility, "private");
    assert.equal((publication?.state as { schema: string }).schema, "wildz.roaming-transport.v1");
  } finally { if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET; else process.env.RECEIZ_OAUTH_STATE_SECRET = prior; }
});

test("remote appState cannot inject an unsigned or modified owner-approved encounter", async () => {
  const { row } = fixture("forged-remote");
  const request = new NextRequest("https://wildz.quest/api/wilds/multiplayer/roaming-battle");
  const actor = { playerId: "challenger", handle: "challenger", receizActorId: "native-challenger", practice: false };
  const unsigned = () => ({ readAppStateByUrl: async () => ({ state: row }) }) as never;
  await assert.rejects(readWildsRoamingEncounter(request, actor, row.id, unsigned), /transport_invalid/);
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = "test-only-roaming-secret-at-least-32-bytes";
  try {
    const sealed = sealWildsRoamingTransport(row, "wildz.roaming-encounter.v1");
    const modified = { ...sealed, record: { ...row, ownerAcknowledgedRevision: 1 } };
    await assert.rejects(readWildsRoamingEncounter(request, actor, row.id, (() => ({ readAppStateByUrl: async () => ({ state: modified }) })) as never), /transport_invalid/);
    const admitted = await readWildsRoamingEncounter(request, actor, row.id, (() => ({ readAppStateByUrl: async () => ({ state: sealed }) })) as never);
    assert.equal(admitted.ownerAcknowledgedRevision, null);
  } finally { if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET; else process.env.RECEIZ_OAUTH_STATE_SECRET = prior; }
});


test("polling stops settled reports but keeps active battles and unacknowledged owner outcomes", () => {
  const { row, defenderAsset } = fixture("poll-lifecycle");
  assert.equal(shouldPollWildsRoamingEncounter({ ...row, cancelled: true }, "defender", false, false), false);
  const active = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:poll", kaiUPulse: 110, at });
  assert.equal(shouldPollWildsRoamingEncounter(active, "challenger", true, false), true);
  const ended = moveWildsRoamingEncounter(active, { actorId: "challenger", expectedRevision: 0, expectedTurn: active.session!.battle.turn,
    intentId: "poll:retreat", intent: { type: "retreat" }, kaiUPulse: 120, at });
  assert.equal(shouldPollWildsRoamingEncounter(ended, "challenger", true, false), false);
  assert.equal(shouldPollWildsRoamingEncounter(ended, "defender", true, false), true);
  const acknowledged = acknowledgeWildsRoamingEncounter(ended, { actorId: "defender", expectedRevision: ended.session!.revision, expeditionId: "route:poll" });
  assert.equal(shouldPollWildsRoamingEncounter(acknowledged, "defender", true, false), false);
  assert.equal(shouldPollWildsRoamingEncounter(acknowledged, "defender", false, false), true);
});

test("captured polling requires actual challenger restore; expired rows only retry their missing report", () => {
  const { row } = fixture("poll-capture");
  // Lifecycle selection only: these phase projections never assert native custody.
  const captured = { ...row, capturePhase: "captured" as const };
  assert.equal(shouldPollWildsRoamingEncounter(captured, "defender", true, false), false);
  assert.equal(shouldPollWildsRoamingEncounter(captured, "challenger", true, false), true);
  assert.equal(shouldPollWildsRoamingEncounter(captured, "challenger", true, true), false);
  const expired = { ...row, capturePhase: "expired" as const };
  assert.equal(shouldPollWildsRoamingEncounter(expired, "challenger", true, false), false);
  assert.equal(shouldPollWildsRoamingEncounter(expired, "challenger", false, false), true);
});

test("hold deadline is bounded during outages and uses exact winning finish Kai", () => {
  const { row, defenderAsset } = fixture("hold-expiry");
  const active = acceptWildsRoamingEncounter(row, { actorId: "defender", defenderAsset, expeditionId: "route:hold", kaiUPulse: 110, at });
  assert.equal(wildsRoamingEncounterHoldExpiry(active), row.expiresKaiUPulse + WILDS_ROAMING_CAPTURE_TTL_UPULSES);
  // Deadline arithmetic consumes an outcome projection; native admission is separate.
  const win = { ...active, session: { ...active.session!, outcome: "capture-eligible" as const, kaiUPulse: 123456 } };
  assert.equal(wildsRoamingEncounterHoldExpiry(win), 123456 + WILDS_ROAMING_CAPTURE_TTL_UPULSES);
  assert.equal(wildsRoamingEncounterHoldExpiry({ ...win, revision: win.revision + 1, capturePhase: "ready" }), wildsRoamingEncounterHoldExpiry(win));
});
