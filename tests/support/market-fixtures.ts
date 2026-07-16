import { emptyAdventureCondition } from "../../src/features/play/adventure/card-condition";
import { projectMarketCard } from "../../src/features/play/market/card-role";
import { generateMarketBoard, type MarketBoardInput } from "../../src/features/play/market/contract-director";
import { createMarketNegotiation } from "../../src/features/play/market/negotiation-resolver";
import { createMarketRuntime } from "../../src/features/play/market/runtime";
import { sealCollectedCard } from "../../src/features/play/portable-card";
import type { WildsEcologySite } from "../../src/features/play/wilds-ecology";

export function marketFixtureCards() {
  const capturedAt = "2026-07-16T21:00:00.000Z";
  const source = {
    grove: sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "market.player", encounterId: "fixture:grove", capturedAt }),
    spark: sealCollectedCard({ formId: "voltray-1", ownerReceizId: "market.player", encounterId: "fixture:spark", capturedAt }),
    tide: sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "market.player", encounterId: "fixture:tide", capturedAt }),
    stone: sealCollectedCard({ formId: "titanseal-1", ownerReceizId: "market.player", encounterId: "fixture:stone", capturedAt }),
  };
  return {
    source,
    groveScout: projectMarketCard(source.grove, emptyAdventureCondition(source.grove.id)),
    sparkScout: projectMarketCard(source.spark, emptyAdventureCondition(source.spark.id)),
    tideAppraiser: projectMarketCard(source.tide, emptyAdventureCondition(source.tide.id)),
    stoneCarrier: projectMarketCard(source.stone, emptyAdventureCondition(source.stone.id)),
  };
}

export function marketFixtureSite(): WildsEcologySite {
  return {
    schema: "receiz.wilds_ecology_site.v1",
    id: "ecology:wandering-market:fixture000000000001",
    familyId: "wandering-market",
    name: "Wayfarer Market",
    generatorVersion: 1,
    seedDigest: `sha256:${"b".repeat(64)}`,
    position: { x: 32, z: -18 },
    region: { x: 0, z: -1 },
    radius: 8,
    phase: "active",
    intensity: "social",
    activityId: "verified-delivery",
    visualKit: "folding-canopies",
    audioMotif: "market-arrival",
    aftermathModule: "merchant-trail",
    spawnedAt: "2026-07-16T20:00:00.000Z",
    activatesAt: "2026-07-16T21:00:00.000Z",
    resolvesAt: "2026-07-17T20:00:00.000Z",
    historicizesAt: "2026-07-18T20:00:00.000Z",
    expiresAt: "2026-07-18T08:00:00.000Z",
    parentSiteId: null,
  };
}

export function marketFixtureInput(squad: MarketBoardInput["squad"], mortal = false): MarketBoardInput {
  return {
    site: marketFixtureSite(),
    pulse: "2026-07-16T22:00:00.000Z",
    squad,
    history: [],
    mortal,
  };
}

export function marketNegotiationFixture() {
  const cards = marketFixtureCards();
  const contract = generateMarketBoard(marketFixtureInput([cards.groveScout, cards.stoneCarrier])).contracts[0];
  return { ...cards, contract, state: createMarketNegotiation(contract) };
}

export function marketRuntimeFixture() {
  const fixture = marketNegotiationFixture();
  const terms = createMarketNegotiation(fixture.contract).terms;
  return {
    ...fixture,
    terms,
    squad: [fixture.groveScout, fixture.stoneCarrier] as const,
    state: createMarketRuntime(fixture.contract, terms, [fixture.groveScout, fixture.stoneCarrier]),
  };
}
