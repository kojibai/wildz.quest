import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsDiscoveryStory } from "../src/features/play/wilds-discovery-story";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
test("discovery route guidance never advertises unsupported abilities", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const gated = {...site,routes:[{id:"deep",safe:true,requirements:["swim" as const,"pressure" as const],rewardTier:2 as const,points:[]}]};
  assert.equal(projectWildsDiscoveryStory(gated,["swim"],false).routeId,undefined);
  assert.equal(projectWildsDiscoveryStory(gated,["swim","pressure"],false).routeId,"deep");
});
test("entrance discoveries do not claim route completion or grant rewards", () => {
  const story = projectWildsDiscoveryStory(wildsDiscoverySitesForRegion(2,2)[0]!,[],true);
  assert.equal(story.stage,"discovered");
  assert.match(story.progressLabel,/explore the habitat next/);
  assert.equal("reward" in story,false);
});
test("route guidance prefers a supported safe path over a risky one", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const story = projectWildsDiscoveryStory({...site,routes:[
    {id:"risky",safe:false,requirements:[],rewardTier:3,points:[]},
    {id:"safe",safe:true,requirements:[],rewardTier:0,points:[]}
  ]},[],false);
  assert.equal(story.routeId,"safe");
});
