import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { acceptWildsRoamingEncounter, moveWildsRoamingEncounter, requestWildsRoamingEncounter } from "../src/features/play/wilds-roaming-encounter";
import { createWildsRoamingReportStore } from "../src/features/play/wilds-roaming-report-store";

const at = "2026-09-13T12:00:00.000Z";
function fixture() {
  const challengerAsset = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "challenger", encounterId: "challenger", capturedAt: at });
  const defenderAsset = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "defender", encounterId: "defender", capturedAt: at });
  const pending = requestWildsRoamingEncounter({ id: "roaming:report", roomKey: "wilds:platform:0:0", challenger: { playerId: "challenger", handle: "challenger", receizId: "native-challenger" }, challengerAsset,
    defenderId: "defender", defenderAssetId: defenderAsset.id, defenderProofDigest: defenderAsset.proof.digest, kaiUPulse: 100 });
  const active = acceptWildsRoamingEncounter(pending, { actorId: "defender", defenderAsset, expeditionId: "trip", kaiUPulse: 110, at });
  const ended = moveWildsRoamingEncounter(active, { actorId: "challenger", expectedRevision: 0, expectedTurn: active.session!.battle.turn, intentId: "retreat", intent: { type: "retreat" }, kaiUPulse: 120, at });
  return { active, ended, challengerAsset, defenderAsset };
}
test("both crew surfaces recover the same deduplicated participant-scoped battle report after reload", async () => {
  const db = createMemoryWildzContinuityDatabase(), store = createWildsRoamingReportStore(db);
  const { active, ended, defenderAsset, challengerAsset } = fixture();
  await store.append("defender", active);
  assert.deepEqual(await store.history("defender", defenderAsset.id), []);
  await store.append("defender", ended);
  await store.append("defender", ended);
  await store.append("challenger", ended);
  const reopened = createWildsRoamingReportStore(db);
  const reports = await reopened.history("defender", defenderAsset.id);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.outcome, "retreated");
  assert.ok(reports[0]?.events.some(event => event.includes("retreated")));
  assert.equal((await reopened.history("challenger", challengerAsset.id)).length, 1);
  assert.deepEqual(await reopened.history("stranger", defenderAsset.id), []);
  await assert.rejects(store.append("stranger", ended), /participant_required/);
});
test("forged battle outcomes cannot replace a recorded gameplay report", async () => {
  const store = createWildsRoamingReportStore(createMemoryWildzContinuityDatabase());
  const { ended, defenderAsset } = fixture();
  await store.append("defender", ended);
  await assert.rejects(store.append("defender", { ...ended, session: { ...ended.session!, outcome: "capture-eligible" } }), /replay_mismatch/);
  assert.equal((await store.history("defender", defenderAsset.id))[0]?.outcome, "retreated");
});
