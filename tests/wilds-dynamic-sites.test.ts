import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks.js";
import { WILDS_MAJOR_ROUTES } from "../src/features/play/wilds-world-geography.js";
import {
  advanceDynamicSite,
  generateCrystalBurrow,
  isDynamicSitePositionSafe
} from "../src/features/play/wilds-dynamic-sites.js";

const pulse = "2026-07-15T12:00:00.000Z";

describe("Crystal Burrow dynamic site", () => {
  it("generates one stable bounded site per Pulse ordinal", () => {
    const first = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
    const replay = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
    const next = generateCrystalBurrow({ pulse, ordinal: 2, activeSites: [first] });

    assert.deepEqual(replay, first);
    assert.notEqual(next.id, first.id);
    assert.notDeepEqual(next.position, first.position);
    assert.match(first.id, /^site:crystal-burrow:[a-f0-9]{24}$/);
    assert.equal(first.phase, "rumored");
    assert.equal(Date.parse(first.expiresAt) - Date.parse(first.spawnedAt), 72 * 60 * 60 * 1_000);
    assert.equal(Math.max(Math.abs(first.position.x), Math.abs(first.position.z)) <= 240, true);
  });

  it("keeps sites clear of authored landmarks, routes, and other sites", () => {
    const first = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
    const second = generateCrystalBurrow({ pulse, ordinal: 2, activeSites: [first] });

    assert.equal(isDynamicSitePositionSafe(first.position, []), true);
    assert.equal(isDynamicSitePositionSafe(second.position, [first]), true);
    for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
      assert.equal(Math.hypot(first.position.x - landmark.position.x, first.position.z - landmark.position.z) >= landmark.radius + 12, true);
    }
    assert.equal(WILDS_MAJOR_ROUTES.length > 0, true);
  });

  it("allows only the authored lifecycle and never revives a terminal site", () => {
    const site = generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] });
    const tracked = advanceDynamicSite(site, "tracked");
    const emerged = advanceDynamicSite(tracked, "emerged");
    const engaged = advanceDynamicSite(emerged, "engaged");
    const defeated = advanceDynamicSite(engaged, "defeated");
    const memorial = advanceDynamicSite(defeated, "memorialized");

    assert.equal(memorial.phase, "memorialized");
    assert.throws(() => advanceDynamicSite(site, "defeated"), /wilds_dynamic_site_transition_invalid/);
    assert.throws(() => advanceDynamicSite(memorial, "emerged"), /wilds_dynamic_site_transition_invalid/);
  });
});
