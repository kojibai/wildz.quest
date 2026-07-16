import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import {
  generateMarketBoard,
  validateMarketContractSolvability,
  type MarketBoardInput,
} from "../src/features/play/market/contract-director";
import { projectMarketCard } from "../src/features/play/market/card-role";
import { marketFixtureCards, marketFixtureSite } from "./support/market-fixtures";

function input(squad: MarketBoardInput["squad"], mortal = false): MarketBoardInput {
  return {
    site: marketFixtureSite(),
    pulse: "2026-07-16T22:00:00.000Z",
    squad,
    history: [],
    mortal,
  };
}

describe("Wayfarer deterministic contract director", () => {
  it("reproduces three proof-pinned contracts with a viable route", () => {
    const { groveScout, stoneCarrier } = marketFixtureCards();
    const first = generateMarketBoard(input([groveScout, stoneCarrier]));
    const replay = generateMarketBoard(input([groveScout, stoneCarrier]));

    assert.deepEqual(replay, first);
    assert.equal(first.contracts.length, 3);
    assert.deepEqual(first.squadPins, [groveScout, stoneCarrier].map((card) => ({ assetId: card.assetId, proofDigest: card.proofDigest })));
    assert.ok(first.contracts.every((contract) => validateMarketContractSolvability(contract, [groveScout, stoneCarrier]).ok));
    assert.ok(first.contracts.every((contract) => contract.solvability.viableRouteIds.length >= 1));
  });

  it("changes routes, counters, and demand for materially different real cards", () => {
    const { groveScout, stoneCarrier } = marketFixtureCards();
    const grove = generateMarketBoard(input([groveScout]));
    const stone = generateMarketBoard(input([stoneCarrier]));

    assert.notEqual(grove.digest, stone.digest);
    assert.notDeepEqual(
      grove.contracts.map((contract) => contract.routes.map((route) => route.requires)),
      stone.contracts.map((contract) => contract.routes.map((route) => route.requires)),
    );
    assert.notDeepEqual(
      grove.contracts.map((contract) => contract.demand.map((fact) => fact.kind)),
      stone.contracts.map((contract) => contract.demand.map((fact) => fact.kind)),
    );
  });

  it("adapts to injuries instead of offering a route that needs a lost capability", () => {
    const { source, sparkScout } = marketFixtureCards();
    const injured = projectMarketCard(source.spark, {
      ...emptyAdventureCondition(source.spark.id),
      injuries: [{ id: "market:wing:lost", kind: "wing", severity: 3, sourceEventId: "market:event:fall" }],
    });
    const healthyBoard = generateMarketBoard(input([sparkScout]));
    const injuredBoard = generateMarketBoard(input([injured]));

    assert.equal(healthyBoard.contracts.some((contract) => contract.routes.some((route) => route.requires.includes("verb:overfly"))), true);
    assert.equal(injuredBoard.contracts.some((contract) => contract.routes.some((route) => route.requires.includes("verb:overfly"))), false);
    assert.ok(injuredBoard.contracts.every((contract) => validateMarketContractSolvability(contract, [injured]).ok));
  });

  it("requires two or three cards and discloses irreversible risk for Mortal boards", () => {
    const { groveScout, stoneCarrier } = marketFixtureCards();
    assert.throws(() => generateMarketBoard(input([groveScout], true)), /market_mortal_squad_size_invalid/);
    const board = generateMarketBoard(input([groveScout, stoneCarrier], true));

    assert.ok(board.contracts.every((contract) => contract.risk === "mortal" && contract.minCards >= 2));
    assert.deepEqual(board.mortalDisclosure, {
      consequence: "permanent-death",
      assetIdsAtRisk: [groveScout.assetId, stoneCarrier.assetId],
      reversible: false,
    });
  });

  it("diminishes mastered families and rejects dead, duplicate, or malformed squads", () => {
    const { groveScout, stoneCarrier } = marketFixtureCards();
    const base = generateMarketBoard(input([groveScout, stoneCarrier]));
    const history = base.contracts.map((contract) => ({
      id: `history:${contract.id}`,
      contractId: contract.id,
      family: contract.family,
      mastery: 20,
    }));
    const changed = generateMarketBoard({ ...input([groveScout, stoneCarrier]), history });
    assert.notDeepEqual(changed.contracts.map((contract) => contract.family), base.contracts.map((contract) => contract.family));

    const dead = { ...groveScout, playable: false, condition: { ...groveScout.condition, life: "dead" as const } };
    assert.throws(() => generateMarketBoard(input([dead, stoneCarrier])), /market_card_dead/);
    assert.throws(() => generateMarketBoard(input([groveScout, groveScout])), /market_squad_duplicate/);
    assert.throws(() => generateMarketBoard({ ...input([groveScout]), pulse: "not-a-pulse" }), /market_pulse_invalid/);
  });
});
