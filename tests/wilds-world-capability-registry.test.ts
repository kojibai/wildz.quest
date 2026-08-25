import assert from "node:assert/strict";
import test from "node:test";
import type { CreatureSpecialtyFamily } from "../src/features/play/creature-capability-identity";
import {
  WILDS_WORLD_CAPABILITY_REGISTRY,
  type WildsWorldCapabilityFamily
} from "../src/features/play/wilds-world-capability-registry";

test("every canonical specialty and visible work family owns a real world action", () => {
  const specialties: readonly CreatureSpecialtyFamily[] = [
    "flight", "glide", "swim", "dive", "current", "climb", "burrow", "balance",
    "light", "camouflage", "track", "break", "resist", "anchor", "rescue"
  ];
  const expected: readonly WildsWorldCapabilityFamily[] = [...specialties, "lumber", "quarry"];

  assert.deepEqual(Object.keys(WILDS_WORLD_CAPABILITY_REGISTRY).sort(), [...expected].sort());
  for (const family of expected) {
    const definition = WILDS_WORLD_CAPABILITY_REGISTRY[family];
    assert.equal(definition.family, family);
    assert.notEqual(definition.actionKind, "none");
    assert.equal(definition.baseCost > 0, true);
    assert.equal(definition.progression.length >= 3, true);
    assert.equal(Object.isFrozen(definition), true);
  }
  assert.equal(Object.isFrozen(WILDS_WORLD_CAPABILITY_REGISTRY), true);
});

