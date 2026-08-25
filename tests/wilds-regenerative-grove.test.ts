import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather";
import { projectWildsRegenerativeGrove } from "../src/features/play/wilds-regenerative-grove";

describe("regenerative Grove identity and observation", () => {
  it("projects one deterministic region-bound Grove without writing", () => {
    const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "world" });
    const weather = projectWildsRegionalWeather({
      moment, region: { x: 0, z: 0 }, biome: "grove", elevation: 0.2, waterProximity: 0.4, ecologyHead: "a".repeat(64)
    });
    const input = { regionId: "region:0:0", regionHead: "b".repeat(64), position: { x: 12, z: 18 }, moment, weather } as const;
    const first = projectWildsRegenerativeGrove(input);
    const second = projectWildsRegenerativeGrove(structuredClone(input));

    assert.deepEqual(second, first);
    assert.equal(first.writes, 0);
    assert.match(first.head, /^sha256:[a-f0-9]{64}$/);
    assert.ok(first.ecology.soil > 0);
    assert.ok(first.ecology.moisture > 0);
    assert.ok(first.availableActions.includes("observe"));
    assert.equal(Object.isFrozen(first), true);
  });

  it("gives different regions different living identities", () => {
    const moment = deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "world" });
    const weather = projectWildsRegionalWeather({
      moment, region: { x: 0, z: 0 }, biome: "grove", elevation: 0.2, waterProximity: 0.4, ecologyHead: "a".repeat(64)
    });
    const left = projectWildsRegenerativeGrove({ regionId: "region:0:0", regionHead: "b".repeat(64), position: { x: 12, z: 18 }, moment, weather });
    const right = projectWildsRegenerativeGrove({ regionId: "region:1:0", regionHead: "c".repeat(64), position: { x: 140, z: 18 }, moment, weather });
    assert.notEqual(right.groveId, left.groveId);
    assert.notEqual(right.head, left.head);
  });
});
