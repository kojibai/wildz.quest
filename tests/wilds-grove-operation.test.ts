import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { previewWildsGroveAction, admitWildsGroveAction, projectWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather";
import { createWildsWorldEmissionGenesis } from "../src/features/play/wilds-world-emission";

function setup() {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "world" });
  const weather = projectWildsRegionalWeather({ moment, region: { x: 0, z: 0 }, biome: "grove", elevation: 0.2, waterProximity: 0.4, ecologyHead: "a".repeat(64) });
  const grove = projectWildsRegenerativeGrove({ regionId: "region:0:0", regionHead: "b".repeat(64), position: { x: 12, z: 18 }, moment, weather });
  const professions = ["gather", "pollinate", "sow", "transform-nectar", "build-hive", "harvest-honey"];
  const creatureHead = "c".repeat(64);
  const consent = evaluateWildsCreatureConsent({
    creatureSubjectId: "creature:bee", creatureHead,
    condition: { energy: 94, fatigue: 2, injury: 0, stress: 2 }, bond: 90,
    preferences: { professions, avoidHazards: [] }, capabilities: { professions },
    safety: { risk: 3, hazards: [], supportAvailable: true }, requested: { professions, maxActions: 12 }, kaiUPulse: moment.uPulse
  });
  const mandate = createWildsCreatureMandate({
    consent, creatureSubjectId: "creature:bee", creatureHead, region: { x: 0, z: 0 }, professions,
    allowedResourceIds: [grove.groveId], maxActions: 12, issuedAtKaiUPulse: moment.uPulse,
    expiresAtKaiUPulse: moment.uPulse + 10_000_000
  });
  const emission = createWildsWorldEmissionGenesis({
    epochId: "epoch:grove:one",
    epochEndsAtKaiUPulse: moment.uPulse + 100_000_000,
    globalCapacityPhiMicro: "10000000",
    regionCapacityPhiMicro: { "region:0:0": "10000000" },
    classCapacityPhiMicro: { ecology: "10000000", construction: "10000000" },
    policyDigest: "e".repeat(64)
  });
  return { grove, weather, mandate, moment, emission, actor: { id: "player:one", head: "d".repeat(64) } };
}

describe("complete regenerative Grove causal loop", () => {
  it("conserves materials through observation, cooperative growth, hive construction, and honey harvest", () => {
    const context = setup();
    let grove = context.grove;
    for (const action of ["observe", "gather", "pollinate", "sow", "transform-nectar", "build-hive", "harvest-honey"] as const) {
      const preview = previewWildsGroveAction({ ...context, grove, action });
      assert.equal(preview.valid, true, `${action}: ${preview.reasons.join(",")}`);
      assert.equal(preview.writes, 0);
      if (action === "pollinate") assert.ok(BigInt(preview.emission.amountPhiMicro) > 0n);
      grove = admitWildsGroveAction({ grove, preview });
    }

    assert.equal(grove.materials.fallenFiber, 0);
    assert.equal(grove.materials.nectar, 0);
    assert.equal(grove.materials.honey, 1);
    assert.equal(grove.structures.hive, 1);
    assert.ok(grove.ecology.flowers > context.grove.ecology.flowers);
    assert.ok(grove.ecology.pollinators > context.grove.ecology.pollinators);
    assert.ok(grove.discoveries.includes("discovery:living-honey"));
  });

  it("creates restoration debt when honey is overharvested", () => {
    const context = setup();
    let grove = context.grove;
    for (const action of ["observe", "gather", "pollinate", "sow", "transform-nectar", "build-hive", "harvest-honey"] as const) {
      const preview = previewWildsGroveAction({ ...context, grove, action });
      grove = admitWildsGroveAction({ grove, preview });
    }
    const preview = previewWildsGroveAction({ ...context, grove, action: "harvest-honey" });
    assert.ok(preview.operation.consequences.restorationDebt > 0);
  });
});
