import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import {
  applyMarketConsequences,
  projectMarketConsequences,
  sealMarketMortalConsent,
} from "../src/features/play/market/consequences";
import { generateMarketBoard } from "../src/features/play/market/contract-director";
import { marketRuntimeStateDigest, type MarketRuntimeState } from "../src/features/play/market/runtime";
import { marketFixtureInput, marketFixtureCards, marketRuntimeFixture } from "./support/market-fixtures";

function defeatedFixture(risk: "standard" | "mortal") {
  const cards = marketFixtureCards();
  const squad = [cards.groveScout, cards.stoneCarrier] as const;
  const contract = generateMarketBoard(marketFixtureInput(squad, risk === "mortal")).contracts[0];
  const base = marketRuntimeFixture().state;
  const cardsAtZero = Object.fromEntries(squad.map((card) => [card.assetId, { ...base.cards[card.assetId]!, health: 0 }]));
  const events = squad.map((card, index) => ({
    id: `${contract.id}:defeat:${index}`,
    sequence: index + 1,
    tick: index + 1,
    kind: "hazard.hit" as const,
    assetId: card.assetId,
    targetId: contract.hazards[0]!.id,
    amount: card.stats.health,
    cargoAmount: 10,
    detail: "Verified fixture defeat.",
  }));
  const state = {
    ...base,
    id: `market:runtime:defeat:${risk}`,
    contractId: contract.id,
    contractDigest: contract.digest,
    squad,
    cards: cardsAtZero,
    phase: "defeated" as const,
    terminalReason: "squad-defeated" as const,
    sequence: events.length,
    tick: events.length,
    events,
    inputs: [],
  } satisfies MarketRuntimeState;
  const priorConditions = Object.fromEntries(squad.map((card) => [card.assetId, emptyAdventureCondition(card.assetId)]));
  return {
    contract,
    terms: state.terms,
    priorConditions,
    replay: { ok: true as const, state, stateDigest: marketRuntimeStateDigest(state), transcriptDigest: `sha256:${"a".repeat(64)}` },
  };
}

describe("Wayfarer persistent consequences", () => {
  it("awards only replay-recorded contributors and bounds XP, fatigue, rewards, and upgrades", () => {
    const fixture = marketRuntimeFixture();
    const contributor = fixture.squad[0];
    const idle = fixture.squad[1];
    const event = {
      id: `${fixture.contract.id}:contribution`, sequence: 1, tick: 1, kind: "ability.succeeded" as const,
      assetId: contributor.assetId, targetId: fixture.contract.objectives[0]!.id, amount: 999, cargoAmount: 0, detail: "Exact ability contribution.",
    };
    const state = { ...fixture.state, phase: "extracted" as const, terminalReason: "extracted" as const, cargoIntegrity: 100, sequence: 1, tick: 1, events: [event, event] };
    const replay = { ok: true as const, state, stateDigest: marketRuntimeStateDigest(state), transcriptDigest: `sha256:${"b".repeat(64)}` };
    const priorConditions = Object.fromEntries(fixture.squad.map((card) => [card.assetId, emptyAdventureCondition(card.assetId)]));
    const result = projectMarketConsequences({ contract: fixture.contract, terms: state.terms, replay, priorConditions, mortalConsent: null });

    assert.ok(result.cards[contributor.assetId]!.xp > 0 && result.cards[contributor.assetId]!.xp <= 250);
    assert.equal(result.cards[idle.assetId]!.xp, 0);
    assert.ok(result.cards[contributor.assetId]!.fatigueDelta <= 25);
    assert.ok(result.cards[contributor.assetId]!.upgradeOffers.length <= 3);
    assert.ok(result.reputationDelta <= 10);
    assert.equal(Object.values(result.resourceAwards)[0], 2);
  });

  it("injures Standard cards but permits death only after exact Mortal consent", () => {
    const standard = defeatedFixture("standard");
    const standardResult = projectMarketConsequences({ ...standard, mortalConsent: null });
    assert.ok(Object.values(standardResult.cards).every((card) => card.lifeAfter === "alive" && card.injuriesAdded.length > 0));

    const mortal = defeatedFixture("mortal");
    assert.throws(() => projectMarketConsequences({ ...mortal, mortalConsent: null }), /market_mortal_consent_required/);
    const consent = sealMarketMortalConsent(mortal.contract, "2026-07-16T23:00:00.000Z");
    const mortalResult = projectMarketConsequences({ ...mortal, mortalConsent: consent });
    assert.ok(Object.values(mortalResult.cards).every((card) => card.lifeAfter === "dead"));
    assert.throws(() => projectMarketConsequences({ ...mortal, mortalConsent: { ...consent, contractDigest: standard.contract.digest } }), /market_mortal_consent_invalid/);
  });

  it("applies selected verified upgrades and keeps death irreversible", () => {
    const fixture = defeatedFixture("mortal");
    const consent = sealMarketMortalConsent(fixture.contract, "2026-07-16T23:00:00.000Z");
    const consequences = projectMarketConsequences({ ...fixture, mortalConsent: consent });
    const applied = applyMarketConsequences(fixture.priorConditions, consequences, `sha256:${"c".repeat(64)}`, {});
    assert.ok(Object.values(applied).every((condition) => condition.life === "dead"));
    assert.throws(() => applyMarketConsequences(applied, consequences, `sha256:${"d".repeat(64)}`, {}), /adventure_condition_prior_mismatch/);
  });
});
