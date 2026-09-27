import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateWildsRegionV11, projectWildsLocalRegion } from "../src/features/play/wilds-region-generator-v11";
import { sampleWildsTerrain, sampleWildsTerrainV11 } from "../src/features/play/wilds-terrain-authority";
import { wildsDiscoverySitesForRegionV11 } from "../src/features/play/wilds-discovery-sites";
import { projectWildsResourceRegionV11 } from "../src/features/play/wilds-resource-authority";
import { projectWildsAmbientLifeRegionV11 } from "../src/features/play/wilds-ambient-life";
import { hotspotsForRegion, hotspotsForRegionV11 } from "../src/features/play/hidden-hotspots";

const huge = "9007199254740993";

describe("v11 deterministic region generation", () => {
  it("replays the same bounded region without enumerating the world", () => {
    const first = generateWildsRegionV11(huge, "-2");
    assert.deepEqual(generateWildsRegionV11(huge, "-2"), first);
    assert.equal(first.version, "wildz.region.v11");
    assert.equal(first.regionX, huge);
    assert.equal(first.regionZ, "-2");
    assert.equal(first.encounterSites.length, 6);
    assert.ok(first.encounterSites.every(site => site.localX >= 0 && site.localX < 24_000_000 && site.localZ >= 0 && site.localZ < 24_000_000));
    assert.equal(new Set(first.encounterSites.map(site => site.slot)).size, 6);
  });

  it("does not alias neighboring region strings beyond Number precision", () => {
    const first = generateWildsRegionV11(huge, "0");
    const next = generateWildsRegionV11("9007199254740994", "0");
    assert.notEqual(first.terrainSeed, next.terrainSeed);
    assert.notEqual(first.siteSeed, next.siteSeed);
    assert.notDeepEqual(first.encounterSites, next.encounterSites);
  });

  it("projects only a nearby bounded region into number coordinates", () => {
    const region = generateWildsRegionV11(huge, "-2");
    const projection = projectWildsLocalRegion(region, { worldVersion: 11, regionX: huge, regionZ: "-2", localX: 12_000_000, localZ: 5_000_000 });
    assert.equal(projection.encounterSites.length, 6);
    assert.ok(projection.encounterSites.every(site => Math.abs(site.x) <= 24 && Math.abs(site.z) <= 24));
    assert.throws(() => projectWildsLocalRegion(region, { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 }), /distant|nearby|projection/i);
  });

  it("keeps terrain continuous and all v11 authorities keyed to the same exact address", () => {
    const left = sampleWildsTerrainV11({ worldVersion: 11, regionX: huge, regionZ: "-2", localX: 23_999_999, localZ: 12_000_000 });
    const right = sampleWildsTerrainV11({ worldVersion: 11, regionX: "9007199254740994", regionZ: "-2", localX: 0, localZ: 12_000_000 });
    assert.ok(Math.abs(left.elevation - right.elevation) < 0.00001);
    assert.equal(left.version, "wildz.terrain.v11");
    const sites = wildsDiscoverySitesForRegionV11(huge, "-2");
    const hotspots = hotspotsForRegionV11(huge, "-2");
    const resources = projectWildsResourceRegionV11(huge, "-2");
    const ambient = projectWildsAmbientLifeRegionV11(huge, "-2");
    assert.equal(sites.length, 6);
    assert.deepEqual(hotspots.map(site => site.address), sites.map(site => site.address));
    assert.equal(resources.length, 3);
    assert.equal(ambient.length, 2);
    assert.ok(resources.every(resource => resource.address.regionX === huge));
    assert.ok(ambient.every(life => life.regionX === huge));
  });

  it("leaves legacy central terrain and hotspots stable", () => {
    const before = sampleWildsTerrain(0, 0);
    const oldHotspots = hotspotsForRegion(0, 0);
    generateWildsRegionV11("0", "0");
    assert.deepEqual(sampleWildsTerrain(0, 0), before);
    assert.deepEqual(hotspotsForRegion(0, 0), oldHotspots);
  });
});
