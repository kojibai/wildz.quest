import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { projectWildsDiscoverySiteVisuals } from "../src/features/play/wilds-discovery-site-visuals";

describe("Wilds discovery-site visual projection", () => {
  it("turns hidden mountain authority into continuous terrain ridges", () => {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(3, 2);
    const mountain = physical.sites.find((site) => site.mountain)!;
    const fields = physical.mountainFields.filter((field) => field.siteKey === mountain.key);
    const visuals = projectWildsDiscoverySiteVisuals(mountain, fields, []);

    assert.ok(fields.length > 0);
    assert.equal(visuals.mountainSurfaces.length, fields.length);
    assert.ok(visuals.mountainSurfaces.every((surface) => surface.shape === "terrain-ridge"));
    assert.ok(visuals.mountainSurfaces.every((surface) => surface.positions.length === surface.columns * surface.rows * 3));
    assert.equal(Object.isFrozen(visuals.mountainSurfaces), true);
  });

  it("renders physical water as a surface instead of a floating volume block", () => {
    const physical = Array.from({ length: 40 }, (_, index) => admitWildsDiscoveryPhysicalNeighborhood(index - 20, 17 - index))
      .find((candidate) => candidate.waterVolumes.some((water) => water.spaceId === "wildz.space.outer.v1"))!;
    const site = physical.sites.find((candidate) => physical.waterVolumes.some((water) => water.siteKey === candidate.key && water.spaceId === "wildz.space.outer.v1"))!;
    const waters = physical.waterVolumes.filter((water) => water.siteKey === site.key && water.spaceId === "wildz.space.outer.v1");
    const visuals = projectWildsDiscoverySiteVisuals(site, [], waters);

    const surfaceWaters = waters.filter((water) => water.kind !== "waterfall");

    assert.equal(visuals.waterSurfaces.length, surfaceWaters.length);
    assert.equal(visuals.waterSurfaces.some((surface) => waters.find((water) => water.id === surface.id)?.kind === "waterfall"), false);
    for (let index = 0; index < surfaceWaters.length; index += 1) {
      const water = surfaceWaters[index]!;
      const surface = visuals.waterSurfaces[index]!;
      assert.ok(Math.abs(surface.y - (water.center.y + water.halfExtents.y)) <= .000001);
      assert.equal(surface.width, water.halfExtents.x * 2);
      assert.equal(surface.depth, water.halfExtents.z * 2);
      assert.equal(surface.thickness, 0.04);
    }
  });
});
