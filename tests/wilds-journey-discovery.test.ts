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
test("the next lead prefers a reachable entrance and keeps blocked leads discoverable", async () => {
  const {nextReachableWildsSite} = await import("../src/features/play/wilds-journey-discovery");
  const original = wildsDiscoverySitesForRegion(2,2)[0]!;
  const water = {...original,key:"water",entrance:{...original.entrance,x:0,z:0,layer:"water" as const},routes:[]};
  const ground = {...original,key:"ground",entrance:{...original.entrance,x:20,z:0,layer:"ground" as const},routes:[]};
  const sites = [water,ground];
  assert.equal(nextReachableWildsSite(sites,[],{x:0,z:0},[])?.key,"ground");
  assert.equal(nextReachableWildsSite(sites,[],{x:0,z:0},["swim"])?.key,"water");
  assert.equal(nextReachableWildsSite(sites,["ground"],{x:0,z:0},[])?.key,"water");
  assert.equal(nextReachableWildsSite(sites,["ground","water"],{x:0,z:0},[]),null);
});
test("a supported route wins over a nearer route with unmet abilities", async () => {
  const {nextReachableWildsSite} = await import("../src/features/play/wilds-journey-discovery");
  const original = wildsDiscoverySitesForRegion(2,2)[0]!;
  const blocked = {...original,key:"blocked",entrance:{...original.entrance,x:0,z:0,layer:"ground" as const},routes:[{id:"cliff",safe:true,requirements:["climb" as const],rewardTier:0 as const,points:[]}]};
  const open = {...blocked,key:"open",entrance:{...blocked.entrance,x:20},routes:[]};
  assert.equal(nextReachableWildsSite([blocked,open],[],{x:0,z:0},[])?.key,"open");
  assert.equal(nextReachableWildsSite([blocked,open],[],{x:0,z:0},["climb"])?.key,"blocked");
});
