import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyHearttreeCondition, projectHearttreeCard } from "../src/features/play/hearttree/card-capability";
import {
  applyHearttreeConsequences,
  projectHearttreeConsequences,
  type HearttreeMortalConsent
} from "../src/features/play/hearttree/consequences";
import { generateHearttreeExpedition } from "../src/features/play/hearttree/expedition-director";
import { sealHearttreeReceipt, verifyHearttreeReceipt } from "../src/features/play/hearttree/receipt";
import { createHearttreeRuntime, hearttreeRuntimeStateDigest, stepHearttreeRuntime } from "../src/features/play/hearttree/runtime";
import { hearttreeTranscript } from "../src/features/play/hearttree/transcript";
import { sealCollectedCard } from "../src/features/play/portable-card";

function fixture(mortal = false) {
  const cards = ["mintcub-1", "voltray-1"].map((formId, index) => sealCollectedCard({
    formId,
    ownerReceizId: "hearttree.player",
    encounterId: `consequence:${index}`,
    capturedAt: `2026-07-16T17:0${index}:00.000Z`
  }));
  const conditions = Object.fromEntries(cards.map((card) => [card.id, emptyHearttreeCondition(card.id)]));
  const squad = cards.map((card) => projectHearttreeCard(card, conditions[card.id]!));
  const definition = generateHearttreeExpedition({ seed: `consequence:${mortal}`, squad, history: [], mortal });
  let state = createHearttreeRuntime(definition, squad);
  state = stepHearttreeRuntime(state, { sequence: 1, tick: 1, kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 });
  state = stepHearttreeRuntime(state, { sequence: 2, tick: 2, kind: "extract" });
  const transcript = hearttreeTranscript(state);
  const replay = { ok: true as const, state, stateDigest: hearttreeRuntimeStateDigest(state), transcriptDigest: transcript.digest };
  return { cards, conditions, squad, definition, state, transcript, replay };
}

function consentFor(value: ReturnType<typeof fixture>): HearttreeMortalConsent {
  return {
    schema: "receiz.wilds.hearttree_mortal_consent.v1",
    expeditionId: value.definition.id,
    accepted: true,
    consequence: "permanent-death",
    squadPins: value.definition.squadPins,
    acceptedAt: "2026-07-16T17:10:00.000Z"
  };
}

