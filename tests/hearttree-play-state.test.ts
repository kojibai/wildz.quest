import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyHearttreeCondition, projectHearttreeCard } from "../src/features/play/hearttree/card-capability";
import { projectHearttreeConsequences } from "../src/features/play/hearttree/consequences";
import { generateHearttreeExpedition } from "../src/features/play/hearttree/expedition-director";
import { sealHearttreeReceipt } from "../src/features/play/hearttree/receipt";
import { createHearttreeRuntime, hearttreeRuntimeStateDigest, stepHearttreeRuntime } from "../src/features/play/hearttree/runtime";
import { hearttreeTranscript } from "../src/features/play/hearttree/transcript";
import { applyWildsInput, initialPlayState, isPlayableAsset, playableInventory, restorePlayState, serializePlayState } from "../src/features/play/game-state";

function receiptFixture() {
  const card = initialPlayState.inventory[0]!;
  const condition = emptyHearttreeCondition(card.id);
  const capability = projectHearttreeCard(card, condition);
  const definition = generateHearttreeExpedition({ seed: "play-state", squad: [capability], history: [], mortal: true });
  let state = createHearttreeRuntime(definition, [capability]);
  state = stepHearttreeRuntime(state, { sequence: 1, tick: 1, kind: "extract" });
  const transcript = hearttreeTranscript(state);
  const defeated = { ...state, cards: { [card.id]: { ...state.cards[card.id]!, health: 0 } }, phase: "defeated" as const, terminalReason: "squad-defeated" as const };
  const replay = { ok: true as const, state: defeated, stateDigest: hearttreeRuntimeStateDigest(defeated), transcriptDigest: transcript.digest };
  const consent = { schema: "receiz.wilds.hearttree_mortal_consent.v1" as const, expeditionId: definition.id, accepted: true as const, consequence: "permanent-death" as const, squadPins: definition.squadPins, acceptedAt: "2026-07-16T19:00:00.000Z" };
  const consequences = projectHearttreeConsequences({ definition, replay, priorConditions: { [card.id]: condition }, mortalConsent: consent });
  const receipt = sealHearttreeReceipt({ definition, transcript, priorConditions: { [card.id]: condition }, consequences, actorId: "wilds.player.receiz.id", publicationRevision: 1, createdAt: "2026-07-16T19:01:00.000Z" });
  return { card, receipt };
}

describe("Hearttree Save V9 compatibility and dead-card guards", () => {
  it("migrates v8 inventory to alive conditions and a playable default squad", () => {
    const legacy = JSON.stringify({ schema: "receiz.wilds.save.v8", state: initialPlayState });
    const restored = restorePlayState(legacy);
    const id = restored.inventory[0]!.id;
    assert.equal(restored.hearttreeConditions[id]!.life, "alive");
    assert.deepEqual(restored.hearttreeSquadAssetIds, [id]);
    assert.match(serializePlayState(restored), /receiz\.wilds\.save\.v9/);
  });

  it("adopts a verified receipt once and retains a dead card as memorial inventory", () => {
    const { card, receipt } = receiptFixture();
    const first = applyWildsInput(initialPlayState, { type: "hearttree-admit", receipt });
    const duplicate = applyWildsInput(first, { type: "hearttree-admit", receipt });
    assert.equal(first.hearttreeConditions[card.id]!.life, "dead");
    assert.equal(first.inventory.some((asset) => asset.id === card.id), true);
    assert.equal(playableInventory(first).some((asset) => asset.id === card.id), false);
    assert.equal(first.hearttreeReceipts.length, 1);
    assert.deepEqual(duplicate, first);
  });

  it("blocks dead cards from squads, selection, training, battle, lineage, growth, evolution, and listing", () => {
    const { card, receipt } = receiptFixture();
    const dead = applyWildsInput(initialPlayState, { type: "hearttree-admit", receipt });
    assert.equal(isPlayableAsset(dead, card.id), false);
    assert.deepEqual(applyWildsInput(dead, { type: "hearttree-select-squad", assetIds: [card.id] }), dead);
    assert.deepEqual(applyWildsInput(dead, { type: "select-asset", assetId: card.id }), dead);
    assert.deepEqual(applyWildsInput(dead, { type: "train", cardId: card.manifest.familyId, at: "2026-07-16T20:00:00.000Z" }), dead);
    assert.deepEqual(applyWildsInput(dead, { type: "record-growth", assetId: card.id, event: { eventId: "dead:growth", kind: "bond_moment", path: "bond", amount: 1, occurredAt: "2026-07-16T20:00:00.000Z" } }), dead);
    assert.deepEqual(applyWildsInput(dead, { type: "mark-listed", assetId: card.id, synchronizedAt: "2026-07-16T20:00:00.000Z" }), dead);
  });

  it("will not let a restored alive projection overwrite receipt-proven death", () => {
    const { card, receipt } = receiptFixture();
    const dead = applyWildsInput(initialPlayState, { type: "hearttree-admit", receipt });
    const tampered = { ...dead, hearttreeConditions: { ...dead.hearttreeConditions, [card.id]: emptyHearttreeCondition(card.id) } };
    const restored = restorePlayState(serializePlayState(tampered));
    assert.equal(restored.hearttreeConditions[card.id]!.life, "dead");
  });
});
