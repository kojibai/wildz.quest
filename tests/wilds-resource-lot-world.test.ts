import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment.js";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate.js";
import { admitWildsGroveAction, previewWildsGroveAction, projectWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove.js";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather.js";
import { createWildsGroveResourceLot } from "../src/features/play/wilds-resource-lot.js";
import { admitWildsEmissionOutcome, createWildsWorldEmissionGenesis } from "../src/features/play/wilds-world-emission.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { wildsLivingWorldSuccessorHeads } from "../src/lib/receiz/wilds-world-emission-source.js";

function fixture() {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "world" });
  const weather = projectWildsRegionalWeather({ moment, region: { x: 0, z: 0 }, biome: "grove", elevation: .2, waterProximity: .4, ecologyHead: "a".repeat(64) });
  const genesis = projectWildsRegenerativeGrove({ regionId: "region:0:0", regionHead: "b".repeat(64), position: { x: 12, z: 18 }, moment, weather });
  let grove = genesis;
  const actor = { id: "explorer", head: "d".repeat(64) };
  const professions = ["gather", "pollinate", "sow", "transform-nectar", "build-hive", "harvest-honey"];
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId: "creature:bee", creatureHead: "c".repeat(64), condition: { energy: 94, fatigue: 2, injury: 0, stress: 2 }, bond: 90,
    preferences: { professions, avoidHazards: [] }, capabilities: { professions }, safety: { risk: 3, hazards: [], supportAvailable: true },
    requested: { professions, maxActions: 12 }, kaiUPulse: moment.uPulse
  });
  const mandate = createWildsCreatureMandate({
    consent, creatureSubjectId: "creature:bee", creatureHead: "c".repeat(64), region: { x: 0, z: 0 }, professions,
    allowedResourceIds: [grove.groveId], maxActions: 12, issuedAtKaiUPulse: moment.uPulse, expiresAtKaiUPulse: moment.uPulse + 10_000_000
  });
  const emission = createWildsWorldEmissionGenesis({
    epochId: "epoch:resource:one", epochEndsAtKaiUPulse: 100_000_000, globalCapacityPhiMicro: "10000000",
    regionCapacityPhiMicro: { "region:0:0": "10000000" }, classCapacityPhiMicro: { ecology: "10000000", construction: "10000000" }, policyDigest: "e".repeat(64)
  });
  for (const action of ["observe", "gather", "pollinate", "sow", "transform-nectar", "build-hive"] as const) {
    const preview = previewWildsGroveAction({ grove, action, actor, mandate, weather, moment, emission });
    grove = admitWildsGroveAction({ grove, preview });
  }
  const preview = previewWildsGroveAction({ grove, action: "harvest-honey", actor, mandate, weather, moment, emission });
  const admittedGrove = admitWildsGroveAction({ grove, preview });
  const admittedEmission = admitWildsEmissionOutcome({ emission, operation: preview.operation, contributionClass: "ecology", preview: preview.emission });
  const lot = createWildsGroveResourceLot({
    operation: preview.operation,
    ownerReceizId: actor.id,
    sourceGrove: { groveId: grove.groveId, head: grove.head, honey: grove.materials.honey },
    admittedGrove: { groveId: admittedGrove.groveId, head: admittedGrove.head, parentHead: admittedGrove.parentHead, honey: admittedGrove.materials.honey }
  });
  assert.ok(lot);
  return { moment, genesis: grove, emission, preview, admittedGrove, admittedEmission, lot };
}

describe("resource custody in shared-world continuity", () => {
  it("admits and replays one exact resource lot with its Grove operation", () => {
    const data = fixture();
    const occurredAt = kaiUPulseToISOString(data.moment.uPulse);
    const authority = { actorId: "explorer", canonical: true, pulse: occurredAt, occurredAt, uPulse: data.moment.uPulse } as const;
    const service = new WildsWorldService();
    service.execute({ type: "grove.observe", grove: data.genesis, emission: data.emission, commandId: "grove:resource:discover" }, authority);
    service.execute({
      type: "grove.act", operation: data.preview.operation, grove: data.admittedGrove, emission: data.admittedEmission,
      amountPhiMicro: data.preview.emission.amountPhiMicro, resourceLot: data.lot, commandId: "grove:resource:harvest"
    }, authority);

    const once = service.snapshot();
    const beforeTransfer = service.checkpoint();
    assert.deepEqual(once.resourceLots[data.lot.lotId], data.lot);
    const restored = new WildsWorldService({ checkpoint: service.checkpoint() }).snapshot();
    assert.deepEqual(restored.resourceLots, once.resourceLots);

    service.execute({
      type: "resource.transfer.admit", lotId: data.lot.lotId, ownerReceizId: "nova", subjectId: "resource:subject:one",
      subjectHead: "f".repeat(64), receiptId: "receipt:one", transferId: "transfer:one", commandId: "resource:transfer:one"
    }, { ...authority, actorId: "nova" });
    assert.equal(service.snapshot().resourceCustody[data.lot.lotId]?.ownerReceizId, "nova");
    const custodyHeads = wildsLivingWorldSuccessorHeads({
      actorId: "explorer", operation: data.preview.operation, currentCheckpoint: beforeTransfer, nextCheckpoint: service.checkpoint(),
      currentEmission: data.admittedEmission, nextEmission: data.admittedEmission, currentGrove: data.admittedGrove, nextGrove: data.admittedGrove
    });
    assert.notEqual(custodyHeads.inventory.current, custodyHeads.inventory.next);

    const duplicate = service.execute({
      type: "grove.act", operation: data.preview.operation, grove: data.admittedGrove, emission: data.admittedEmission,
      amountPhiMicro: data.preview.emission.amountPhiMicro, resourceLot: data.lot, commandId: "grove:resource:harvest"
    }, authority);
    assert.equal(duplicate.events.length, 0);
    assert.equal(Object.keys(duplicate.projection.resourceLots).length, 1);
  });

  it("rejects a harvest without its exact resource custody output", () => {
    const data = fixture();
    const occurredAt = kaiUPulseToISOString(data.moment.uPulse);
    const authority = { actorId: "explorer", canonical: true, pulse: occurredAt, occurredAt, uPulse: data.moment.uPulse } as const;
    const service = new WildsWorldService();
    service.execute({ type: "grove.observe", grove: data.genesis, emission: data.emission, commandId: "grove:resource:discover:missing" }, authority);
    assert.throws(() => service.execute({
      type: "grove.act", operation: data.preview.operation, grove: data.admittedGrove, emission: data.admittedEmission,
      amountPhiMicro: data.preview.emission.amountPhiMicro, commandId: "grove:resource:missing"
    }, authority), /wilds_world_grove_resource_lot_required/);
  });
});
