import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import {
  createWildsSourceAuthorityProjection,
  planWildsMaterialHarvest
} from "../src/features/play/wilds-source-work-authority";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { checkpointWildsWorld, initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { wildsWorldSourceEmission, wildsWorldSourceGenesis } from "../src/features/play/wilds-world-genesis";
import { createWildsWorldEmissionGenesis } from "../src/features/play/wilds-world-emission";
import { sealCollectedCard } from "../src/features/play/portable-card";

function sourceOf(kind: "timber" | "stone") {
  for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

describe("source-first baseline work", () => {
  it("keeps an incompatible active helper optional while crediting a matching helper", () => {
    const projection = createWildsSourceAuthorityProjection();
    const source = sourceOf("timber");
    const incompatible = sealCollectedCard({
      capturedAt: "2026-07-15T00:00:00.000Z",
      encounterId: "source-work-incompatible",
      formId: "titanseal-1",
      ownerReceizId: "explorer:helpers"
    });
    const solo = planWildsMaterialHarvest({
      projection,
      source,
      actorId: "explorer:helpers",
      actorPosition: source.position,
      kaiUPulse: 1_000_000,
      commandId: "command:helpers:solo",
      card: incompatible
    });
    assert.deepEqual(solo.operation?.participants.map((entry) => entry.kind), ["player"]);
    assert.equal(solo.operation?.consequences.cooperation, 0);
    const admitted = new WildsWorldService({ checkpoint: checkpointWildsWorld(projection) }).execute(solo, {
      actorId: "explorer:helpers",
      canonical: true,
      pulse: "2026-07-15T00:00:00.000Z",
      occurredAt: "2026-07-15T00:00:00.000Z",
      uPulse: 1_000_000
    });
    assert.equal(Object.values(admitted.projection.materialLots)[0]?.contributors.creatureSubjectId, undefined);

    const matching = sealCollectedCard({
      capturedAt: "2026-07-15T00:00:00.000Z",
      encounterId: "source-work-matching",
      formId: "mintcub-1",
      ownerReceizId: "explorer:helpers"
    });
    const partnered = planWildsMaterialHarvest({
      projection,
      source,
      actorId: "explorer:helpers",
      actorPosition: source.position,
      kaiUPulse: 1_000_001,
      commandId: "command:helpers:partnered",
      card: matching
    });
    assert.deepEqual(partnered.operation?.participants.map((entry) => entry.kind), ["creature", "player"]);
    assert.equal(partnered.operation?.consequences.cooperation, 2);
  });

  it("rejects a projection that claims a different source law", () => {
    const source = wildsWorldSourceGenesis().emission;
    const representation = { ...source, epochId: "epoch:representation", head: source.head };

    assert.equal(wildsWorldSourceEmission({ worldEmission: representation }).head, source.head);
    assert.equal(wildsWorldSourceEmission({ worldEmission: representation }).epochId, source.epochId);
  });

  it("cannot be demoted by a connected projection that omitted source emission", () => {
    const projection = initialWildsWorldProjection();
    const source = sourceOf("stone");
    const command = planWildsMaterialHarvest({
      projection,
      source,
      actorId: "explorer:connected-incomplete",
      actorPosition: source.position,
      kaiUPulse: 1_000_000,
      commandId: "command:connected-incomplete:stone"
    });
    const world = new WildsWorldService({ checkpoint: checkpointWildsWorld(projection) });
    const result = world.execute(command, {
      actorId: "explorer:connected-incomplete",
      canonical: true,
      pulse: "2026-07-15T00:00:00.000Z",
      occurredAt: "2026-07-15T00:00:00.000Z",
      uPulse: 1_000_000
    });

    assert.equal(Object.values(result.projection.materialLots).length, 1);
    assert.equal(Object.values(result.projection.stewardPhiAwards).length, 1);
  });

  it("admits a local material lot before any shared-world snapshot arrives", () => {
    const projection = createWildsSourceAuthorityProjection();
    const source = sourceOf("timber");
    const command = planWildsMaterialHarvest({
      projection,
      source,
      actorId: "explorer:source-first",
      actorPosition: source.position,
      kaiUPulse: 1_000_000,
      commandId: "command:source-first:timber"
    });
    const world = new WildsWorldService({ checkpoint: checkpointWildsWorld(projection) });
    const result = world.execute(command, {
      actorId: "explorer:source-first",
      canonical: true,
      pulse: "2026-07-15T00:00:00.000Z",
      occurredAt: "2026-07-15T00:00:00.000Z",
      uPulse: 1_000_000
    });

    assert.equal(projection.worldEmission !== null, true);
    assert.equal(Object.keys(projection.groves).length, 25);
    assert.equal(Object.values(result.projection.materialLots).length, 1);
    assert.equal(Object.values(result.projection.materialLots)[0]?.authority, "source-proof-object");
  });

  it("replans queued source work from the latest source head instead of letting a stale projection veto it", () => {
    const actorId = "explorer:source-first";
    const projection = createWildsSourceAuthorityProjection();
    const timber = sourceOf("timber");
    const first = planWildsMaterialHarvest({
      projection,
      source: timber,
      actorId,
      actorPosition: timber.position,
      kaiUPulse: 1_000_000,
      commandId: "command:source-first:first"
    });
    const world = new WildsWorldService({ checkpoint: checkpointWildsWorld(projection) });
    const advanced = world.execute(first, {
      actorId,
      canonical: true,
      pulse: "2026-07-15T00:00:00.000Z",
      occurredAt: "2026-07-15T00:00:00.000Z",
      uPulse: 1_000_000
    }).projection;
    const rebased = planWildsMaterialHarvest({
      projection: advanced,
      source: timber,
      actorId,
      actorPosition: timber.position,
      kaiUPulse: 1_000_001,
      commandId: "command:source-first:queued"
    });

    assert.equal(rebased.sourceHead, advanced.harvestedSources[timber.sourceId]?.head);
    assert.equal(rebased.emission?.parentHead, advanced.worldEmission?.head);
    assert.equal(rebased.operation?.intention.sourceHead, rebased.sourceHead);
  });

  it("admits the material when the bounded Phi rail lawfully awards no new emission", () => {
    const source = sourceOf("timber");
    const projection = createWildsSourceAuthorityProjection();
    const genesis = wildsWorldSourceGenesis().emission;
    const regionId = `region:${Math.floor(source.position.x / 64)}:${Math.floor(source.position.z / 64)}`;
    projection.worldEmission = createWildsWorldEmissionGenesis({
      epochId: genesis.epochId,
      epochEndsAtKaiUPulse: genesis.epochEndsAtKaiUPulse,
      globalCapacityPhiMicro: genesis.globalRemainingPhiMicro,
      regionCapacityPhiMicro: { ...genesis.regionRemainingPhiMicro, [regionId]: "0" },
      classCapacityPhiMicro: genesis.classRemainingPhiMicro,
      policyDigest: genesis.policyDigest
    });

    const command = planWildsMaterialHarvest({
      projection,
      source,
      actorId: "explorer:bounded-emission",
      actorPosition: source.position,
      kaiUPulse: 1_000_000,
      commandId: "command:bounded-emission:timber"
    });

    assert.equal(command.operation?.intention.kind, "steward.harvest-timber");
    assert.equal(command.emission, undefined);
    assert.equal(command.amountPhiMicro, undefined);
    assert.equal(command.phiAward, undefined);
  });
});
