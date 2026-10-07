import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationBuildInReach, CREATION_PHYSICAL_BUILD_REACH_RULE } from '../src/features/play/creation/build-reach';
import { compileCreation } from '../src/features/play/creation/compiler';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';

function plan(yaw = 0) {
  const node = creationDefinitionFixture().nodes[0];
  const result = compileCreation(creationDefinitionFixture({ nodes: [{ ...node, id: 'distant-wall',
    shape: { kind: 'box', width: 20, height: 2, depth: .5 },
    pose: { position: { x: 100, y: 0, z: 100 }, yaw }, supports: [], behaviors: [] }] }), creationContextFixture());
  if (result.status !== 'ready') throw Error('reach_fixture');
  return result.plan;
}
const rule = CREATION_PHYSICAL_BUILD_REACH_RULE.id;

test('physical build reach uses the real 3D surface with exact twelve-metre boundaries', () => {
  const p = plan(), surface = { x: 110, y: 1, z: 100 };
  assert.equal(creationBuildInReach(p, surface), false, 'old origin rule remains exact');
  assert.equal(creationBuildInReach(p, { ...surface, x: 122 }, rule), true);
  assert.equal(creationBuildInReach(p, { ...surface, x: 122.000001 }, rule), false);
  assert.equal(creationBuildInReach(p, { x: 100, y: 14, z: 100 }, rule), true);
  assert.equal(creationBuildInReach(p, { x: 100, y: 14.000001, z: 100 }, rule), false);
  assert.equal(creationBuildInReach(p, { ...surface, y: NaN }, rule), false);
  assert.equal(creationBuildInReach(p, { ...surface, z: Infinity }, rule), false);
});

test('rotated physical solids and distant gaps cannot use page bounds to grant build reach', () => {
  const p = plan(Math.PI / 4), c = Math.SQRT1_2;
  const at = (x: number, z: number) => ({ x: 100 + x * c + z * c, y: 1, z: 100 - x * c + z * c });
  assert.equal(creationBuildInReach(p, at(10, 11), rule), true);
  assert.equal(creationBuildInReach(p, at(0, 13), rule), false);
  assert.equal(creationBuildInReach(p, { x: 50, y: 1, z: 50 }, rule), false);
  assert.equal(creationBuildInReach(p, { ...p.pose.position, x: p.pose.position.x + 12 }, rule), true,
    'new law preserves valid legacy origin reach');
});
