import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectWildsMonuments,
  projectVisibleWildsMonuments,
  projectWildsWaterfallChute,
  appendWildsDiscoveryVisualSolids,
  type WildsMonumentSite
} from "../src/features/play/wilds-discovery-monuments";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime, writeWildsSiteRuntimeMovement, type WildsSiteMovementOutput } from "../src/features/play/wilds-site-runtime";

function ruin(regionX: number, regionZ: number): WildsMonumentSite {
  return {
    key: `wildz.site.v1:${regionX}:${regionZ}:3:0123456789abcdef`,
    regionX, regionZ, slot: 3, family: "ruin",
    entrance: { x: regionX * 128 + 96, y: 2, z: regionZ * 128 + 96, radius: 2.2, layer: "ground" }
  };
}

const ruins = Array.from({ length: 100 }, (_, index) => ruin(index % 10 - 5, Math.floor(index / 10) - 5));

describe("Sparse discovery monuments", () => {
  it("selects at most one ruin per two-by-two region block without changing source sites", () => {
    const before = JSON.stringify(ruins);
    const monuments = projectWildsMonuments(ruins);
    assert.ok(monuments.length > 10);
    const blocks = monuments.map(monument => `${Math.floor(monument.position.x / 256)}:${Math.floor(monument.position.z / 256)}`);
    assert.equal(new Set(blocks).size, blocks.length);
    assert.equal(JSON.stringify(ruins), before);
    assert.ok(monuments.every(monument => ruins.some(site => site.key === monument.siteKey && site.entrance.x === monument.position.x && site.entrance.z === monument.position.z)));
    assert.equal(projectWildsMonuments(ruins.map(site => ({ ...site, family: "spring" }))).length, 0);
  });

  it("retains identities, choices and visual variations across input order and partial streaming", () => {
    const monuments = projectWildsMonuments(ruins);
    assert.deepEqual(projectWildsMonuments([...ruins].reverse()), monuments);
    assert.deepEqual(ruins.flatMap(site => projectWildsMonuments([site])).sort((a, b) => a.id.localeCompare(b.id)), monuments);
    assert.deepEqual(new Set(monuments.map(monument => monument.type)), new Set(["stone-arch", "compass", "prism"]));
    assert.ok(new Set(monuments.map(monument => JSON.stringify(monument.style))).size >= 10);
    assert.ok(monuments.every(monument => Object.isFrozen(monument) && Object.isFrozen(monument.position)));
  });

  it("provides distinct actionable descriptors and matching visible solid parts", () => {
    for (const monument of projectWildsMonuments(ruins)) {
      assert.ok(monument.name.length > 4);
      assert.ok(monument.lore.length > 40);
      assert.equal(monument.puzzlePattern.length, 3);
      assert.deepEqual([...monument.puzzlePattern].sort(), [0, 1, 2]);
      assert.ok(Number.isFinite(monument.viewHeading));
      assert.ok(monument.physicalSolids.length > 0);
      for (const solid of monument.physicalSolids) {
        assert.equal(solid.siteKey, monument.siteKey);
        assert.equal(solid.spaceId, "wildz.space.outer.v1");
        assert.ok(solid.halfExtents.x > 0 && solid.halfExtents.y > 0 && solid.halfExtents.z > 0);
        assert.ok(monument.parts.some(part => part.solidId === solid.id));
      }
    }
  });

  it("bounds nearby detail while retaining the closest actionable monument", () => {
    const monuments = projectWildsMonuments(ruins);
    const position = monuments[0]!.position;
    const nearby = projectVisibleWildsMonuments(monuments, position);
    assert.equal(nearby.length, 1);
    assert.equal(nearby[0]!.monument.id, monuments[0]!.id);
    assert.equal(nearby[0]!.distance, 0);
    assert.equal(projectVisibleWildsMonuments(monuments, { x: 1_000_000, z: 1_000_000 }).length, 0);
    assert.equal(projectVisibleWildsMonuments(monuments, { x: Number.NaN, z: 0 }).length, 0);
  });
  it("retains submerged ruin sites without developing dry monument experiences there", () => {
    const before = JSON.stringify(ruins);
    assert.equal(projectWildsMonuments(ruins.map(site => ({ ...site, entrance: { ...site.entrance, y: -1.4 } }))).length, 0);
    assert.equal(JSON.stringify(ruins), before);
  });
  it("keeps monument piers and receivers outside the existing ordinary walking lane", () => {
    for (const monument of projectWildsMonuments(ruins)) {
      assert.ok(monument.physicalSolids.every(solid => Math.abs(solid.center.x - monument.position.x) > solid.halfExtents.x + .65 || Math.abs(solid.center.z - monument.position.z) > solid.halfExtents.z + 6 || solid.center.y - solid.halfExtents.y >= monument.position.y + 1.8), `monument blocks ordinary route: ${monument.id}`);
    }
  });
  it("retains clearance along the existing ruin ability route", () => {
    for (const monument of projectWildsMonuments(ruins)) {
      for (let step = 0; step <= 48; step++) {
        const t = step / 48, x = monument.position.x + 2 * t, y = monument.position.y + 4 * t, z = monument.position.z - 3 * t;
        assert.ok(monument.physicalSolids.every(solid => Math.abs(solid.center.x - x) > solid.halfExtents.x + .65 || Math.abs(solid.center.z - z) > solid.halfExtents.z + .65 || solid.center.y - solid.halfExtents.y >= y + 1.8 || solid.center.y + solid.halfExtents.y <= y), `ability route blocked at ${monument.id}`);
      }
    }
  });
  it("blocks grounded movement at every visible stone support through the prepared runtime query", () => {
    const monuments = projectWildsMonuments(ruins);
    const runtime = prepareWildsSiteRuntime({ ...admitWildsDiscoveryPhysicalNeighborhood(-3, 0), sites: [], surfaces: [], solids: monuments.flatMap(monument => monument.physicalSolids), mountainFields: [], ceilings: [], portals: [], waterVolumes: [], encounterVolumes: [] });
    const movement: WildsSiteMovementOutput = { x: 0, z: 0, floorY: 0, ceilingY: Number.NaN, surfaceId: null, flooded: false, blocked: false, blockedByClimb: false };
    for (const monument of monuments) {
      for (const solid of monument.physicalSolids.filter(solid => solid.center.y - solid.halfExtents.y <= monument.position.y + .01)) {
        writeWildsSiteRuntimeMovement(movement, runtime, solid.spaceId, solid.center.x - 2, monument.position.y, solid.center.z, solid.center.x, solid.center.z, .38, monument.position.y);
        assert.equal(movement.blocked, true, `movement passed through visible support: ${solid.id}`);
        assert.notEqual(movement.x, solid.center.x);
        const part = monument.parts.find(part => part.solidId === solid.id)!;
        assert.ok(Math.abs(part.size.y - solid.halfExtents.y * 2) <= .000002);
      }
    }
  });
});

