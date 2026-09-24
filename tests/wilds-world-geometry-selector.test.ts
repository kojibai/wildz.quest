import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWorldGeometrySelector } from "../src/features/play/wilds-world-geometry-selector";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";

test("harvest snapshot clones preserve all unchanged collision inputs", () => {
  const select = createWildsWorldGeometrySelector();
  const world = initialWildsWorldProjection();
  const before = select(world);
  const harvested = structuredClone(world);
  harvested.revision += 1;
  assert.equal(select(harvested), before);
  assert.equal(select({ ...harvested, revision: harvested.revision + 1 }), before);
});

test("geometry updates are compared in full and reset between worlds", () => {
  const select = createWildsWorldGeometrySelector();
  const world = initialWildsWorldProjection();
  const before = select(world)!;
  // Only the selector is exercised: an arbitrary changed payload must not be
  // mistaken for identical geometry, even if it carries an unchanged head.
  const changed = { ...world, structures: { fixture: { head: "same", position: { x: 1 } } } } as unknown as typeof world;
  const next = select(changed)!;
  assert.notEqual(next, before);
  assert.equal(next.sites, before.sites);
  assert.equal(next.structures, changed.structures);
  const moved = structuredClone(changed);
  (moved.structures.fixture as unknown as { position: { x: number } }).position.x = 2;
  assert.notEqual(select(moved), next);
  assert.equal(select(null), null);
  assert.notEqual(select(world), before);
});
