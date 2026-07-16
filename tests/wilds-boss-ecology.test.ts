import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WILDS_BOSS_FAMILIES,
  deriveWildsBossSuccessor,
  generateWildsBoss,
  validateWildsBossModules
} from "../src/features/play/wilds-boss-ecology.js";
import { advanceDynamicSite, generateCrystalBurrow } from "../src/features/play/wilds-dynamic-sites.js";

const pulse = "2026-07-15T12:00:00.000Z";
const rumored = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
const emerged = advanceDynamicSite(advanceDynamicSite(rumored, "tracked"), "emerged");

describe("global boss ecology", () => {
  it("generates every boss family deterministically with compatible authored modules", () => {
    const bosses = WILDS_BOSS_FAMILIES.map((familyId, index) => generateWildsBoss({
      familyId,
      site: emerged,
      pulse,
      ordinal: index + 1,
      existingBosses: []
    }));

    assert.deepEqual(bosses.map((boss) => boss.familyId), WILDS_BOSS_FAMILIES);
    assert.deepEqual(WILDS_BOSS_FAMILIES.map((familyId, index) => generateWildsBoss({
      familyId,
      site: emerged,
      pulse,
      ordinal: index + 1,
      existingBosses: []
    })), bosses);
    assert.equal(bosses.every((boss) => validateWildsBossModules(boss).ok), true);
    assert.equal(new Set(bosses.map((boss) => boss.id)).size, 8);
    assert.equal(bosses.every((boss) => boss.health === boss.maxHealth), true);
  });

  it("derives one new successor identity without respawning its parent", () => {
    const parent = {
      ...generateWildsBoss({ familyId: "skycoil-tempest", site: emerged, pulse, ordinal: 1, existingBosses: [] }),
      phase: "defeated" as const,
      defeatedAt: "2026-07-15T13:00:00.000Z"
    };
    const input = {
      parent,
      causeEventId: "event:global-defeat:skycoil",
      pulse: "2026-07-16T12:00:00.000Z",
      ordinal: 2,
      existingBosses: [parent]
    };
    const successor = deriveWildsBossSuccessor(input);

    assert.ok(successor);
    assert.deepEqual(deriveWildsBossSuccessor(input), successor);
    assert.notEqual(successor.id, parent.id);
    assert.equal(successor.parentBossId, parent.id);
    assert.equal(successor.causeEventId, input.causeEventId);
    assert.equal(deriveWildsBossSuccessor({ ...input, existingBosses: [parent, successor] }), null);
  });

  it("rejects invalid emergence and incompatible module combinations", () => {
    assert.throws(() => generateWildsBoss({
      familyId: "voidroot-devourer",
      site: rumored,
      pulse,
      ordinal: 1,
      existingBosses: []
    }), /wilds_boss_site_not_emerged/);
    const boss = generateWildsBoss({ familyId: "crystal-burrower", site: emerged, pulse, ordinal: 1, existingBosses: [] });
    assert.deepEqual(validateWildsBossModules({ ...boss, modules: { ...boss.modules, anatomy: "not-a-module" } }), {
      ok: false,
      errors: ["wilds_boss_anatomy_incompatible"]
    });
  });
});