describe("Waterfall rock chutes", () => {
  const sites = Array.from({ length: 48 }, (_, index) => wildsDiscoverySitesForRegion(index - 24, index * 3 - 50)).flat().filter(site => site.waterfall);
  it("retains hydraulic anchors and matches each rock stratum to a world solid", () => {
    for (const site of sites) {
      const before = JSON.stringify(site);
      const chute = projectWildsWaterfallChute(site)!;
      assert.equal(chute.flowPath, site.waterfall!.flowPath);
      assert.equal(chute.source, site.waterfall!.source);
      assert.equal(chute.pool, site.waterfall!.pool);
      assert.ok(chute.parts.length >= 2 && chute.parts.length <= 12);
      assert.equal(chute.parts.length, chute.physicalSolids.length);
      for (const part of chute.parts) {
        const solid = chute.physicalSolids.find(solid => solid.id === part.solidId)!;
        assert.ok(solid);
        assert.deepEqual(solid.center, { x: site.entrance.x + part.position.x, y: site.entrance.y + part.position.y, z: site.entrance.z + part.position.z });
        assert.deepEqual(solid.halfExtents, { x: part.size.x / 2, y: part.size.y / 2, z: part.size.z / 2 });
      }
      assert.equal(JSON.stringify(site), before);
      assert.equal(projectWildsWaterfallChute(site), chute);
    }
  });
  it("leaves the existing safe route and cave portal clear", () => {
    for (const site of sites) {
      const chute = projectWildsWaterfallChute(site)!;
      for (const route of site.routes.filter(route => route.safe)) {
        for (let segment = 1; segment < route.points.length; segment++) {
          const a = route.points[segment - 1]!, b = route.points[segment]!;
          for (let step = 0; step <= 24; step++) {
            const t = step / 24, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
            assert.ok(chute.physicalSolids.every(solid => Math.abs(solid.center.x - x) > solid.halfExtents.x + .65 || Math.abs(solid.center.z - z) > solid.halfExtents.z + .65 || solid.center.y - solid.halfExtents.y >= y + 1.8 || solid.center.y + solid.halfExtents.y <= y), `safe route blocked at ${site.key}`);
          }
        }
      }
      const portal = site.waterfall!.hiddenEntrance;
      if (portal) assert.ok(chute.physicalSolids.every(solid => Math.abs(solid.center.x - portal.x) > solid.halfExtents.x + 1.1 || Math.abs(solid.center.z - portal.z) > solid.halfExtents.z + 1.1 || solid.center.y - solid.halfExtents.y >= portal.y + 2.2));
    }
  });
  it("appends shared visual solids once without changing canonical site/water geometry", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(-3, 0);
    const before = JSON.stringify(physical);
    const next = appendWildsDiscoveryVisualSolids(physical);
    assert.ok(next.solids.length > physical.solids.length);
    assert.equal(next.sites, physical.sites);
    assert.equal(next.waterVolumes, physical.waterVolumes);
    assert.equal(next.portals, physical.portals);
    assert.equal(new Set(next.solids.map(solid => solid.id)).size, next.solids.length);
    assert.equal(appendWildsDiscoveryVisualSolids(physical), next);
    assert.equal(appendWildsDiscoveryVisualSolids(next), next);
    assert.equal(JSON.stringify(physical), before);
  });
});
