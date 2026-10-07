import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
import { projectWildsMonuments, projectWildsWaterfallChute, type WildsMonumentSite } from "../src/features/play/wilds-discovery-monuments";
import { createWildsMonumentBatches, createWildsWaterfallBatches } from "../src/features/play/wilds-monument-geometry";

const ruins: WildsMonumentSite[] = Array.from({ length: 64 }, (_, index) => ({ key: `wildz.site.v1:${index % 8}:${Math.floor(index / 8)}:3:0123456789abcdef`, regionX: index % 8, regionZ: Math.floor(index / 8), slot: 3, family: "ruin", entrance: { x: index % 8 * 128 + 96, y: 2, z: Math.floor(index / 8) * 128 + 96, radius: 2.2, layer: "ground" } }));
function triangles(batches: ReturnType<typeof createWildsMonumentBatches>) { return batches.reduce((sum, batch) => sum + batch.geometry.getAttribute("position").count / 3, 0); }
function dispose(batches: ReturnType<typeof createWildsMonumentBatches>) { for (const batch of batches) batch.geometry.dispose(); }

describe("Batched discovery graphics", () => {
  it("keeps each seeded monument within three draws and a bounded triangle budget", () => {
    for (const monument of projectWildsMonuments(ruins)) {
      const batches = createWildsMonumentBatches(monument, "medium");
      assert.ok(batches.length <= 3);
      assert.ok(triangles(batches) <= 700);
      for (const batch of batches) {
        assert.ok(batch.geometry.getAttribute("color"));
        assert.ok(batch.geometry.boundingSphere);
        assert.ok([...batch.geometry.getAttribute("position").array].every(Number.isFinite));
      }
      const low = createWildsMonumentBatches(monument, "low");
      assert.ok(triangles(low) <= triangles(batches));
      dispose(batches); dispose(low);
    }
  });
  it("builds falling sheets, pool froth and rock strata in two draws on every quality tier", () => {
    const site = Array.from({ length: 30 }, (_, index) => wildsDiscoverySitesForRegion(index, -index)).flat().find(site => site.waterfall && site.mountain?.scaleClass === "massif")!;
    const chute = projectWildsWaterfallChute(site)!;
    for (const tier of ["low", "medium", "high"] as const) {
      const batches = createWildsWaterfallBatches(chute, site.entrance, tier);
      assert.equal(batches.length, 2);
      assert.ok(triangles(batches) <= 80, "waterfall kit must fit the former two-cylinder triangle count");
      const water = batches.find(batch => batch.material === "water")!;
      const modes = [...water.geometry.getAttribute("flowKind").array];
      assert.ok(modes.includes(0) && modes.includes(1));
      water.geometry.computeBoundingBox();
      assert.ok(Math.abs(water.geometry.boundingBox!.max.y - (chute.source.y - site.entrance.y)) < .01);
      assert.ok(water.geometry.boundingBox!.min.y <= chute.pool.y - site.entrance.y + 1);
      dispose(batches);
    }
  });
  it("changes only prism illumination geometry colors for local puzzle state", () => {
    const monument = projectWildsMonuments(ruins).find(monument => monument.type === "prism")!;
    const initial = createWildsMonumentBatches(monument, "medium");
    const aligned = createWildsMonumentBatches(monument, "medium", { id: monument.id, lights: [0, 1, 2], aligned: true });
    const initialLight = initial.find(batch => batch.material === "light")!.geometry;
    const alignedLight = aligned.find(batch => batch.material === "light")!.geometry;
    assert.deepEqual(initialLight.getAttribute("position").array, alignedLight.getAttribute("position").array);
    assert.notDeepEqual(initialLight.getAttribute("color").array, alignedLight.getAttribute("color").array);
    dispose(initial); dispose(aligned);
  });
});