describe("Hearttree persistent consequences", () => {
  it("awards bounded XP only to cards with unique resolved contributions", () => {
    const value = fixture();
    const result = projectHearttreeConsequences({
      definition: value.definition,
      replay: value.replay,
      priorConditions: value.conditions,
      mortalConsent: null
    });
    assert.ok(result.cards[value.squad[0]!.assetId]!.xp > 0);
    assert.equal(result.cards[value.squad[1]!.assetId]!.xp, 0);
    assert.ok(result.cards[value.squad[0]!.assetId]!.xp <= 250);
    assert.equal(new Set(result.cards[value.squad[0]!.assetId]!.sourceEventIds).size, result.cards[value.squad[0]!.assetId]!.sourceEventIds.length);
  });

  it("requires replay evidence and derives injuries from recorded damage thresholds", () => {
    const value = fixture();
    assert.throws(() => projectHearttreeConsequences({ definition: value.definition, replay: null, priorConditions: value.conditions, mortalConsent: null }), /hearttree_replay_required/);
    const assetId = value.squad[0]!.assetId;
    const actor = value.state.cards[assetId]!;
    const damageEvent = { id: "event:root-impact", tick: 3, sequence: 3, kind: "hazard.hit" as const, assetId, amount: actor.maxHealth, detail: "root-surge" };
    const state = { ...value.state, cards: { ...value.state.cards, [assetId]: { ...actor, health: Math.floor(actor.maxHealth * 0.4) } }, events: [...value.state.events, damageEvent] };
    const consequences = projectHearttreeConsequences({
      definition: value.definition,
      replay: { ...value.replay, state, stateDigest: hearttreeRuntimeStateDigest(state) },
      priorConditions: value.conditions,
      mortalConsent: null
    });
    assert.equal(consequences.cards[assetId]!.injuriesAdded[0]?.kind, "limb");
    assert.equal(consequences.cards[assetId]!.injuriesAdded[0]?.sourceEventId, damageEvent.id);
  });

  it("offers no more than three upgrades grounded in actual actions and mastery", () => {
    const value = fixture();
    const completed = { ...value.state, phase: "result" as const, terminalReason: "completed" as const };
    const result = projectHearttreeConsequences({
      definition: value.definition,
      replay: { ...value.replay, state: completed, stateDigest: hearttreeRuntimeStateDigest(completed) },
      priorConditions: value.conditions,
      mortalConsent: null
    });
    const offers = result.cards[value.squad[0]!.assetId]!.upgradeOffers;
    assert.ok(offers.length > 0 && offers.length <= 3);
    assert.equal(offers.every((offer) => offer.sourceEventIds.length > 0), true);
  });

  it("makes disclosed, consented Mortal defeat irreversible while normal defeat is not death", () => {
    const value = fixture(true);
    const deadCards = Object.fromEntries(Object.entries(value.state.cards).map(([id, card]) => [id, { ...card, health: 0 }]));
    const defeated = { ...value.state, cards: deadCards, phase: "defeated" as const, terminalReason: "squad-defeated" as const };
    const replay = { ...value.replay, state: defeated, stateDigest: hearttreeRuntimeStateDigest(defeated) };
    const consequences = projectHearttreeConsequences({ definition: value.definition, replay, priorConditions: value.conditions, mortalConsent: consentFor(value) });
    const id = value.squad[0]!.assetId;
    const dead = applyHearttreeConsequences(value.conditions[id]!, consequences.cards[id]!);
    assert.equal(dead.life, "dead");
    assert.throws(() => applyHearttreeConsequences(dead, { ...consequences.cards[id]!, lifeAfter: "alive" }), /hearttree_death_irreversible/);

    const normal = fixture(false);
    const normalDeadCards = Object.fromEntries(Object.entries(normal.state.cards).map(([cardId, card]) => [cardId, { ...card, health: 0 }]));
    const normalDefeated = { ...normal.state, cards: normalDeadCards, phase: "defeated" as const, terminalReason: "squad-defeated" as const };
    const normalResult = projectHearttreeConsequences({ definition: normal.definition, replay: { ...normal.replay, state: normalDefeated, stateDigest: hearttreeRuntimeStateDigest(normalDefeated) }, priorConditions: normal.conditions, mortalConsent: null });
    assert.equal(normalResult.cards[normal.squad[0]!.assetId]!.lifeAfter, "alive");
  });

  it("rejects mismatched consent without partially changing prior conditions", () => {
    const value = fixture(true);
    const consent = { ...consentFor(value), expeditionId: "hearttree:other" };
    const before = structuredClone(value.conditions);
    assert.throws(() => projectHearttreeConsequences({ definition: value.definition, replay: value.replay, priorConditions: value.conditions, mortalConsent: consent }), /hearttree_mortal_consent_invalid/);
    assert.deepEqual(value.conditions, before);
  });

  it("seals a self-verifying receipt over replay, prior state, consequences, actor, and revision", () => {
    const value = fixture();
    const consequences = projectHearttreeConsequences({ definition: value.definition, replay: value.replay, priorConditions: value.conditions, mortalConsent: null });
    const receipt = sealHearttreeReceipt({
      definition: value.definition,
      transcript: value.transcript,
      priorConditions: value.conditions,
      consequences,
      actorId: "hearttree.player",
      publicationRevision: 7,
      createdAt: "2026-07-16T17:20:00.000Z"
    });
    assert.equal(verifyHearttreeReceipt(receipt).ok, true);
    assert.equal(verifyHearttreeReceipt({ ...receipt, publicationRevision: 8 }).ok, false);
  });
});
