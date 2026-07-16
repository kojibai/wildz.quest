import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WILDS_ECOLOGY_FAMILIES,
  advanceWildsEcologySite,
  deriveWildsEcologyChild,
  generateWildsEcologyEnsemble,
  generateWildsEcologySite,
  isWildsEcologyPositionSafe
} from "../src/features/play/wilds-ecology.js";

const pulse = "2026-07-15T20:00:00.000Z";

describe("Wilds regional ecology grammar", () => {
  it("generates every authored family deterministically", () => {
    const sites = generateWildsEcologyEnsemble({ pulse, existingSites: [], ordinalStart: 1 });
    const replay = generateWildsEcologyEnsemble({ pulse, existingSites: [], ordinalStart: 1 });

    assert.deepEqual(replay, sites);
    assert.deepEqual(sites.map((site) => site.familyId), [...WILDS_ECOLOGY_FAMILIES]);
    assert.equal(sites.every((site) => site.schema === "receiz.wilds_ecology_site.v1"), true);
    assert.equal(new Set(sites.map((site) => site.id)).size, WILDS_ECOLOGY_FAMILIES.length);
    assert.equal(sites.every((site, index) => isWildsEcologyPositionSafe(site.position, sites.slice(0, index))), true);
  });

  it("keeps generated sites inside global and regional density limits", () => {
    const first = generateWildsEcologyEnsemble({ pulse, existingSites: [], ordinalStart: 1 });
    const saturated = Array.from({ length: 24 }, (_, index) => ({
      ...first[index % first.length]!,
      id: `site:saturated:${index}`,
      position: { x: -230 + index * 19, z: 230 - index * 17 }
    }));

    assert.deepEqual(generateWildsEcologyEnsemble({ pulse, existingSites: saturated, ordinalStart: 25 }), []);
    assert.equal(first.every((site) => Math.max(Math.abs(site.position.x), Math.abs(site.position.z)) <= 240), true);
  });

  it("allows only the authored lifecycle and never revives a terminal site", () => {
    const site = generateWildsEcologySite({ familyId: "stormfront", pulse, ordinal: 1, existingSites: [] });
    assert.ok(site);
    const discovered = advanceWildsEcologySite(site, "discovered");
    const active = advanceWildsEcologySite(discovered, "active");
    const resolving = advanceWildsEcologySite(active, "resolving");
    const aftermath = advanceWildsEcologySite(resolving, "aftermath");
    const historical = advanceWildsEcologySite(aftermath, "historical");

    assert.equal(historical.phase, "historical");
    assert.throws(() => advanceWildsEcologySite(site, "aftermath"), /wilds_ecology_transition_invalid/);
    assert.throws(() => advanceWildsEcologySite(historical, "active"), /wilds_ecology_transition_invalid/);
  });

  it("derives at most one stable compatible child from aftermath", () => {
    const site = generateWildsEcologySite({ familyId: "stormfront", pulse, ordinal: 1, existingSites: [] });
    assert.ok(site);
    const parent = { ...site, phase: "aftermath" as const };
    const child = deriveWildsEcologyChild({ parent, ordinal: 2, existingSites: [parent] });

    assert.deepEqual(deriveWildsEcologyChild({ parent, ordinal: 2, existingSites: [parent] }), child);
    assert.equal(child === null || ["unstable-portal", "echo-ruin", "settlement-distress"].includes(child.familyId), true);
    assert.throws(() => deriveWildsEcologyChild({ parent: site, ordinal: 2, existingSites: [site] }), /wilds_ecology_parent_not_aftermath/);
  });
});
