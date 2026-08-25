import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { admitWildsGroveAction, previewWildsGroveAction, projectWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { admitWildsEmission, createWildsWorldEmissionGenesis } from "../src/features/play/wilds-world-emission";

function fixture() {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "world" });
  const weather = projectWildsRegionalWeather({ moment, region: { x: 0, z: 0 }, biome: "grove", elevation: 0.2, waterProximity: 0.5, ecologyHead: "a".repeat(64) });
  let grove = projectWildsRegenerativeGrove({ regionId: "region:0:0", regionHead: "b".repeat(64), position: { x: 8, z: 9 }, moment, weather });
  let emission = createWildsWorldEmissionGenesis({
    epochId: "epoch:world:one", epochEndsAtKaiUPulse: 100_000_000,
    globalCapacityPhiMicro: "10000000", regionCapacityPhiMicro: { "region:0:0": "10000000" },
    classCapacityPhiMicro: { ecology: "10000000" }, policyDigest: "c".repeat(64)
  });
  const actor = { id: "player:one", head: "d".repeat(64) };
  const professions = ["gather", "pollinate"];
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId: "creature:bee", creatureHead: "e".repeat(64),
    condition: { energy: 90, fatigue: 2, injury: 0, stress: 2 }, bond: 90,
    preferences: { professions, avoidHazards: [] }, capabilities: { professions },
    safety: { risk: 2, hazards: [], supportAvailable: true }, requested: { professions, maxActions: 4 }, kaiUPulse: moment.uPulse
  });
  const mandate = createWildsCreatureMandate({
    consent, creatureSubjectId: "creature:bee", creatureHead: "e".repeat(64), region: { x: 0, z: 0 }, professions,
    allowedResourceIds: [grove.groveId], maxActions: 4, issuedAtKaiUPulse: moment.uPulse, expiresAtKaiUPulse: 20_000_000
  });
  for (const action of ["observe", "gather"] as const) {
    const preview = previewWildsGroveAction({ grove, action, actor, mandate, weather, moment, emission });
    grove = admitWildsGroveAction({ grove, preview });
  }
  const pollination = previewWildsGroveAction({ grove, action: "pollinate", actor, mandate, weather, moment, emission });
  const nextGrove = admitWildsGroveAction({ grove, preview: pollination });
  const nextEmission = admitWildsEmission({ emission, operation: pollination.operation, contributionClass: "ecology", preview: pollination.emission });
  return { moment, grove, emission, pollination, nextGrove, nextEmission };
}

describe("Grove shared-world continuity", () => {
  it("discovers, admits, checkpoints, and replays exact Grove and emission authority once", () => {
    const data = fixture();
    const occurredAt = kaiUPulseToISOString(data.moment.uPulse);
    const authority = { actorId: "player:one", canonical: true, pulse: occurredAt, occurredAt, uPulse: data.moment.uPulse } as const;
    const service = new WildsWorldService();
    service.execute({ type: "grove.observe", grove: data.grove, emission: data.emission, commandId: "grove:discover:one" }, authority);
    service.execute({
      type: "grove.act", operation: data.pollination.operation, grove: data.nextGrove,
      emission: data.nextEmission, amountPhiMicro: data.pollination.emission.amountPhiMicro, commandId: "grove:pollinate:one"
    }, authority);
    const once = service.snapshot();
    const duplicate = service.execute({
      type: "grove.act", operation: data.pollination.operation, grove: data.nextGrove,
      emission: data.nextEmission, amountPhiMicro: data.pollination.emission.amountPhiMicro, commandId: "grove:pollinate:one"
    }, authority);

    assert.equal(duplicate.events.length, 0);
    assert.equal(duplicate.projection.revision, once.revision);
    assert.equal(once.groves[data.grove.groveId]?.head, data.nextGrove.head);
    assert.equal(once.worldEmission?.head, data.nextEmission.head);
    assert.equal(once.livingOperations[data.pollination.operation.operationId]?.planDigest, data.pollination.operation.planDigest);

    const restored = new WildsWorldService({ checkpoint: service.checkpoint() }).snapshot();
    assert.deepEqual(restored.groves, once.groves);
    assert.deepEqual(restored.worldEmission, once.worldEmission);
    assert.deepEqual(restored.contributionHistory, once.contributionHistory);
  });
});
