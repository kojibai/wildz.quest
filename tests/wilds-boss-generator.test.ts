import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceDynamicSite, generateCrystalBurrow } from "../src/features/play/wilds-dynamic-sites.js";
import {
  generateCrystalBurrower,
  isCrystalBurrowerAnatomyCompatible
} from "../src/features/play/wilds-boss-generator.js";

const pulse = "2026-07-15T12:00:00.000Z";

describe("modular Crystal Burrower boss", () => {
  const rumored = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
  const emerged = advanceDynamicSite(advanceDynamicSite(rumored, "tracked"), "emerged");

  it("rebuilds the same authored boss identity from the same site and Pulse", () => {
    const boss = generateCrystalBurrower({ site: emerged, pulse, ordinal: 1 });
    const replay = generateCrystalBurrower({ site: emerged, pulse, ordinal: 1 });

    assert.deepEqual(replay, boss);
    assert.match(boss.id, /^boss:crystal-burrower:[a-f0-9]{24}$/);
    assert.match(boss.name, /Crystal Burrower$/);
    assert.equal(boss.siteId, emerged.id);
    assert.equal(boss.health, boss.maxHealth);
    assert.equal(boss.maxHealth >= 180_000 && boss.maxHealth <= 260_000, true);
    assert.equal(isCrystalBurrowerAnatomyCompatible(boss.anatomy), true);
    assert.notEqual(boss.affinities[0], boss.affinities[1]);
  });

  it("creates a new permanent identity for every ordinal and site", () => {
    const first = generateCrystalBurrower({ site: emerged, pulse, ordinal: 1 });
    const second = generateCrystalBurrower({ site: emerged, pulse, ordinal: 2 });
    const otherSite = advanceDynamicSite(advanceDynamicSite(generateCrystalBurrow({ pulse, ordinal: 2, activeSites: [rumored] }), "tracked"), "emerged");
    const third = generateCrystalBurrower({ site: otherSite, pulse, ordinal: 1 });

    assert.equal(new Set([first.id, second.id, third.id]).size, 3);
    assert.equal(new Set([first.seedDigest, second.seedDigest, third.seedDigest]).size, 3);
  });

  it("refuses to emerge a boss before its site is ready", () => {
    assert.throws(() => generateCrystalBurrower({ site: rumored, pulse, ordinal: 1 }), /wilds_boss_site_not_emerged/);
    assert.equal(isCrystalBurrowerAnatomyCompatible({ core: "prism-heart", shell: "basalt", limbs: "tunneler", crown: "halo" }), false);
  });
});
