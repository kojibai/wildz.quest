import test from "node:test";
import assert from "node:assert/strict";
import { nearestUnvisitedWildsSite, wildsTrailDirection, wildsDiscoveryImpression } from "../src/features/play/wilds-journey-discovery";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
test("trail directions follow world compass and avoid false distances at the destination", () => {
  assert.equal(wildsTrailDirection({x:0,z:0},{x:0,z:-10}), "10 m north");
  assert.equal(wildsTrailDirection({x:0,z:0},{x:10,z:0}), "10 m east");
  assert.equal(wildsTrailDirection({x:0,z:0},{x:0,z:1}), "right here");
});
test("discovery lead chooses actual unvisited geometry and exhausts honestly", () => {
  const sites = wildsDiscoverySitesForRegion(2, 2);
  assert.ok(sites.length);
  const first = sites[0]!;
  assert.equal(nearestUnvisitedWildsSite(sites, [], first.entrance)?.key, first.key);
  assert.notEqual(nearestUnvisitedWildsSite(sites, [first.key], first.entrance)?.key, first.key);
  assert.equal(nearestUnvisitedWildsSite(sites, sites.map(s=>s.key), first.entrance), null);
  assert.ok(wildsDiscoveryImpression(first).length > 20);
});
