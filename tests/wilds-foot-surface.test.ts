import assert from 'node:assert/strict';
import { it } from 'node:test';
import { admitWildsDiscoveryPhysicalNeighborhood, wildsMountainFieldValue } from '../src/features/play/wilds-discovery-sites';
import { wildsFootSurfaceAt } from '../src/features/play/wilds-foot-surface';
import { prepareWildsSiteRuntime } from '../src/features/play/wilds-site-runtime';
import { sampleWildsTerrain } from '../src/features/play/wilds-terrain-authority';

it('hears the admitted mountain skin instead of the terrain beneath it', () => {
  const siteRuntime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
  const field = siteRuntime.physical.mountainFields[0]!;
  const point = { x: field.center.x, y: wildsMountainFieldValue(field, field.center.x, field.center.z, 'topY'), z: field.center.z };
  const input = { flooded: false, canopy: false, navigation: null, creations: { instances: {}, definitions: {} }, siteRuntime };
  assert.equal(wildsFootSurfaceAt(point, field.spaceId, input), 'mountain-rock');
  const outside = { x: point.x + 200, y: 0, z: point.z + 200 };
  assert.equal(wildsFootSurfaceAt(outside, field.spaceId, input), sampleWildsTerrain(outside.x, outside.z).surface);
});
