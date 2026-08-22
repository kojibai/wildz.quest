import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  admitWildsDiscoveryNeighborhood,
  admitWildsDiscoveryPhysicalNeighborhood,
  normalizeWildsSiteSpaceState,
  projectWildsDiscoverySiteApproach,
  projectWildsSiteEncounterContext,
  projectWildsDiscoverySiteFall,
  projectWildsDiscoverySiteOverflight,
  wildsDiscoverySiteCacheSize,
  wildsDiscoverySiteDiagnostics,
  wildsDiscoverySitesForRegion,
  wildsDiscoveryPhysicalCacheSize,
  wildsDiscoverySiteRegionForPosition,
  isCanonicalWildsDiscoverySiteKey,
  writeWildsSitePhysicalSample,
  wildsSiteSurfaceAt
} from "../src/features/play/wilds-discovery-sites";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";

describe("persistent deterministic Wilds discovery sites", () => {
  it("bounds site admission to canonical playable regions and clips edge neighborhoods", () => {
    const positiveEdge = wildsDiscoverySiteRegionForPosition({ x: 500_000_000, z: 500_000_000 });
    const negativeEdge = wildsDiscoverySiteRegionForPosition({ x: -500_000_000, z: -500_000_000 });
    assert.deepEqual(positiveEdge, { x: 3_906_249, z: 3_906_249 });
    assert.deepEqual(negativeEdge, { x: -3_906_250, z: -3_906_250 });
    assert.throws(() => wildsDiscoverySitesForRegion(3_906_250, 0), /region_x_invalid/);
    assert.throws(() => wildsDiscoverySitesForRegion(0, -3_906_251), /region_z_invalid/);
    const positiveSites = admitWildsDiscoveryNeighborhood(positiveEdge.x, positiveEdge.z);
    const negativeSites = admitWildsDiscoveryNeighborhood(negativeEdge.x, negativeEdge.z);
    for (const site of [...positiveSites, ...negativeSites]) {
      assert.equal(isCanonicalWildsDiscoverySiteKey(site.key), true);
      assert.ok(site.entrance.x >= -500_000_000 && site.entrance.x <= 500_000_000);
      assert.ok(site.entrance.z >= -500_000_000 && site.entrance.z <= 500_000_000);
    }
  });

  it("maps world positions to the canonical 128-unit site region across negative boundaries", () => {
    assert.deepEqual(wildsDiscoverySiteRegionForPosition({ x: 0, z: 127.999 }), { x: 0, z: 0 });
    assert.deepEqual(wildsDiscoverySiteRegionForPosition({ x: 128, z: -0.001 }), { x: 1, z: -1 });
    assert.deepEqual(wildsDiscoverySiteRegionForPosition({ x: -128, z: -128.001 }), { x: -1, z: -2 });
  });

  it("regenerates ordinary and extreme regions exactly after bounded cache eviction", () => {
    const ordinary = structuredClone(wildsDiscoverySitesForRegion(12, -9));
    const extreme = structuredClone(wildsDiscoverySitesForRegion(3_900_000, -3_900_000));
    const origin = structuredClone(wildsDiscoverySitesForRegion(0, 0));
    const nonAliased = structuredClone(wildsDiscoverySitesForRegion(3_900_000, 0));
    assert.notDeepEqual(nonAliased, origin);

    for (let index = 0; index < 180; index += 1) wildsDiscoverySitesForRegion(index + 20_000, -index - 30_000);
    assert.ok(wildsDiscoverySiteCacheSize() <= 96);
    assert.deepEqual(wildsDiscoverySitesForRegion(12, -9), ordinary);
    assert.deepEqual(wildsDiscoverySitesForRegion(3_900_000, -3_900_000), extreme);
  });

  it("keeps one physical identity from distant landmark through entrance and interior", () => {
    const site = wildsDiscoverySitesForRegion(3, 2).find((candidate) => candidate.interior.kind === "cave")!;
    const distant = projectWildsDiscoverySiteApproach(site, 240);
    const approach = projectWildsDiscoverySiteApproach(site, 22);
    const interior = projectWildsDiscoverySiteApproach(site, 0);

    assert.equal(distant.siteKey, site.key);
    assert.equal(approach.siteKey, site.key);
    assert.equal(interior.siteKey, site.key);
    assert.deepEqual(distant.entrance, site.entrance);
    assert.deepEqual(approach.collisionEnvelope, site.collisionEnvelope);
    assert.deepEqual(interior.collisionEnvelope, site.collisionEnvelope);
    assert.equal(distant.visible, true);
    assert.equal(approach.physical, true);
    assert.equal(interior.interiorAdmitted, true);
  });

  it("provides every mountain scale and embodied waterfall and cave class", () => {
    const sites = Array.from({ length: 48 }, (_, index) => wildsDiscoverySitesForRegion(index - 24, index * 3 - 50)).flat();
    const mountains = sites.filter((site) => site.mountain !== null);
    assert.deepEqual(new Set(mountains.map((site) => site.mountain!.scaleClass)), new Set(["hill", "mountain", "massif"]));
    for (const site of mountains) {
      assert.ok(site.mountain!.summitY > site.entrance.y);
      assert.ok(site.routes.some((route) => route.requirements.length === 0 && route.safe));
      assert.ok(site.mountain!.visibleFromGround);
      assert.ok(site.mountain!.visibleDuringFlight);
    }

    const waterfall = sites.find((site) => site.waterfall !== null)!;
    assert.ok(waterfall);
    assert.ok(waterfall.waterfall!.source.y > waterfall.waterfall!.pool.y);
    assert.ok(waterfall.waterfall!.source.y > waterfall.waterfall!.lip.y);
    assert.ok(waterfall.waterfall!.lip.y > waterfall.waterfall!.pool.y);
    assert.deepEqual(waterfall.waterfall!.flowPath.at(-1), waterfall.waterfall!.pool);
    assert.ok(waterfall.waterfall!.current > 0);

    const caves = sites.filter((site) => site.interior.kind !== "none");
    assert.deepEqual(new Set(caves.map((site) => site.interior.scaleClass)), new Set(["shelter", "cavern", "underground-world"]));
    assert.ok(caves.every((site) => site.interior.exits.length >= 1 && site.interior.chambers.length <= 12));
  });

  it("keeps v1 mountain identity stable while footing every ridge node on canonical terrain", () => {
    const historical = wildsDiscoverySitesForRegion(-7, 4).find((site) => site.slot === 0)!;
    assert.equal(historical.key, "wildz.site.v1:-7:4:0:3a3388a98dd233cf");
    assert.equal(historical.family, "mountain-pass");
    assert.ok(historical.mountain);

    for (let regionZ = -10; regionZ <= 10; regionZ += 1) {
      for (let regionX = -10; regionX <= 10; regionX += 1) {
        const physical = admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ);
        for (const field of physical.mountainFields) {
          let hasPublicFoothill = false;
          let hasUpperClimb = false;
          for (const node of field.nodes) {
            const terrain = sampleWildsTerrain(node.x, node.z);
            assert.ok(Math.abs(node.baseY - terrain.elevation) <= .000001, field.id);
            assert.ok(node.topY >= node.baseY, field.id);
            if (node.topY - node.baseY <= 1.25) hasPublicFoothill = true;
            if (node.topY - node.baseY > 2.2) hasUpperClimb = true;
          }
          assert.equal(hasPublicFoothill, true, field.id);
          assert.equal(hasUpperClimb, true, field.id);
        }
      }
    }
  });

  it("projects rounded mountain terrain with broad public foothills instead of walls or pyramids", () => {
    for (const physical of [
      admitWildsDiscoveryPhysicalNeighborhood(0, 0),
      admitWildsDiscoveryPhysicalNeighborhood(-5, -5),
      admitWildsDiscoveryPhysicalNeighborhood(8, -7)
    ]) {
      for (const field of physical.mountainFields) {
        assert.ok(field.columns >= 9, field.id);
        assert.ok(field.rows >= 9, field.id);
        const rises = field.nodes.map((node) => node.topY - node.baseY);
        const perimeter = field.nodes.filter((_, index) => {
          const row = Math.floor(index / field.columns);
          const column = index % field.columns;
          return row === 0 || row === field.rows - 1 || column === 0 || column === field.columns - 1;
        });
        assert.ok(perimeter.every((node) => node.topY - node.baseY <= .05), field.id);
        assert.ok(rises.some((rise) => rise > .25 && rise <= 2.2), field.id);
        assert.ok(rises.some((rise) => rise > 2.2), field.id);
        assert.ok(new Set(rises.map((rise) => Math.round(rise * 10))).size >= 7, field.id);

        let maximumAddedGrade = 0;
        for (let row = 0; row < field.rows; row += 1) {
          for (let column = 0; column < field.columns; column += 1) {
            const node = field.nodes[row * field.columns + column]!;
            const rise = node.topY - node.baseY;
            if (column + 1 < field.columns) {
              const east = field.nodes[row * field.columns + column + 1]!;
              maximumAddedGrade = Math.max(maximumAddedGrade, Math.abs(rise - (east.topY - east.baseY)) / Math.hypot(node.x - east.x, node.z - east.z));
            }
            if (row + 1 < field.rows) {
              const south = field.nodes[(row + 1) * field.columns + column]!;
              maximumAddedGrade = Math.max(maximumAddedGrade, Math.abs(rise - (south.topY - south.baseY)) / Math.hypot(node.x - south.x, node.z - south.z));
            }
          }
        }
        assert.ok(maximumAddedGrade <= .8, `${field.id}:${maximumAddedGrade}`);
      }
    }
  });

  it("keeps ordinary progression routes open while making risk and recovery explicit", () => {
    const sites = wildsDiscoverySitesForRegion(-7, 11);
    for (const site of sites) {
      assert.ok(site.routes.some((route) => route.safe && route.requirements.length === 0));
      assert.ok(site.routes.filter((route) => route.requirements.length > 0).every((route) => route.rewardTier > 0));
    }

    const mountain = Array.from({ length: 40 }, (_, index) => wildsDiscoverySitesForRegion(index, -index)).flat().find((site) => site.mountain?.scaleClass === "massif")!;
    assert.ok(mountain);
    assert.equal(projectWildsDiscoverySiteFall(mountain, { capabilities: [], fallDistance: 18 }).outcome, "impact");
    assert.equal(projectWildsDiscoverySiteFall(mountain, { capabilities: ["glide"], fallDistance: 18 }).outcome, "recovered");
    assert.equal(projectWildsDiscoverySiteOverflight(mountain, { lift: 20, endurance: 20, control: 20, weatherTolerance: 20 }).admitted, false);
    assert.equal(projectWildsDiscoverySiteOverflight(mountain, { lift: 100, endurance: 100, control: 100, weatherTolerance: 100 }).admitted, true);
    for (const invalid of [
      { lift: Number.POSITIVE_INFINITY, endurance: 100, control: 100, weatherTolerance: 100 },
      { lift: 100, endurance: Number.NaN, control: 100, weatherTolerance: 100 },
      { lift: -1, endurance: 100, control: 100, weatherTolerance: 100 },
      { lift: 101, endurance: 100, control: 100, weatherTolerance: 100 }
    ]) assert.equal(projectWildsDiscoverySiteOverflight(mountain, invalid).admitted, false);
  });

  it("keeps every ordinary mountain route clear of its own admitted ridge solids", () => {
    for (let regionZ = -10; regionZ <= 10; regionZ += 1) {
      for (let regionX = -10; regionX <= 10; regionX += 1) {
        const physical = admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ);
        for (const site of physical.sites.filter((candidate) => candidate.mountain)) {
          const solids = physical.solids.filter((solid) => solid.siteKey === site.key);
          const ordinary = site.routes.find((route) => route.safe && route.requirements.length === 0)!;
          for (const point of ordinary.points) {
            assert.equal(solids.some((solid) => Math.abs(point.x - solid.center.x) <= solid.halfExtents.x
              && Math.abs(point.y - solid.center.y) <= solid.halfExtents.y
              && Math.abs(point.z - solid.center.z) <= solid.halfExtents.z), false, ordinary.id);
          }
          for (let index = 1; index < ordinary.points.length; index += 1) {
            const start = ordinary.points[index - 1]!;
            const end = ordinary.points[index]!;
            for (let step = 0; step <= 20; step += 1) {
              const amount = step / 20;
              const point = { x: start.x + (end.x - start.x) * amount, y: start.y + (end.y - start.y) * amount, z: start.z + (end.z - start.z) * amount };
              assert.equal(solids.some((solid) => Math.abs(point.x - solid.center.x) <= solid.halfExtents.x
                && Math.abs(point.y - solid.center.y) <= solid.halfExtents.y
                && Math.abs(point.z - solid.center.z) <= solid.halfExtents.z), false, ordinary.id);
            }
          }
          if (site.waterfall) {
            for (const point of site.waterfall.flowPath) {
              assert.equal(solids.some((solid) => Math.abs(point.x - solid.center.x) <= solid.halfExtents.x
                && Math.abs(point.y - solid.center.y) <= solid.halfExtents.y
                && Math.abs(point.z - solid.center.z) <= solid.halfExtents.z), false, `waterfall:${site.key}`);
            }
          }
        }
      }
    }
  });

  it("memoizes sparse neighborhoods and performs zero site generation during warmed movement", () => {
    const admitted = admitWildsDiscoveryNeighborhood(14, -20);
    const before = wildsDiscoverySiteDiagnostics();
    for (let frame = 0; frame < 300; frame += 1) {
      assert.equal(admitWildsDiscoveryNeighborhood(14, -20), admitted);
    }
    const after = wildsDiscoverySiteDiagnostics();
    assert.equal(after.regionsBuilt, before.regionsBuilt);
    assert.equal(after.terrainSamples, before.terrainSamples);
    assert.equal(after.neighborhoodsBuilt, before.neighborhoodsBuilt);
  });

  it("admits one immutable physical projection shared by every site consumer", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(3, 2);
    assert.equal(Object.isFrozen(physical), true);
    assert.equal(Object.isFrozen(physical.surfaces), true);
    assert.equal(Object.isFrozen(physical.solids), true);
    assert.equal(Object.isFrozen(physical.ceilings), true);
    assert.equal(Object.isFrozen(physical.portals), true);
    assert.equal(Object.isFrozen(physical.waterVolumes), true);
    assert.equal(Object.isFrozen(physical.encounterVolumes), true);
    assert.ok(physical.surfaces.length > 0);
    assert.ok(physical.solids.length > 0);
    assert.ok(physical.portals.length > 0);
    assert.equal(new Set(physical.surfaces.map((surface) => surface.id)).size, physical.surfaces.length);
    assert.equal(new Set(physical.solids.map((solid) => solid.id)).size, physical.solids.length);

    for (const portal of physical.portals) {
      const site = physical.sites.find((candidate) => candidate.key === portal.siteKey)!;
      const expectedEntrance = site.waterfall?.hiddenEntrance ?? site.entrance;
      assert.deepEqual(portal.position, { x: expectedEntrance.x, y: expectedEntrance.y, z: expectedEntrance.z });
      assert.equal(portal.fromSpaceId, "wildz.space.outer.v1");
      assert.equal(portal.toSpaceId, `wildz.space.v1:${site.key}:interior`);
    }
    for (const encounter of physical.encounterVolumes) {
      assert.ok(physical.surfaces.some((surface) => surface.spaceId === encounter.spaceId));
    }
  });

  it("distinguishes overlapping outer and interior floors and restores exact flooded space", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(3, 2);
    const portal = physical.portals[0]!;
    const outer = wildsSiteSurfaceAt(physical, "wildz.space.outer.v1", portal.position.x, portal.position.z, portal.position.y);
    const interiorSpaceId = portal.toSpaceId;
    const interior = wildsSiteSurfaceAt(physical, interiorSpaceId, portal.position.x, portal.position.z, portal.position.y - 1);
    assert.ok(outer);
    assert.ok(interior);
    assert.notEqual(outer!.id, interior!.id);
    assert.notEqual(outer!.spaceId, interior!.spaceId);

    const restored = normalizeWildsSiteSpaceState({
      version: "wildz.site-space-state.v1",
      spaceId: interiorSpaceId,
      siteKey: portal.siteKey,
      surfaceId: interior!.id,
      position: { x: portal.position.x, y: interior!.center.y, z: portal.position.z },
      flooded: physical.waterVolumes.some((volume) => volume.spaceId === interiorSpaceId)
    }, { x: 9, y: 2, z: 7 });
    assert.equal(restored.spaceId, interiorSpaceId);
    assert.equal(restored.surfaceId, interior!.id);
    assert.equal(restored.position.y, interior!.center.y);
    const forgedPosition = normalizeWildsSiteSpaceState({
      version: "wildz.site-space-state.v1",
      spaceId: interiorSpaceId,
      siteKey: portal.siteKey,
      surfaceId: interior!.id,
      position: { x: portal.position.x + 50_000, y: interior!.center.y + 50_000, z: portal.position.z - 50_000 },
      flooded: false
    }, { x: 9, y: 2, z: 7 });
    assert.equal(forgedPosition.spaceId, "wildz.space.outer.v1");
    const floodedPhysical = Array.from({ length: 40 }, (_, index) => admitWildsDiscoveryPhysicalNeighborhood(index - 20, index + 30))
      .find((candidate) => candidate.surfaces.some((surface) => surface.kind === "interior-floor" && surface.flooded))!;
    assert.ok(floodedPhysical);
    const floodedSurface = floodedPhysical.surfaces.find((surface) => surface.kind === "interior-floor" && surface.flooded)!;
    const floodedSite = floodedPhysical.sites.find((site) => site.key === floodedSurface.siteKey)!;
    const canonicalFlooded = normalizeWildsSiteSpaceState({
      version: "wildz.site-space-state.v1",
      spaceId: floodedSurface.spaceId,
      siteKey: floodedSite.key,
      surfaceId: floodedSurface.id,
      position: floodedSurface.center,
      flooded: false
    }, { x: 9, y: 2, z: 7 });
    assert.equal(canonicalFlooded.flooded, true);
    for (const surface of floodedPhysical.surfaces.filter((candidate) => candidate.kind === "interior-floor" && candidate.flooded)) {
      assert.equal(floodedPhysical.waterVolumes.some((volume) => volume.kind === "flooded-interior"
        && volume.spaceId === surface.spaceId
        && Math.abs(surface.center.x - volume.center.x) <= volume.halfExtents.x
        && Math.abs(surface.center.y - volume.center.y) <= volume.halfExtents.y
        && Math.abs(surface.center.z - volume.center.z) <= volume.halfExtents.z), true, surface.id);
    }

    assert.deepEqual(normalizeWildsSiteSpaceState(undefined, { x: 9, y: 2, z: 7 }), {
      version: "wildz.site-space-state.v1",
      spaceId: "wildz.space.outer.v1",
      siteKey: null,
      surfaceId: null,
      position: { x: 9, y: 2, z: 7 },
      flooded: false
    });
    assert.equal(wildsSiteSurfaceAt(physical, interiorSpaceId, portal.position.x, portal.position.z, portal.position.y + 1_000), undefined);
  });

  it("restores an outer mountain position onto the exact admitted ridge instead of beneath it", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(0, 0);
    const field = physical.mountainFields[0]!;
    const node = field.nodes[Math.floor(field.nodes.length / 2)]!;
    const restored = normalizeWildsSiteSpaceState({
      version: "wildz.site-space-state.v1",
      spaceId: "wildz.space.outer.v1",
      siteKey: null,
      surfaceId: field.id,
      position: { x: node.x, y: node.baseY, z: node.z },
      flooded: false
    }, { x: node.x, y: node.baseY, z: node.z });
    assert.equal(restored.spaceId, "wildz.space.outer.v1");
    assert.equal(restored.surfaceId, field.id);
    assert.equal(restored.position.x, node.x);
    assert.equal(restored.position.y, node.topY);
    assert.equal(restored.position.z, node.z);
  });

  it("shares waterfall anchors and site-qualified encounter space without changing terrain v1", () => {
    const before = sampleWildsTerrain(18.25, -71.5);
    const physical = admitWildsDiscoveryPhysicalNeighborhood(-4, 6);
    const waterfallSite = physical.sites.find((site) => site.waterfall !== null) ??
      Array.from({ length: 30 }, (_, index) => admitWildsDiscoveryPhysicalNeighborhood(index, -index).sites.find((site) => site.waterfall !== null)).find(Boolean)!;
    assert.ok(waterfallSite?.waterfall);
    const waterfall = waterfallSite.waterfall!;
    const water = physical.sites.includes(waterfallSite)
      ? physical.waterVolumes.find((volume) => volume.siteKey === waterfallSite.key && volume.kind === "waterfall")
      : admitWildsDiscoveryPhysicalNeighborhood(waterfallSite.regionX, waterfallSite.regionZ).waterVolumes.find((volume) => volume.siteKey === waterfallSite.key && volume.kind === "waterfall");
    assert.ok(water);
    assert.deepEqual(water!.source, waterfall.source);
    assert.deepEqual(water!.lip, waterfall.lip);
    assert.deepEqual(water!.pool, waterfall.pool);
    assert.deepEqual(water!.flowPath, waterfall.flowPath);
    if (waterfall.hiddenEntrance) {
      const waterfallPhysical = physical.sites.includes(waterfallSite)
        ? physical
        : admitWildsDiscoveryPhysicalNeighborhood(waterfallSite.regionX, waterfallSite.regionZ);
      const hiddenPortal = waterfallPhysical.portals.find((portal) => portal.siteKey === waterfallSite.key);
      assert.ok(hiddenPortal);
      assert.deepEqual(hiddenPortal!.position, waterfall.hiddenEntrance);
      assert.ok(waterfallPhysical.surfaces.some((surface) => surface.spaceId === hiddenPortal!.toSpaceId));
    }

    const encounter = projectWildsSiteEncounterContext(waterfallSite, {
      spaceId: "wildz.space.outer.v1",
      worldY: waterfallSite.entrance.y
    });
    assert.equal(encounter.siteKey, waterfallSite.key);
    assert.equal(encounter.spaceId, "wildz.space.outer.v1");
    assert.ok(encounter.interactionBand.minY <= encounter.worldY && encounter.interactionBand.maxY >= encounter.worldY);

    const cave = physical.sites.find((site) => site.interior.kind === "cave")!;
    const interiorContext = projectWildsSiteEncounterContext(cave, {
      spaceId: `wildz.space.v1:${cave.key}:interior`,
      worldY: cave.entrance.y - 1
    });
    assert.equal(interiorContext.spaceId, `wildz.space.v1:${cave.key}:interior`);
    assert.notEqual(interiorContext.spaceId, encounter.spaceId);
    assert.deepEqual(sampleWildsTerrain(18.25, -71.5), before);
  });

  it("reuses one warmed physical index for ten thousand movement ticks", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(31, -42);
    const site = physical.sites[0]!;
    const sample = { surfaceId: null as string | null, floorY: 0, ceilingY: 0, flooded: false };
    const before = wildsDiscoverySiteDiagnostics();
    for (let tick = 0; tick < 10_000; tick += 1) {
      assert.equal(writeWildsSitePhysicalSample(sample, physical, "wildz.space.outer.v1", site.entrance.x, site.entrance.y, site.entrance.z), sample);
    }
    const after = wildsDiscoverySiteDiagnostics();
    assert.equal(after.physicalNeighborhoodsBuilt, before.physicalNeighborhoodsBuilt);
    assert.equal(after.surfaceIndexesBuilt, before.surfaceIndexesBuilt);
    assert.equal(after.terrainSamples, before.terrainSamples);
    assert.ok(sample.surfaceId);
  });

  it("bounds and exactly regenerates physical neighborhoods after eviction", () => {
    const expected = structuredClone(admitWildsDiscoveryPhysicalNeighborhood(3_900_000, -3_900_000));
    for (let index = 0; index < 80; index += 1) admitWildsDiscoveryPhysicalNeighborhood(index + 80_000, -index - 90_000);
    assert.ok(wildsDiscoveryPhysicalCacheSize() <= 48);
    assert.deepEqual(admitWildsDiscoveryPhysicalNeighborhood(3_900_000, -3_900_000), expected);
  });

  it("keeps current render and collision consumers on the same site objects through adversarial cache churn", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(240, -310);
    const retained = physical.sites.find((site) => site.regionX === 240 && site.regionZ === -310)!;
    for (let index = 0; index < 140; index += 1) wildsDiscoverySitesForRegion(index + 500_000, -index - 600_000);
    const regionAfterChurn = wildsDiscoverySitesForRegion(240, -310);
    assert.equal(regionAfterChurn[retained.slot], retained);

    for (let index = 0; index < 60; index += 1) admitWildsDiscoveryPhysicalNeighborhood(index + 700_000, -index - 800_000);
    const currentRegion = wildsDiscoverySitesForRegion(240, -310);
    const currentPhysical = admitWildsDiscoveryPhysicalNeighborhood(240, -310);
    const currentPhysicalSite = currentPhysical.sites.find((site) => site.regionX === 240 && site.regionZ === -310 && site.slot === retained.slot)!;
    assert.equal(currentPhysicalSite, currentRegion[retained.slot]);
  });

  it("physically represents every chamber and keeps neighboring admitted sites separated", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(0, 0);
    for (const site of physical.sites) {
      for (const route of site.routes) {
        for (const point of route.points) {
          assert.ok(physical.surfaces.some((surface) => surface.spaceId === "wildz.space.outer.v1"
            && Math.abs(point.x - surface.center.x) <= surface.halfExtents.x
            && Math.abs(point.z - surface.center.z) <= surface.halfExtents.z), route.id);
        }
      }
      if (site.interior.kind !== "cave") continue;
      const spaceId = `wildz.space.v1:${site.key}:interior`;
      for (let chamberIndex = 0; chamberIndex < site.interior.chambers.length; chamberIndex += 1) {
        const chamber = site.interior.chambers[chamberIndex]!;
        const floor = physical.surfaces.find((surface) => surface.id === `surface:${site.key}:interior-floor:${chamberIndex}`
          && surface.spaceId === spaceId
          && Math.abs(chamber.center.x - surface.center.x) <= surface.halfExtents.x
          && Math.abs(chamber.center.z - surface.center.z) <= surface.halfExtents.z);
        const ceiling = physical.ceilings.find((candidate) => candidate.spaceId === spaceId
          && Math.abs(chamber.center.x - candidate.center.x) <= candidate.halfExtents.x
          && Math.abs(chamber.center.z - candidate.center.z) <= candidate.halfExtents.z);
        assert.ok(floor, chamber.id);
        assert.ok(ceiling, chamber.id);
        assert.ok(chamber.radius <= floor!.halfExtents.x);
      }
    }

    const entrances = physical.sites.map((site) => site.entrance);
    for (let left = 0; left < entrances.length; left += 1) {
      for (let right = left + 1; right < entrances.length; right += 1) {
        assert.ok(Math.hypot(entrances[left]!.x - entrances[right]!.x, entrances[left]!.z - entrances[right]!.z) >= 20);
      }
    }
    for (const site of physical.sites) {
      for (const route of site.routes) {
        for (const point of route.points) {
          assert.equal(physical.sites.some((other) => other.key !== site.key
            && Math.abs(point.x - other.collisionEnvelope.center.x) < other.collisionEnvelope.halfExtents.x
            && Math.abs(point.z - other.collisionEnvelope.center.z) < other.collisionEnvelope.halfExtents.z), false, route.id);
        }
      }
    }
  });
});
