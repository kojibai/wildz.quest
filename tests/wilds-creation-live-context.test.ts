import assert from "node:assert/strict";
import test from "node:test";
import { projectActiveCreationContext } from "../src/features/play/creation/live-context";
import { creationContextFixture } from "./support/creation-fixtures";
import { initialWildsWorldProjection, checkpointWildsWorld } from "../src/features/play/wilds-world-state";

test("a closed builder does no source hashing or physical projection across world refreshes", () => {
  for (let i = 0; i < 100; i++) {
    assert.equal(projectActiveCreationContext({ active: false, context: creationContextFixture(),
      world() { throw Error("ordinary gameplay must not prepare a builder checkpoint"); },
      physical: { projections: [], get obstacles(): never { throw Error("ordinary gameplay must not rebuild builder solids"); } } }), null);
  }
});

test("opening and refreshing the builder uses the exact current world head", () => {
  const world = initialWildsWorldProjection();
  const context = creationContextFixture();
  const prepare = () => projectActiveCreationContext({ active: true, context, world: () => world, physical: { projections: [], obstacles: [] } })!;
  const first = prepare();
  assert.equal(first.sourceHead, checkpointWildsWorld(world).projectionDigest);
  world.revision++;
  const second = prepare();
  assert.equal(second.sourceHead, checkpointWildsWorld(world).projectionDigest);
  assert.notEqual(second.sourceHead, first.sourceHead);
  assert.deepEqual(second.pose, context.pose);
  assert.deepEqual(second.physical, []);
});
